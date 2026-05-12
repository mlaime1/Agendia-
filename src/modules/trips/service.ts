// src/modules/trips/service.ts

import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
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

export const tripService = {

  async getAll() {
    return prisma.trips.findMany({
      include: { clients: true, routes: true, rates: true, users: true },
      orderBy: { trip_date: 'desc' },
    });
  },

  async getById(id: bigint) {
    return prisma.trips.findUnique({
      where: { id },
      include: { clients: true, routes: true, rates: true, users: true },
    });
  },

  async getByClient(client_id: bigint) {
    return prisma.trips.findMany({
      where: { client_id },
      include: { routes: true, rates: true, users: true },
      orderBy: { trip_date: 'desc' },
    });
  },

  async getByDateRange(client_id: bigint, from: Date, to: Date) {
    return prisma.trips.findMany({
      where: {
        client_id,
        trip_date: { gte: from, lte: to },
      },
      include: { routes: true, rates: true, users: true },
      orderBy: { trip_date: 'asc' },
    });
  },

  async create(data: CreateTripDto) {
    return prisma.trips.create({
      data: {
        user_id:    BigInt(data.user_id),
        client_id:  BigInt(data.client_id),
        route_id:   BigInt(data.route_id),
        rate_id:    BigInt(data.rate_id),
        trip_date:  new Date(data.trip_date),
        trip_type:  normalizeTripType(data.trip_type),
        final_price: data.final_price,
        has_surcharge:   data.has_surcharge ?? false,
        surcharge_reason: data.surcharge_reason,
        special_type: data.special_type,
        notes: data.notes,
      },
      include: { clients: true, routes: true, rates: true },
    });
  },

  async update(id: bigint, data: UpdateTripDto) {
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

  async delete(id: bigint) {
    return prisma.trips.delete({ where: { id } });
  },
};