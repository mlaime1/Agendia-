import { prisma } from '../../config/prisma'
import { AppError } from '../../utils/AppError'
import { normalizeTripType } from '../../utils/tripType'
import { AuthUser, getClientAccessLevel } from '../../utils/calendarAuth'
import {
  CreateItineraryDto,
  UpdateItineraryDto,
  CreateStopDto,
  UpdateStopDto,
  CreateRateDto,
  UpdateRateDto,
  MatchRequestDto,
  MatchResultDto,
} from './types'

// ─── Haversine distance ────────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371 // Earth radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getClientIdForItinerary(itineraryId: bigint): Promise<bigint | null> {
  const route = await prisma.routes.findUnique({
    where: { id: itineraryId },
    select: { client_id: true },
  })
  return route?.client_id ?? null
}

async function requireFullAccess(
  user: AuthUser | undefined,
  clientId: bigint,
  context: string,
): Promise<void> {
  if (!user) return
  const level = await getClientAccessLevel(user, clientId)
  if (level !== 'full') {
    throw new AppError(`No tienes permisos para ${context}`, 403)
  }
}

// ─── Itinerary CRUD ───────────────────────────────────────────────────────────

export const itineraryService = {
  async getAll(user?: AuthUser) {
    if (!user) {
      return prisma.routes.findMany({
        include: { route_stops: true, rates: true },
        orderBy: { name: 'asc' },
      })
    }

    if (user.role === 'DRIVER') {
      const clientIds = await prisma.clients.findMany({
        where: { driver_id: user.dbId },
        select: { id: true },
      })
      return prisma.routes.findMany({
        where: {
          client_id: {
            in: clientIds.map((c) => c.id),
          },
        },
        include: { route_stops: true, rates: true },
        orderBy: { name: 'asc' },
      })
    }

    return prisma.routes.findMany({
      include: { route_stops: true, rates: true },
      orderBy: { name: 'asc' },
    })
  },

  async getById(id: string, user?: AuthUser) {
    const route = await prisma.routes.findUnique({
      where: { id: BigInt(id) },
      include: {
        route_stops: { orderBy: { stop_order: 'asc' } },
        rates: true,
      },
    })

    if (!route) throw new AppError('Itinerario no encontrado', 404)

    if (user && route.client_id) {
      const level = await getClientAccessLevel(user, route.client_id)
      if (level === 'none') {
        throw new AppError('No tienes acceso a este itinerario', 403)
      }
    }

    return route
  },

  async create(dto: CreateItineraryDto, user?: AuthUser) {
    const clientId = BigInt(dto.client_id)
    await requireFullAccess(user, clientId, 'crear itinerarios')

    return prisma.routes.create({
      data: {
        name: dto.name,
        client_id: clientId,
      },
      include: { route_stops: true, rates: true },
    })
  },

  async update(id: string, dto: UpdateItineraryDto, user?: AuthUser) {
    const clientId = await getClientIdForItinerary(BigInt(id))
    if (clientId) {
      await requireFullAccess(user, clientId, 'editar itinerarios')
    }

    return prisma.routes.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
      },
      include: { route_stops: true, rates: true },
    })
  },

  async remove(id: string, user?: AuthUser) {
    const clientId = await getClientIdForItinerary(BigInt(id))
    if (clientId) {
      await requireFullAccess(user, clientId, 'eliminar itinerarios')
    }

    // Check if there are trips associated
    const tripCount = await prisma.trips.count({
      where: { route_id: BigInt(id) },
    })
    if (tripCount > 0) {
      throw new AppError(
        `No se puede eliminar: tiene ${tripCount} viaje(s) asociado(s)`,
        400,
      )
    }

    return prisma.routes.delete({
      where: { id: BigInt(id) },
    })
  },

  // ─── Stops ────────────────────────────────────────────────────────────────

  async getStops(itineraryId: string, user?: AuthUser) {
    const clientId = await getClientIdForItinerary(BigInt(itineraryId))
    if (clientId) {
      await requireFullAccess(user, clientId, 'ver paradas')
    }

    return prisma.route_stops.findMany({
      where: { route_id: BigInt(itineraryId) },
      orderBy: { stop_order: 'asc' },
    })
  },

  async createStop(itineraryId: string, dto: CreateStopDto, user?: AuthUser) {
    const clientId = await getClientIdForItinerary(BigInt(itineraryId))
    if (clientId) {
      await requireFullAccess(user, clientId, 'agregar paradas')
    }

    return prisma.route_stops.create({
      data: {
        route_id: BigInt(itineraryId),
        address: dto.address,
        stop_order: dto.stop_order ?? 1,
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
      },
    })
  },

  async updateStop(
    itineraryId: string,
    stopId: string,
    dto: UpdateStopDto,
    user?: AuthUser,
  ) {
    const clientId = await getClientIdForItinerary(BigInt(itineraryId))
    if (clientId) {
      await requireFullAccess(user, clientId, 'editar paradas')
    }

    return prisma.route_stops.update({
      where: { id: BigInt(stopId) },
      data: {
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.stop_order !== undefined && { stop_order: dto.stop_order }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
      },
    })
  },

  async removeStop(
    itineraryId: string,
    stopId: string,
    user?: AuthUser,
  ) {
    const clientId = await getClientIdForItinerary(BigInt(itineraryId))
    if (clientId) {
      await requireFullAccess(user, clientId, 'eliminar paradas')
    }

    return prisma.route_stops.delete({
      where: { id: BigInt(stopId) },
    })
  },

  // ─── Rates ────────────────────────────────────────────────────────────────

  async getRates(itineraryId: string, user?: AuthUser) {
    const clientId = await getClientIdForItinerary(BigInt(itineraryId))
    if (clientId) {
      await requireFullAccess(user, clientId, 'ver tarifas')
    }

    return prisma.rates.findMany({
      where: { route_id: BigInt(itineraryId) },
    })
  },

  async createRate(
    itineraryId: string,
    dto: CreateRateDto,
    user?: AuthUser,
  ) {
    const clientId = await getClientIdForItinerary(BigInt(itineraryId))
    if (clientId) {
      await requireFullAccess(user, clientId, 'crear tarifas')
    }

    const tripType = normalizeTripType(dto.trip_type)

    const existing = await prisma.rates.findFirst({
      where: {
        route_id: BigInt(itineraryId),
        trip_type: tripType,
      },
    })
    if (existing) {
      throw new AppError(
        `Ya existe una tarifa para tipo '${dto.trip_type}' en este itinerario`,
        409,
      )
    }

    return prisma.rates.create({
      data: {
        route_id: BigInt(itineraryId),
        trip_type: tripType,
        base_price: dto.base_price,
        ...(dto.surcharge_price !== undefined && {
          surcharge_price: dto.surcharge_price,
        }),
        ...(dto.start_date && { start_date: new Date(dto.start_date) }),
        ...(dto.end_date && { end_date: new Date(dto.end_date) }),
      },
    })
  },

  async updateRate(
    itineraryId: string,
    rateId: string,
    dto: UpdateRateDto,
    user?: AuthUser,
  ) {
    const clientId = await getClientIdForItinerary(BigInt(itineraryId))
    if (clientId) {
      await requireFullAccess(user, clientId, 'editar tarifas')
    }

    return prisma.rates.update({
      where: { id: BigInt(rateId) },
      data: {
        ...(dto.base_price !== undefined && { base_price: dto.base_price }),
        ...(dto.surcharge_price !== undefined && {
          surcharge_price: dto.surcharge_price,
        }),
        ...(dto.start_date !== undefined && {
          start_date: dto.start_date ? new Date(dto.start_date) : null,
        }),
        ...(dto.end_date !== undefined && {
          end_date: dto.end_date ? new Date(dto.end_date) : null,
        }),
      },
    })
  },

  async removeRate(
    itineraryId: string,
    rateId: string,
    user?: AuthUser,
  ) {
    const clientId = await getClientIdForItinerary(BigInt(itineraryId))
    if (clientId) {
      await requireFullAccess(user, clientId, 'eliminar tarifas')
    }

    return prisma.rates.delete({
      where: { id: BigInt(rateId) },
    })
  },

  // ─── Matching ─────────────────────────────────────────────────────────────

  async matchItinerary(dto: MatchRequestDto, user?: AuthUser): Promise<MatchResultDto | null> {
    const clientId = BigInt(dto.client_id)
    await requireFullAccess(user, clientId, 'buscar itinerario')

    const itineraries = await prisma.routes.findMany({
      where: { client_id: clientId },
      include: {
        route_stops: {
          orderBy: { stop_order: 'asc' },
        },
        rates: true,
      },
    })

    if (itineraries.length === 0) return null
    if (dto.points.length === 0) return null

    let bestMatch: MatchResultDto | null = null
    let bestDistance = Infinity

    for (const itinerary of itineraries) {
      const stops = itinerary.route_stops
      if (stops.length === 0) continue

      // Calculate total distance from each GPS point to the nearest stop
      let totalDistance = 0
      for (const point of dto.points) {
        let minDist = Infinity
        for (const stop of stops) {
          if (stop.lat == null || stop.lng == null) continue
          const dist = haversineDistance(
            point.lat,
            point.lng,
            Number(stop.lat),
            Number(stop.lng),
          )
          if (dist < minDist) minDist = dist
        }
        totalDistance += minDist
      }
      const avgDistance = totalDistance / dto.points.length

      if (avgDistance < bestDistance) {
        bestDistance = avgDistance
        const defaultRate = itinerary.rates.find((r) => r.trip_type === 'ida') ?? null
        bestMatch = {
          itinerary_id: itinerary.id,
          name: itinerary.name ?? '',
          distance_km: avgDistance,
          rate: defaultRate
            ? {
                id: defaultRate.id,
                trip_type: defaultRate.trip_type,
                base_price: Number(defaultRate.base_price),
              }
            : null,
        }
      }
    }

    return bestMatch
  },
}
