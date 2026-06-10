import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { AuthUser, getClientAccessLevel, getDriverClients, getPassengerClients, getDriverForClient } from '../../utils/calendarAuth';
import { CreateTripDto, UpdateTripDto } from './types';

function normalizeTripType(tripType: CreateTripDto['trip_type']): 'ida' | 'ida_y_vuelta' | 'especial' {
  if (typeof tripType === 'boolean') {
    return tripType ? 'ida' : 'ida_y_vuelta';
  }

  const normalized = tripType.trim().toLowerCase();

  if (normalized === 'ida') return 'ida';
  if (normalized === 'ida y vuelta' || normalized === 'ida_y_vuelta') return 'ida_y_vuelta';
  if (normalized === 'especial') return 'especial';

  throw new AppError('trip_type must be "ida", "ida y vuelta", "especial", or boolean', 400);
}

async function findOrCreateRateForTrip(client_id: bigint, route_id: bigint, trip_type: string): Promise<{ id: bigint; base_price: number }> {
  // 1. Look for rate specific to this route
  let rate = await prisma.rates.findFirst({
    where: {
      client_id,
      route_id,
      trip_type: trip_type as any,
    },
    select: { id: true, base_price: true },
  });

  if (rate) {
    return { id: rate.id, base_price: Number(rate.base_price) };
  }

  // 2. Fallback: look for a general rate for this client (without route_id)
  rate = await prisma.rates.findFirst({
    where: {
      client_id,
      route_id: null,
      trip_type: trip_type as any,
    },
    select: { id: true, base_price: true },
  });

  if (rate) {
    return { id: rate.id, base_price: Number(rate.base_price) };
  }

  // 3. Create a new rate for this specific route
  const newRate = await prisma.rates.create({
    data: {
      client_id,
      route_id,
      trip_type: trip_type as any,
      base_price: 0,
      start_date: new Date(),
    },
    select: { id: true, base_price: true },
  });

  return { id: newRate.id, base_price: Number(newRate.base_price) };
}

export const tripService = {

  async getAll(user?: AuthUser) {
    if (!user) {
      return prisma.trips.findMany({
        include: { clients: true, routes: true, rates: true, users: true },
        orderBy: { trip_date: 'desc' },
      })
    }

    if (user.role === 'DRIVER') {
      const clientIds = await getDriverClients(user.dbId)
      const filters: any[] = [{ user_id: user.dbId }]
      if (clientIds.length > 0) {
        filters.push({ client_id: { in: clientIds } })
      }
      return prisma.trips.findMany({
        where: { OR: filters },
        include: { clients: true, routes: true, rates: true, users: true },
        orderBy: { trip_date: 'desc' },
      })
    }

    if (user.role === 'PASSENGER') {
      const clientIds = await getPassengerClients(user.dbId)
      const driverIds: bigint[] = []
      for (const cid of clientIds) {
        const did = await getDriverForClient(cid)
        if (did) driverIds.push(did)
      }

      return prisma.trips.findMany({
        where: {
          OR: [
            ...(clientIds.length > 0 ? [{ client_id: { in: clientIds } }] : []),
            ...(driverIds.length > 0 ? [{ user_id: { in: driverIds } }] : []),
          ],
        },
        include: { clients: true, routes: true, rates: true, users: true },
        orderBy: { trip_date: 'desc' },
      })
    }

    return prisma.trips.findMany({
      include: { clients: true, routes: true, rates: true, users: true },
      orderBy: { trip_date: 'desc' },
    })
  },

  async getById(id: bigint, user?: AuthUser) {
    const trip = await prisma.trips.findUnique({
      where: { id },
      include: { clients: true, routes: true, rates: true, users: true },
    })
    if (!trip) return null

    if (user) {
      const level = await getClientAccessLevel(user, trip.client_id)
      if (level === 'none') {
        const isOwnTrip = user.role === 'DRIVER' && trip.user_id === user.dbId
        if (!isOwnTrip) return null
      }
    }

    return trip
  },

  async getByClient(client_id: bigint, user?: AuthUser) {
    if (user) {
      const level = await getClientAccessLevel(user, client_id)
      if (level === 'none') {
        throw new AppError('No tienes acceso a este cliente', 403)
      }
    }

    return prisma.trips.findMany({
      where: { client_id },
      include: { routes: true, rates: true, users: true },
      orderBy: { trip_date: 'desc' },
    })
  },

  async getByDateRange(client_id: bigint, from: Date, to: Date, user?: AuthUser) {
    if (user) {
      const level = await getClientAccessLevel(user, client_id)
      if (level === 'none') {
        throw new AppError('No tienes acceso a este cliente', 403)
      }
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
    const client_id = BigInt(data.client_id)
    const route_id = BigInt(data.route_id)

    if (user) {
      const level = await getClientAccessLevel(user, client_id)
      if (level !== 'full') {
        throw new AppError('No tienes permisos para crear viajes para este cliente', 403)
      }
    }

    let user_id: bigint
    if (user?.role === 'DRIVER') {
      user_id = user.dbId
    } else if (user?.role === 'PASSENGER') {
      const driverId = await getDriverForClient(client_id)
      if (!driverId) throw new AppError('El cliente no tiene un chofer asignado', 400)
      user_id = driverId
    } else {
      throw new AppError('Usuario no autorizado', 403)
    }

    const trip_type = normalizeTripType(data.trip_type);

    let rate_id: bigint;
    let final_price: number;

    if (data.rate_id) {
      rate_id = BigInt(data.rate_id);
      final_price = data.final_price ?? 0;
    } else {
      const rateData = await findOrCreateRateForTrip(client_id, route_id, trip_type);
      rate_id = rateData.id;
      final_price = rateData.base_price;
    }

    return prisma.trips.create({
      data: {
        user_id,
        client_id,
        route_id,
        rate_id,
        trip_date: new Date(data.trip_date),
        trip_type,
        final_price,
        has_surcharge: data.has_surcharge ?? false,
        surcharge_reason: data.surcharge_reason,
        special_type: data.special_type,
        notes: data.notes,
      },
      include: { clients: true, routes: true, rates: true },
    });
  },

  async update(id: bigint, data: UpdateTripDto, user?: AuthUser) {
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { client_id: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    if (user) {
      const level = await getClientAccessLevel(user, trip.client_id)
      if (level !== 'full') {
        throw new AppError('No tienes permisos para modificar este viaje', 403)
      }
    }

    return prisma.trips.update({
      where: { id },
      data: {
        ...(data.trip_date    && { trip_date: new Date(data.trip_date) }),
        ...(data.trip_type    !== undefined && { trip_type: normalizeTripType(data.trip_type) }),
        ...(data.final_price  !== undefined && { final_price: data.final_price }),
        ...(data.has_surcharge !== undefined && { has_surcharge: data.has_surcharge }),
        ...(data.surcharge_reason !== undefined && { surcharge_reason: data.surcharge_reason }),
        ...(data.special_type !== undefined && { special_type: data.special_type }),
        ...(data.notes        !== undefined && { notes: data.notes }),
        ...(data.route_id     && { route_id: BigInt(data.route_id) }),
        ...(data.rate_id      && { rate_id:  BigInt(data.rate_id) }),
      },
    });
  },

  async delete(id: bigint, user?: AuthUser) {
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { client_id: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    if (user) {
      const level = await getClientAccessLevel(user, trip.client_id)
      if (level !== 'full') {
        throw new AppError('No tienes permisos para eliminar este viaje', 403)
      }
    }

    return prisma.trips.delete({ where: { id } });
  },

  async startTrip(id: bigint, lat: number, lng: number, user?: AuthUser) {
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { client_id: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    if (user) {
      const level = await getClientAccessLevel(user, trip.client_id)
      if (level !== 'full') {
        throw new AppError('No tienes permisos para iniciar este viaje', 403)
      }
    }

    return prisma.trips.update({
      where: { id },
      data: {
        started_at: new Date(),
        start_lat: lat,
        start_lng: lng,
      },
      include: { clients: true, routes: true, rates: true },
    });
  },

  async addStop(id: bigint, lat: number, lng: number, user?: AuthUser) {
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { client_id: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    if (user) {
      const level = await getClientAccessLevel(user, trip.client_id)
      if (level !== 'full') {
        throw new AppError('No tienes permisos para marcar paradas en este viaje', 403)
      }
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
    const trip = await prisma.trips.findUnique({
      where: { id },
      select: { client_id: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    if (user) {
      const level = await getClientAccessLevel(user, trip.client_id)
      if (level !== 'full') {
        throw new AppError('No tienes permisos para finalizar este viaje', 403)
      }
    }

    return prisma.trips.update({
      where: { id },
      data: {
        ended_at: new Date(),
        end_lat: lat,
        end_lng: lng,
      },
      include: { clients: true, routes: true, rates: true },
    });
  },
};
