jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    passenger: { findUnique: jest.fn() },
    passenger_client_access: { findUnique: jest.fn() },
  },
}))

import { prisma } from '../../../src/config/prisma'
import { getClientAccessLevel, canCreateTrips } from '../../../src/utils/calendarAuth'

const mockPrisma = prisma as any

describe('calendarAuth/getClientAccessLevel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('denies unknown roles by default', async () => {
    await expect(getClientAccessLevel(
      { authId: 'unknown', role: 'UNKNOWN' as any, dbId: BigInt(99) },
      BigInt(5),
    )).resolves.toBe('none')
    expect(mockPrisma.passenger.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.passenger_client_access.findUnique).not.toHaveBeenCalled()
  })

  it('denies a driver after the client is reassigned', async () => {
    mockPrisma.passenger.findUnique.mockResolvedValue({ driver_id: BigInt(2) })

    await expect(getClientAccessLevel(
      { authId: 'driver', role: 'DRIVER', dbId: BigInt(1) },
      BigInt(5),
    )).resolves.toBe('none')
  })

  it('grants read-only to a self-managed passenger', async () => {
    await expect(getClientAccessLevel(
      { authId: 'passenger', role: 'CLIENT', dbId: BigInt(5), passengerId: BigInt(5) },
      BigInt(5),
    )).resolves.toBe('read-only')
    expect(mockPrisma.passenger_client_access.findUnique).not.toHaveBeenCalled()
  })

  it('grants read-only to a linked client account', async () => {
    mockPrisma.passenger_client_access.findUnique.mockResolvedValue({ passenger_id: BigInt(5) })

    await expect(getClientAccessLevel(
      { authId: 'client', role: 'CLIENT', dbId: BigInt(7) },
      BigInt(5),
    )).resolves.toBe('read-only')
  })
})

describe('calendarAuth/canCreateTrips', () => {
  beforeEach(() => jest.clearAllMocks())

  it('allows admins', async () => {
    await expect(canCreateTrips(
      { authId: 'admin', role: 'ADMIN', dbId: BigInt(1) },
      BigInt(5),
    )).resolves.toBe(true)
  })

  it('allows the owning driver', async () => {
    mockPrisma.passenger.findUnique.mockResolvedValue({ driver_id: BigInt(1) })

    await expect(canCreateTrips(
      { authId: 'driver', role: 'DRIVER', dbId: BigInt(1) },
      BigInt(5),
    )).resolves.toBe(true)
  })

  it('denies a driver that does not own the passenger', async () => {
    mockPrisma.passenger.findUnique.mockResolvedValue({ driver_id: BigInt(2) })

    await expect(canCreateTrips(
      { authId: 'driver', role: 'DRIVER', dbId: BigInt(1) },
      BigInt(5),
    )).resolves.toBe(false)
  })

  it('allows a self-managed passenger', async () => {
    await expect(canCreateTrips(
      { authId: 'passenger', role: 'CLIENT', dbId: BigInt(5), passengerId: BigInt(5) },
      BigInt(5),
    )).resolves.toBe(true)
  })

  it('allows a linked client account and denies unrelated ones', async () => {
    mockPrisma.passenger_client_access.findUnique.mockResolvedValueOnce({ passenger_id: BigInt(5) })
    await expect(canCreateTrips(
      { authId: 'client', role: 'CLIENT', dbId: BigInt(7) },
      BigInt(5),
    )).resolves.toBe(true)

    mockPrisma.passenger_client_access.findUnique.mockResolvedValueOnce(null)
    await expect(canCreateTrips(
      { authId: 'client', role: 'CLIENT', dbId: BigInt(7) },
      BigInt(5),
    )).resolves.toBe(false)
  })
})
