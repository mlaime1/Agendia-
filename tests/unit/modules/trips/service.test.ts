jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    trips: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    clients: {
      findUnique: jest.fn(),
    },
    client_passengers: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    rates: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('../../../../src/lib/supabase', () => ({
  supabase: {},
}))

jest.mock('../../../../src/utils/calendarAuth', () => ({
  getClientAccessLevel: jest.fn(),
  getDriverClients: jest.fn(),
  getPassengerClients: jest.fn(),
  getDriverForClient: jest.fn(),
}))

import { tripService } from '../../../../src/modules/trips/service'
import { prisma } from '../../../../src/config/prisma'
import * as calendarAuth from '../../../../src/utils/calendarAuth'

const mockPrisma = prisma as any
const mockCalendarAuth = calendarAuth as jest.Mocked<typeof calendarAuth>

const driverUser = { authId: 'driver-auth', role: 'DRIVER' as const, dbId: BigInt(1) }
const passengerUser = { authId: 'pass-auth', role: 'PASSENGER' as const, dbId: BigInt(10) }

describe('trips/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAll', () => {
    it('should return all trips when no user provided', async () => {
      const mockTrips = [{ id: BigInt(1), trip_type: 'ida' }]
      mockPrisma.trips.findMany.mockResolvedValue(mockTrips)

      const result = await tripService.getAll()

      expect(result).toEqual(mockTrips)
      expect(mockPrisma.trips.findMany).toHaveBeenCalledWith({
        include: { clients: true, routes: true, rates: true, users: true },
        orderBy: { trip_date: 'desc' },
      })
    })

    it('should filter by driver trips and client trips for DRIVER role', async () => {
      const mockTrips = [{ id: BigInt(1) }]
      mockCalendarAuth.getDriverClients.mockResolvedValue([BigInt(5), BigInt(6)])
      mockPrisma.trips.findMany.mockResolvedValue(mockTrips)

      const result = await tripService.getAll(driverUser)

      expect(result).toEqual(mockTrips)
      expect(mockPrisma.trips.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { user_id: BigInt(1) },
            { client_id: { in: [BigInt(5), BigInt(6)] } },
          ],
        },
        include: { clients: true, routes: true, rates: true, users: true },
        orderBy: { trip_date: 'desc' },
      })
    })

    it('should filter by passenger-linked clients for PASSENGER role', async () => {
      const mockTrips = [{ id: BigInt(1) }]
      mockCalendarAuth.getPassengerClients.mockResolvedValue([BigInt(5)])
      mockCalendarAuth.getDriverForClient.mockResolvedValue(BigInt(1))
      mockPrisma.trips.findMany.mockResolvedValue(mockTrips)

      const result = await tripService.getAll(passengerUser)

      expect(result).toEqual(mockTrips)
      expect(mockCalendarAuth.getPassengerClients).toHaveBeenCalledWith(BigInt(10))
    })
  })

  describe('getById', () => {
    it('should return a trip by id', async () => {
      const mockTrip = { id: BigInt(1), client_id: BigInt(5) }
      mockPrisma.trips.findUnique.mockResolvedValue(mockTrip)

      const result = await tripService.getById(BigInt(1))

      expect(result).toEqual(mockTrip)
      expect(mockPrisma.trips.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        include: { clients: true, routes: true, rates: true, users: true },
      })
    })

    it('should enforce access level when user provided', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')

      const result = await tripService.getById(BigInt(1), driverUser)

      expect(result).toEqual({ id: BigInt(1), client_id: BigInt(5) })
    })

    it('should return null if user has no access', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('none')

      const result = await tripService.getById(BigInt(1), passengerUser)

      expect(result).toBeNull()
    })
  })

  describe('getByClient', () => {
    it('should return trips for a client when user has access', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      const mockTrips = [{ id: BigInt(1), client_id: BigInt(5) }]
      mockPrisma.trips.findMany.mockResolvedValue(mockTrips)

      const result = await tripService.getByClient(BigInt(5), driverUser)

      expect(result).toEqual(mockTrips)
    })

    it('should throw if user has no access', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('none')

      await expect(tripService.getByClient(BigInt(5), driverUser)).rejects.toThrow('No tienes acceso')
    })
  })

  describe('getByDateRange', () => {
    it('should return trips within date range when user has access', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      const from = new Date('2025-01-01')
      const to = new Date('2025-01-31')
      const mockTrips = [{ id: BigInt(1) }]
      mockPrisma.trips.findMany.mockResolvedValue(mockTrips)

      const result = await tripService.getByDateRange(BigInt(5), from, to, driverUser)

      expect(result).toEqual(mockTrips)
    })
  })

  describe('create', () => {
    it('should create a trip for DRIVER using their own id', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.rates.findFirst.mockResolvedValue({ id: BigInt(20), base_price: 5000 })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 5000 })

      const result = await tripService.create({
        client_id: '5',
        route_id: '3',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      }, driverUser)

      expect(result).toEqual({ id: BigInt(1), final_price: 5000 })
      expect(mockPrisma.trips.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ user_id: BigInt(1) }),
        })
      )
    })

    it('should create a trip for PASSENGER using their driver id', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockCalendarAuth.getDriverForClient.mockResolvedValue(BigInt(2))
      mockPrisma.rates.findFirst.mockResolvedValue({ id: BigInt(20), base_price: 5000 })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 5000 })

      const result = await tripService.create({
        client_id: '5',
        route_id: '3',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      }, passengerUser)

      expect(mockPrisma.trips.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ user_id: BigInt(2) }),
        })
      )
    })

    it('should throw if user has no write access', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('read-only')

      await expect(tripService.create({
        client_id: '5',
        route_id: '3',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      }, driverUser)).rejects.toThrow('No tienes permisos')
    })

    it('should create a new rate if none exists', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.rates.findFirst.mockResolvedValue(null)
      mockPrisma.rates.create.mockResolvedValue({ id: BigInt(30), base_price: 0 })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 0 })

      await tripService.create({
        client_id: '5',
        route_id: '3',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      }, driverUser)

      expect(mockPrisma.rates.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          client_id: BigInt(5),
          trip_type: 'ida',
          base_price: 0,
        }),
        select: { id: true, base_price: true },
      })
    })
  })

  describe('update', () => {
    it('should update a trip when user has full access', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.trips.update.mockResolvedValue({ id: BigInt(1), final_price: 7000 })

      const result = await tripService.update(BigInt(1), { final_price: 7000 }, driverUser)

      expect(result).toEqual({ id: BigInt(1), final_price: 7000 })
    })

    it('should throw if user has no write access', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('read-only')

      await expect(tripService.update(BigInt(1), { final_price: 7000 }, driverUser)).rejects.toThrow('No tienes permisos')
    })
  })

  describe('delete', () => {
    it('should delete a trip when user has full access', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.trips.delete.mockResolvedValue({ id: BigInt(1) })

      const result = await tripService.delete(BigInt(1), driverUser)

      expect(result).toEqual({ id: BigInt(1) })
    })

    it('should throw if user has no write access', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('none')

      await expect(tripService.delete(BigInt(1), driverUser)).rejects.toThrow('No tienes permisos')
    })
  })
})
