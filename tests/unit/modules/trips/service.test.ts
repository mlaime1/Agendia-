jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    trips: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
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

import { tripService } from '../../../../src/modules/trips/service'
import { prisma } from '../../../../src/config/prisma'

const mockPrisma = prisma as any

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

describe('trips/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAll', () => {
    it('should return all trips with includes', async () => {
      const mockTrips = [{ id: BigInt(1), trip_type: 'ida' }]
      mockPrisma.trips.findMany.mockResolvedValue(mockTrips)

      const result = await tripService.getAll()

      expect(result).toEqual(mockTrips)
      expect(mockPrisma.trips.findMany).toHaveBeenCalledWith({
        include: { clients: true, routes: true, rates: true, users: true },
        orderBy: { trip_date: 'desc' },
      })
    })
  })

  describe('getById', () => {
    it('should return a trip by id', async () => {
      const mockTrip = { id: BigInt(1), trip_type: 'ida' }
      mockPrisma.trips.findUnique.mockResolvedValue(mockTrip)

      const result = await tripService.getById(BigInt(1))

      expect(result).toEqual(mockTrip)
      expect(mockPrisma.trips.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        include: { clients: true, routes: true, rates: true, users: true },
      })
    })
  })

  describe('getByClient', () => {
    it('should return trips for a specific client', async () => {
      const mockTrips = [{ id: BigInt(1), client_id: BigInt(5) }]
      mockPrisma.trips.findMany.mockResolvedValue(mockTrips)

      const result = await tripService.getByClient(BigInt(5))

      expect(result).toEqual(mockTrips)
      expect(mockPrisma.trips.findMany).toHaveBeenCalledWith({
        where: { client_id: BigInt(5) },
        include: { routes: true, rates: true, users: true },
        orderBy: { trip_date: 'desc' },
      })
    })
  })

  describe('getByDateRange', () => {
    it('should return trips within date range', async () => {
      const from = new Date('2025-01-01')
      const to = new Date('2025-01-31')
      const mockTrips = [{ id: BigInt(1) }]
      mockPrisma.trips.findMany.mockResolvedValue(mockTrips)

      const result = await tripService.getByDateRange(BigInt(1), from, to)

      expect(result).toEqual(mockTrips)
      expect(mockPrisma.trips.findMany).toHaveBeenCalledWith({
        where: {
          client_id: BigInt(1),
          trip_date: { gte: from, lte: to },
        },
        include: { routes: true, rates: true, users: true },
        orderBy: { trip_date: 'asc' },
      })
    })
  })

  describe('create', () => {
    it('should create a trip with auto rate lookup (UUID user_id)', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ id: BigInt(10) })
      mockPrisma.rates.findFirst.mockResolvedValue({ id: BigInt(20), base_price: 5000 })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 5000 })

      const result = await tripService.create({
        user_id: VALID_UUID,
        client_id: '5',
        route_id: '3',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      })

      expect(result).toEqual({ id: BigInt(1), final_price: 5000 })
      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { auth_id: VALID_UUID },
        select: { id: true },
      })
      expect(mockPrisma.rates.findFirst).toHaveBeenCalled()
      expect(mockPrisma.trips.create).toHaveBeenCalled()
    })

    it('should create a trip with numeric user_id', async () => {
      mockPrisma.rates.findFirst.mockResolvedValue({ id: BigInt(20), base_price: 5000 })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 5000 })

      const result = await tripService.create({
        user_id: '10',
        client_id: '5',
        route_id: '3',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      })

      expect(result).toEqual({ id: BigInt(1), final_price: 5000 })
      expect(mockPrisma.users.findUnique).not.toHaveBeenCalled()
      expect(mockPrisma.trips.create).toHaveBeenCalled()
    })

    it('should use provided rate_id when given', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ id: BigInt(10) })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 3000 })

      const result = await tripService.create({
        user_id: VALID_UUID,
        client_id: '5',
        route_id: '3',
        rate_id: '20',
        final_price: 3000,
        trip_date: '2025-06-01',
        trip_type: 'ida',
      })

      expect(mockPrisma.rates.findFirst).not.toHaveBeenCalled()
      expect(mockPrisma.trips.create).toHaveBeenCalled()
    })

    it('should create a new rate if none exists for client', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ id: BigInt(10) })
      mockPrisma.rates.findFirst.mockResolvedValue(null)
      mockPrisma.rates.create.mockResolvedValue({ id: BigInt(30), base_price: 0 })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 0 })

      await tripService.create({
        user_id: VALID_UUID,
        client_id: '5',
        route_id: '3',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      })

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
    it('should update a trip', async () => {
      mockPrisma.trips.update.mockResolvedValue({ id: BigInt(1), final_price: 7000 })

      const result = await tripService.update(BigInt(1), { final_price: 7000 })

      expect(result).toEqual({ id: BigInt(1), final_price: 7000 })
      expect(mockPrisma.trips.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: expect.objectContaining({ final_price: 7000 }),
      })
    })
  })

  describe('delete', () => {
    it('should delete a trip', async () => {
      mockPrisma.trips.delete.mockResolvedValue({ id: BigInt(1) })

      const result = await tripService.delete(BigInt(1))

      expect(result).toEqual({ id: BigInt(1) })
      expect(mockPrisma.trips.delete).toHaveBeenCalledWith({ where: { id: BigInt(1) } })
    })
  })
})
