import { Prisma, payment_status_enum } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { toUTC } from '../../utils/timezone';
import { AuthUser, getClientAccessLevel, canCreateTrips, getDriverClients, getPassengerClients, getDriverForClient } from '../../utils/calendarAuth';
import { normalizeTripType } from '../../utils/tripType';
import { CreateTripDto, UpdateTripDto } from './types';

// Wire contract: the passenger relation is exposed as `clients`.
function toWireTrip(trip: any): any {
  if (!trip) return trip;
  const { passenger, ...rest } = trip;
  return { ...rest, clients: passenger };
}

function toWireTrips(trips: any[]): any[] {
  return trips.map(toWireTrip);
}

async function findRateForTrip(route_id: bigint, trip_type: string): Promise<{ id: bigint; base_price: number }> {
  // The agreed price belongs to the route and the trip type: exactly one row is
  // the agreement. Never insert here — creating a rate inside a trip request
  // silently poisoned the price catalog with zero-price rows.
  const rates = await prisma.rates.findMany({
    where: { route_id, trip_type: trip_type as any },
    select: { id: true, base_price: true, created_at: true },
    orderBy: { created_at: 'asc' },
  });

  if (rates.length === 0) {
    throw new AppError('No hay tarifa configurada para esta ruta', 400);
  }

  // Rows left behind by the old auto-create path can duplicate the key.
  // The agreement is the priced one; a zero-price duplicate is garbage.
  const rate = rates.find((candidate) => Number(candidate.base_price) > 0) ?? rates[0];

  return { id: rate.id, base_price: Number(rate.base_price) };
}

function requireAuth(user: AuthUser | undefined): AuthUser {
  if (!user) throw new AppError('Usuario no autorizado', 403)
  return user
}

function belongsToClient(ownerId: bigint | null | undefined, clientId: bigint): boolean {
  // Null ownership represents a shared route/rate in the existing domain model.
  return ownerId == null || ownerId === clientId
}

function assertClientOwnership(
  ownerId: bigint | null | undefined,
  clientId: bigint,
  resource: string,
) {
  if (!belongsToClient(ownerId, clientId)) {
    throw new AppError(`${resource} no pertenece a este cliente`, 403)
  }
}

export const tripService = {

  async getAll(user?: AuthUser) {
    const authUser = requireAuth(user)

    if (authUser.role === 'DRIVER') {
      const clientIds = await getDriverClients(authUser.dbId)
      const trips = await prisma.trips.findMany({
        where: { client_id: { in: clientIds } },
        include: { passenger: true, routes: true, rates: true, users: true },
        orderBy: { trip_date: 'desc' },
      })
      return toWireTrips(trips)
    }

    if (authUser.role === 'CLIENT') {
      const clientIds = authUser.passengerId != null
        ? [authUser.passengerId]
        : await getPassengerClients(authUser.dbId)

      const trips = await prisma.trips.findMany({
        where: { client_id: { in: clientIds } },
        include: { passenger: true, routes: true, rates: true, users: true },
        orderBy: { trip_date: 'desc' },
      })
      return toWireTrips(trips)
    }

    const trips = await prisma.trips.findMany({
      where: { id: { in: [] } },
      include: { passenger: true, routes: true, rates: true, users: true },
      orderBy: { trip_date: 'desc' },
    })
    return toWireTrips(trips)
  },

  async getById(id: bigint, user?: AuthUser) {
    const authUser = requireAuth(user)
    const trip = await prisma.trips.findUnique({
      where: { id },
      include: { passenger: true, routes: true, rates: true, users: true },
    })
    if (!trip) return null

    const level = await getClientAccessLevel(authUser, trip.client_id)
    if (level === 'none') return null

    return toWireTrip(trip)
  },

  async getByClient(client_id: bigint, user?: AuthUser) {
    const authUser = requireAuth(user)
    const level = await getClientAccessLevel(authUser, client_id)
    if (level === 'none') {
      throw new AppError('No tienes acceso a este cliente', 403)
    }

    return prisma.trips.findMany({
      where: { client_id },
      include: { routes: true, rates: true, users: true },
      orderBy: { trip_date: 'desc' },
    })
  },

  async getByDateRange(client_id: bigint, from: Date, to: Date, user?: AuthUser) {
    const authUser = requireAuth(user)
    const level = await getClientAccessLevel(authUser, client_id)
    if (level === 'none') {
      throw new AppError('No tienes acceso a este cliente', 403)
    }

    return prisma.trips.findMany({
      where: {
        client_id,
        trip_date: { gte: from, lte: to },
      },
      include: { routes: true, rates: true, users: true },
      orderBy: { trip_date: 'asc' },
    })
  },

  async create(data: CreateTripDto, user?: AuthUser) {
    const authUser = requireAuth(user)
    const client_id = BigInt(data.client_id)
    const trip_type = normalizeTripType(data.trip_type)

    if (!(await canCreateTrips(authUser, client_id))) {
      console.log(`[trips:create] denied for user ${authUser.dbId} role ${authUser.role} on client ${client_id}`)
      throw new AppError('No tienes permisos para crear viajes para este cliente', 403)
    }

    let user_id: bigint
    if (user?.role === 'ADMIN' || user?.role === 'DRIVER') {
      user_id = user.dbId
    } else if (user?.role === 'CLIENT') {
      const driverId = await getDriverForClient(client_id)
      if (!driverId) throw new AppError('El cliente no tiene un chofer asignado', 400)
      user_id = driverId
    } else {
      throw new AppError('Usuario no autorizado', 403)
    }

    // Obtener timezone del cliente para interpretar trip_date correctamente
    const client = await prisma.passenger.findUnique({
      where: { id: client_id },
      select: { timezone: true },
    })
    if (!client) throw new AppError('Cliente no encontrado', 404)

    const tripDate = toUTC(data.trip_date, client.timezone)

    // --- VALIDACIÓN DE FECHA EN RANGO ABONADO/ARCHIVADO ----
    // Buscar si la fecha del viaje está en un período de summary cerrado (abonado/pagado/archivado)
    const closedSummary = await prisma.summaries.findFirst({
      where: {
        client_id: client_id,
        period_start: { lte: tripDate },
        period_end: { gte: tripDate },
        status: { in: ['paid', 'archived'] }, // incluir cualquier estado cerrado
      },
      select: { id: true },
    });

    if (closedSummary) {
      if (user?.role === 'CLIENT') {
        throw new AppError('No se pueden crear viajes en fechas ya abonadas/archivadas', 400);
      }
      // ADMIN o DRIVER pueden crear, pero el viaje debe entrar como abonado pagado
    }

    let route_id: bigint | undefined = undefined
    let rate_id: bigint | null = null
    let final_price: number

    if (trip_type === 'especial') {
      if (data.final_price === undefined) {
        throw new AppError('Los viajes especiales requieren final_price', 400)
      }
      final_price = data.final_price
    } else {
      if (!data.route_id) {
        throw new AppError('Los viajes ida/ida y vuelta requieren route_id', 400)
      }
      route_id = BigInt(data.route_id)

      const route = await prisma.routes.findUnique({
        where: { id: route_id },
        select: { is_active: true, client_id: true },
      })
      if (!route) throw new AppError('Ruta no encontrada', 404)
      assertClientOwnership(route.client_id, client_id, 'La ruta')
      if (!route.is_active) {
        throw new AppError('No se puede crear un viaje en una ruta eliminada', 400)
      }

      if (data.rate_id) {
        const rate = await prisma.rates.findUnique({
          where: { id: BigInt(data.rate_id) },
        })
        if (!rate) throw new AppError('Tarifa no encontrada', 404)
        assertClientOwnership(rate.client_id, client_id, 'La tarifa')
        if (rate.route_id == null || BigInt(rate.route_id) !== route_id) {
          throw new AppError('La tarifa no pertenece a esta ruta', 400)
        }

        rate_id = rate.id
        const basePrice = Number(rate.base_price)
        const surcharge = data.has_surcharge && rate.surcharge_price ? Number(rate.surcharge_price) : 0
        final_price = data.final_price ?? (basePrice + surcharge)
      } else {
        const rateData = await findRateForTrip(route_id, trip_type)
        rate_id = rateData.id
        final_price = rateData.base_price
      }
    }

    // --- Si se crea dentro de un resumen cerrado y es ADMIN/DRIVER, marcar como pagado ---
    let payment_status: payment_status_enum | undefined = undefined;
    let paid_amount: Prisma.Decimal | undefined = undefined;
    if (closedSummary && (user?.role === 'ADMIN' || user?.role === 'DRIVER')) {
      payment_status = payment_status_enum.paid;
      paid_amount = new Prisma.Decimal(final_price);
    }

    const trip = await prisma.trips.create({
      data: {
        user_id,
        client_id,
        route_id,
        rate_id,
        trip_date: tripDate,
        trip_type,
        final_price,
        has_surcharge: data.has_surcharge ?? false,
        surcharge_reason: data.surcharge_reason,
        special_type: trip_type === 'especial' ? data.special_type : null,
        notes: data.notes,
        ...(payment_status && { payment_status }),
        ...(paid_amount !== undefined && { paid_amount }),
      },
      include: { passenger: true, routes: true, rates: true },
    });
    return toWireTrip(trip)
  },

  async update(id: bigint, data: UpdateTripDto, user?: AuthUser) {
    const authUser = requireAuth(user)
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { client_id: true, trip_type: true, route_id: true, rate_id: true, special_type: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    const level = await getClientAccessLevel(authUser, trip.client_id)
    if (level !== 'full') {
      throw new AppError('No tienes permisos para modificar este viaje', 403)
    }

    const client = await prisma.passenger.findUnique({
      where: { id: trip.client_id },
      select: { timezone: true },
    })
    if (!client) throw new AppError('Cliente no encontrado', 404)

    const newTripType = data.trip_type !== undefined
      ? normalizeTripType(data.trip_type)
      : trip.trip_type

    let route_id: bigint | null | undefined = undefined
    let rate_id: bigint | null | undefined = undefined
    let special_type: string | null | undefined = undefined
    let recalculatedFinalPrice: number | undefined = undefined

    if (newTripType === 'especial') {
      // Los viajes especiales no tienen ruta ni tarifa asociada
      route_id = null
      rate_id = null
      if (data.final_price === undefined && trip.trip_type !== 'especial') {
        throw new AppError('Los viajes especiales requieren final_price', 400)
      }
      special_type = data.special_type !== undefined ? data.special_type : trip.special_type
    } else {
      // Viajes regulares requieren ruta
      const targetRouteId = data.route_id
        ? BigInt(data.route_id)
        : trip.route_id

      if (!targetRouteId) {
        throw new AppError('Los viajes ida/ida y vuelta requieren route_id', 400)
      }

      if (data.route_id || !trip.route_id) {
        const route = await prisma.routes.findUnique({
          where: { id: targetRouteId },
          select: { is_active: true, client_id: true },
        })
        if (!route) throw new AppError('Ruta no encontrada', 404)
        assertClientOwnership(route.client_id, trip.client_id, 'La ruta')
        if (!route.is_active) {
          throw new AppError('No se puede asignar un viaje a una ruta eliminada', 400)
        }
      }

      route_id = targetRouteId

      const tripTypeChanged = newTripType !== trip.trip_type
      const routeChanged = trip.route_id == null || BigInt(trip.route_id) !== targetRouteId

      if (data.rate_id) {
        const rate = await prisma.rates.findUnique({ where: { id: BigInt(data.rate_id) } })
        if (!rate) throw new AppError('Tarifa no encontrada', 404)
        assertClientOwnership(rate.client_id, trip.client_id, 'La tarifa')
        if (rate.route_id == null || BigInt(rate.route_id) !== targetRouteId) {
          throw new AppError('La tarifa no pertenece a esta ruta', 400)
        }
        rate_id = rate.id
      } else if (tripTypeChanged || routeChanged) {
        const resolvedRate = await findRateForTrip(targetRouteId, newTripType)
        rate_id = resolvedRate.id
        if (data.final_price === undefined) {
          recalculatedFinalPrice = resolvedRate.base_price
        }
      } else {
        rate_id = trip.rate_id ?? undefined
      }
      special_type = null
    }

    return prisma.trips.update({
      where: { id },
      data: {
        ...(data.trip_date    && { trip_date: toUTC(data.trip_date, client.timezone) }),
        ...(data.trip_type    !== undefined && { trip_type: newTripType }),
        ...(data.final_price !== undefined
          ? { final_price: data.final_price }
          : recalculatedFinalPrice !== undefined
            ? { final_price: recalculatedFinalPrice }
            : {}),
        ...(data.has_surcharge !== undefined && { has_surcharge: data.has_surcharge }),
        ...(data.surcharge_reason !== undefined && { surcharge_reason: data.surcharge_reason }),
        ...(special_type      !== undefined && { special_type }),
        ...(data.notes        !== undefined && { notes: data.notes }),
        ...(route_id          !== undefined && { route_id }),
        ...(rate_id           !== undefined && { rate_id }),
      },
    });
  },

  async delete(id: bigint, user?: AuthUser) {
    const authUser = requireAuth(user)
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { client_id: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    const level = await getClientAccessLevel(authUser, trip.client_id)
    if (level !== 'full') {
      throw new AppError('No tienes permisos para eliminar este viaje', 403)
    }

    return prisma.trips.delete({ where: { id } });
  },

  async startTrip(id: bigint, lat: number, lng: number, user?: AuthUser) {
    const authUser = requireAuth(user)
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { client_id: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    const level = await getClientAccessLevel(authUser, trip.client_id)
    if (level !== 'full') {
      throw new AppError('No tienes permisos para iniciar este viaje', 403)
    }

    const updatedTrip = await prisma.trips.update({
      where: { id },
      data: {
        started_at: new Date(),
        start_lat: lat,
        start_lng: lng,
      },
      include: { passenger: true, routes: true, rates: true },
    });
    return toWireTrip(updatedTrip)
  },

  async addStop(id: bigint, lat: number, lng: number, user?: AuthUser) {
    const authUser = requireAuth(user)
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { client_id: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    const level = await getClientAccessLevel(authUser, trip.client_id)
    if (level !== 'full') {
      throw new AppError('No tienes permisos para marcar paradas en este viaje', 403)
    }

    return prisma.trip_stops.create({
      data: {
        trip_id: id,
        lat,
        lng,
      },
    });
  },

  async endTrip(id: bigint, lat: number, lng: number, user?: AuthUser) {
    const authUser = requireAuth(user)
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { client_id: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    const level = await getClientAccessLevel(authUser, trip.client_id)
    if (level !== 'full') {
      throw new AppError('No tienes permisos para finalizar este viaje', 403)
    }

    const updatedTrip = await prisma.trips.update({
      where: { id },
      data: {
        ended_at: new Date(),
        end_lat: lat,
        end_lng: lng,
      },
      include: { passenger: true, routes: true, rates: true },
    });
    return toWireTrip(updatedTrip)
  },
};
