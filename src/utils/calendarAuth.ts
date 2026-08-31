import { $Enums } from '@prisma/client'
import { prisma } from '../config/prisma'

export type AccessLevel = 'full' | 'read-only' | 'none'

export interface AuthUser {
  authId: string
  role: $Enums.Role | 'client'
  dbId: bigint
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
    const client = await prisma.clients.findUnique({
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

  if (user.role === 'PASSENGER') {
    const link = await prisma.client_passengers.findUnique({
      where: { client_id_user_id: { client_id: clientId, user_id: user.dbId } },
    })
    if (link) return 'full'
    return 'none'
  }

  if (user.role === 'client') {
    return user.dbId === clientId ? 'full' : 'none'
  }

  return 'none'
}

export async function getDriverClients(driverId: bigint): Promise<bigint[]> {
  const clients = await prisma.clients.findMany({
    where: { driver_id: driverId },
    select: { id: true },
  })
  return clients.map((c) => c.id)
}

export async function getPassengerClients(userId: bigint): Promise<bigint[]> {
  const links = await prisma.client_passengers.findMany({
    where: { user_id: userId },
    select: { client_id: true },
  })
  return links.map((l) => l.client_id)
}

export async function getDriverForClient(clientId: bigint): Promise<bigint | null> {
  const client = await prisma.clients.findUnique({
    where: { id: clientId },
    select: { driver_id: true },
  })
  return client?.driver_id ?? null
}
