import { $Enums } from '@prisma/client'
import { prisma } from '../config/prisma'

export type AccessLevel = 'full' | 'read-only' | 'none'

export interface AuthUser {
  authId: string
  role: $Enums.Role
  dbId: bigint
  passengerId?: bigint
}

export async function isBillingActive(clientId: bigint): Promise<boolean> {
  const lastSummary = await prisma.summaries.findFirst({
    where: { client_id: clientId },
    orderBy: { period_end: 'desc' },
    select: { period_end: true },
  })

  if (!lastSummary) return true

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const active = lastSummary.period_end >= now
  console.log(`[billing] clientId=${clientId} period_end=${lastSummary.period_end} now=${now} active=${active}`)
  return active
}

export async function getClientAccessLevel(user: AuthUser, clientId: bigint): Promise<AccessLevel> {
  if (user.role === 'ADMIN') {
    return 'full'
  }

  if (user.role === 'DRIVER') {
    const client = await prisma.passenger.findUnique({
      where: { id: clientId },
      select: { driver_id: true },
    })
    console.log(`[access] DRIVER user.dbId=${user.dbId} clientId=${clientId} client.driver_id=${client?.driver_id}`)
    if (!client || client.driver_id !== user.dbId) {
      console.log(`[access] -> none (driver mismatch)`)
      return 'none'
    }
    console.log(`[access] -> full`)
    return 'full'
  }

  if (user.role === 'CLIENT') {
    // Self-managed passenger: the auth account is linked directly to the passenger row.
    if (user.passengerId != null && user.passengerId === clientId) {
      return 'read-only'
    }

    const link = await prisma.passenger_client_access.findUnique({
      where: {
        passenger_id_client_user_id: {
          passenger_id: clientId,
          client_user_id: user.dbId,
        },
      },
    })
    if (link) return 'read-only'
    return 'none'
  }

  return 'none'
}

export async function canCreateTrips(user: AuthUser, passengerId: bigint): Promise<boolean> {
  if (user.role === 'ADMIN') {
    return true
  }

  if (user.role === 'DRIVER') {
    const client = await prisma.passenger.findUnique({
      where: { id: passengerId },
      select: { driver_id: true },
    })
    return !!client && client.driver_id === user.dbId
  }

  if (user.role === 'CLIENT') {
    if (user.passengerId != null && user.passengerId === passengerId) {
      return true
    }

    const link = await prisma.passenger_client_access.findUnique({
      where: {
        passenger_id_client_user_id: {
          passenger_id: passengerId,
          client_user_id: user.dbId,
        },
      },
    })
    return !!link
  }

  return false
}

export async function getDriverClients(driverId: bigint): Promise<bigint[]> {
  const clients = await prisma.passenger.findMany({
    where: { driver_id: driverId },
    select: { id: true },
  })
  return clients.map((c) => c.id)
}

export async function getPassengerClients(userId: bigint): Promise<bigint[]> {
  const links = await prisma.passenger_client_access.findMany({
    where: { client_user_id: userId },
    select: { passenger_id: true },
  })
  return links.map((l) => l.passenger_id)
}

export async function getDriverForClient(clientId: bigint): Promise<bigint | null> {
  const client = await prisma.passenger.findUnique({
    where: { id: clientId },
    select: { driver_id: true },
  })
  return client?.driver_id ?? null
}
