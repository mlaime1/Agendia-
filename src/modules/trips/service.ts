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

// Check if string is a UUID (Supabase auth_id format)
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Normalize user_id: if UUID, lookup in users table; if number, convert to BigInt
async function normalizeUserId(userIdStr: string): Promise<bigint> {
  // If it's a UUID, look it up in the users table by auth_id
  if (isUUID(userIdStr)) {
    const user = await prisma.users.findUnique({
      where: { auth_id: userIdStr },
      select: { id: true },
    });
    if (!user) {
      throw new AppError(
        `User with auth_id "${userIdStr}" not found. Create the user first.`,
        404
      );
    }
    return user.id;
  }

  // Otherwise, try to parse as BigInt
  try {
    return BigInt(userIdStr);
  } catch (error) {
    throw new AppError(
      `user_id must be a valid UUID or number, got "${userIdStr}"`,
      400
    );
  }
}

/**
 * Find or create a flat rate for a trip based on client_id and trip_type
 * If no rate exists, creates one with base_price = 0 (flat rate)
 * TODO: Implement date range validation (vigencia) in future iterations
 */
async function findOrCreateRateForTrip(client_id: bigint, trip_type: string): Promise<{ id: bigint; base_price: number }> {
  // Try to find existing rate
  let rate = await prisma.rates.findFirst({
    where: {
      client_id,
      trip_type: trip_type as any, // trip_type_enum
      // TODO: Add date range filtering when vigencia is implemented
      // start_date: { lte: tripDate }
      // end_date: { gte: tripDate }
    },
    select: { id: true, base_price: true },
  });

  // If rate exists, return it
  if (rate) {
    return { id: rate.id, base_price: Number(rate.base_price) };
  }

  // Create a new flat rate (base_price = 0)
  const newRate = await prisma.rates.create({
    data: {
      client_id,
      trip_type: trip_type as any, // trip_type_enum
      base_price: 0, // Flat rate
      start_date: new Date(),
    },
    select: { id: true, base_price: true },
  });

  return { id: newRate.id, base_price: Number(newRate.base_price) };
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
    // Normalize user_id: handles UUID lookup and BigInt conversion
    const user_id = await normalizeUserId(data.user_id);
    const client_id = BigInt(data.client_id);
    const route_id = BigInt(data.route_id);
    const trip_type = normalizeTripType(data.trip_type);

    // Auto-lookup or create rate if not provided
    let rate_id: bigint;
    let final_price: number;

    if (data.rate_id) {
      // Use provided rate_id
      rate_id = BigInt(data.rate_id);
      final_price = data.final_price ?? 0;
    } else {
      // Auto-lookup or create rate based on client_id and trip_type
      const rateData = await findOrCreateRateForTrip(client_id, trip_type);
      rate_id = rateData.id;
      final_price = data.final_price ?? rateData.base_price;
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