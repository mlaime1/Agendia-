jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    clients: { findUnique: jest.fn() },
    client_passengers: { findUnique: jest.fn() },
  },
}))

import { prisma } from '../../../src/config/prisma'
import { getClientAccessLevel } from '../../../src/utils/calendarAuth'

const mockPrisma = prisma as any

describe('calendarAuth/getClientAccessLevel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('denies unknown roles by default', async () => {
    await expect(getClientAccessLevel(
      { authId: 'unknown', role: 'UNKNOWN' as any, dbId: BigInt(99) },
      BigInt(5),
    )).resolves.toBe('none')
    expect(mockPrisma.clients.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.client_passengers.findUnique).not.toHaveBeenCalled()
  })

  it('denies a driver after the client is reassigned', async () => {
    mockPrisma.clients.findUnique.mockResolvedValue({ driver_id: BigInt(2) })

    await expect(getClientAccessLevel(
      { authId: 'driver', role: 'DRIVER', dbId: BigInt(1) },
      BigInt(5),
    )).resolves.toBe('none')
  })
})
