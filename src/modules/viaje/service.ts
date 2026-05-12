import { prisma } from '../../config/prisma';
import { CreateTripDto, UpdateTripDto } from './types';
import { AppError } from '../../utils/AppError';
import { toBigInt } from '../../utils/toBigInt';

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

export const viajeService = {
  async list() {
    return prisma.trips.findMany({
      include: {
        clients: true,
        routes: true,
        rates: true,
        users: true,
      },
      orderBy: { trip_date: 'desc' },
    });
  },

  async getById(id: string) {
    const bid = toBigInt(id);
    return prisma.trips.findUnique({
      where: { id: bid },
      include: {
        clients: true,
        routes: {
          include: { route_stops: true },
        },
        rates: true,
        users: true,
        summaries: true,
      },
    });
  },

  async getByClient(client_id: string | number | bigint) {
    const cid = toBigInt(client_id);
    return prisma.trips.findMany({
      where: { client_id: cid },
      include: { routes: true, rates: true },
      orderBy: { trip_date: 'desc' },
    });
  },

  async getByDateRange(from: Date, to: Date) {
    return prisma.trips.findMany({
      where: {
        trip_date: { gte: from, lte: to },
      },
      include: { clients: true, routes: true, users: true },
      orderBy: { trip_date: 'asc' },
    });
  },

  async create(data: CreateTripDto) {
    return prisma.trips.create({
      data: {
        user_id: toBigInt(data.user_id),
        client_id: toBigInt(data.client_id),
        route_id: toBigInt(data.route_id),
        rate_id: toBigInt(data.rate_id),
        trip_date: new Date(data.trip_date),
        trip_type: normalizeTripType(data.trip_type),
        final_price: data.final_price,
        has_surcharge: data.has_surcharge ?? false,
        surcharge_reason: data.surcharge_reason,
        special_type: data.special_type,
        notes: data.notes,
        summary_id: data.summary_id ? toBigInt(data.summary_id) : undefined,
      },
      include: { clients: true, routes: true, rates: true },
    });
  },

  async update(id: string, data: UpdateTripDto) {
    const bid = toBigInt(id);
    return prisma.trips.update({
      where: { id: bid },
      data: {
        ...(data.user_id && { user_id: toBigInt(data.user_id) }),
        ...(data.client_id && { client_id: toBigInt(data.client_id) }),
        ...(data.route_id && { route_id: toBigInt(data.route_id) }),
        ...(data.rate_id && { rate_id: toBigInt(data.rate_id) }),
        ...(data.trip_date && { trip_date: new Date(data.trip_date as string) }),
        ...(data.trip_type !== undefined && { trip_type: normalizeTripType(data.trip_type) }),
        ...(data.final_price !== undefined && { final_price: data.final_price }),
        ...(data.has_surcharge !== undefined && { has_surcharge: data.has_surcharge }),
        ...(data.surcharge_reason !== undefined && { surcharge_reason: data.surcharge_reason }),
        ...(data.special_type !== undefined && { special_type: data.special_type }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.summary_id && { summary_id: toBigInt(data.summary_id) }),
      },
    });
  },

  async remove(id: string) {
    const bid = toBigInt(id);
    return prisma.trips.delete({ where: { id: bid } });
  },
};