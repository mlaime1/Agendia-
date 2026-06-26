import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let userCounter = 0
let clientCounter = 0
let routeCounter = 0

export const createTestUser = async (overrides: Record<string, unknown> = {}) => {
  userCounter++
  const uniqueId = `test-user-${userCounter}-${Date.now()}`

  return prisma.users.create({
    data: {
      name: overrides.name ?? `Test User ${userCounter}`,
      email: overrides.email ?? `test${userCounter}@example.com`,
      auth_id: overrides.auth_id ?? uniqueId,
      role: overrides.role ?? 'DRIVER',
      ...Object.fromEntries(
        Object.entries(overrides).filter(([k]) => !['name', 'email', 'auth_id', 'role'].includes(k))
      ),
    },
  })
}

export const createTestClient = async (overrides: Record<string, unknown> = {}) => {
  clientCounter++
  const uniqueId = `test-client-${clientCounter}-${Date.now()}`

  return prisma.clients.create({
    data: {
      nombre: overrides.nombre ?? `Test Client ${clientCounter}`,
      phone: overrides.phone ?? 1111111111 + clientCounter,
      billing_cycle: overrides.billing_cycle ?? 'monthly',
      billing_day: overrides.billing_day ?? 1,
      auth_id: overrides.auth_id ?? uniqueId,
      ...Object.fromEntries(
        Object.entries(overrides).filter(([k]) => !['nombre', 'phone', 'billing_cycle', 'billing_day', 'auth_id'].includes(k))
      ),
    },
  })
}

export const createTestRoute = async (clientId: bigint, overrides: Record<string, unknown> = {}) => {
  routeCounter++

  return prisma.routes.create({
    data: {
      name: overrides.name ?? `Route ${routeCounter}`,
      client_id: clientId,
      ...Object.fromEntries(
        Object.entries(overrides).filter(([k]) => !['name', 'client_id'].includes(k))
      ),
    },
  })
}

export const createTestRate = async (clientId: bigint, overrides: Record<string, unknown> = {}) => {
  return prisma.rates.create({
    data: {
      client_id: clientId,
      base_price: overrides.base_price ?? 1000,
      trip_type: overrides.trip_type ?? 'ida',
      start_date: overrides.start_date ?? new Date(),
      ...Object.fromEntries(
        Object.entries(overrides).filter(([k]) => !['client_id', 'base_price', 'trip_type', 'start_date'].includes(k))
      ),
    },
  })
}

export const createTestTrip = async (
  userId: bigint,
  clientId: bigint,
  routeId: bigint,
  overrides: Record<string, unknown> = {}
) => {
  return prisma.trips.create({
    data: {
      user_id: userId,
      client_id: clientId,
      route_id: routeId,
      rate_id: overrides.rate_id ?? null,
      trip_date: overrides.trip_date ?? new Date(),
      trip_type: overrides.trip_type ?? 'ida',
      final_price: overrides.final_price ?? 1000,
      has_surcharge: overrides.has_surcharge ?? false,
      payment_status: overrides.payment_status ?? 'pending',
      paid_amount: overrides.paid_amount ?? 0,
      ...Object.fromEntries(
        Object.entries(overrides).filter(
          ([k]) => !['user_id', 'client_id', 'route_id', 'rate_id', 'trip_date', 'trip_type', 'final_price', 'has_surcharge'].includes(k)
        )
      ),
    },
  })
}

export const createTestSummary = async (
  clientId: bigint,
  driverId: bigint,
  overrides: Record<string, unknown> = {}
) => {
  return prisma.summaries.create({
    data: {
      client_id: clientId,
      driver_id: driverId,
      period_start: overrides.period_start ?? new Date('2025-01-01'),
      period_end: overrides.period_end ?? new Date('2025-01-31'),
      period_type: overrides.period_type ?? 'monthly',
      total_trips: overrides.total_trips ?? 0,
      total_amount: overrides.total_amount ?? 0,
      paid_amount: overrides.paid_amount ?? 0,
      status: overrides.status ?? 'draft',
      ...Object.fromEntries(
        Object.entries(overrides).filter(
          ([k]) => !['client_id', 'driver_id', 'period_start', 'period_end', 'period_type', 'total_trips', 'total_amount', 'status'].includes(k)
        )
      ),
    },
  })
}

export const resetCounters = () => {
  userCounter = 0
  clientCounter = 0
  routeCounter = 0
}
