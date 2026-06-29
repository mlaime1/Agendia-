jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    trips: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    routes: {
      findUnique: jest.fn(),
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
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    trip_stops: {
      create: jest.fn(),
    },
    payments: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
      mockPrisma.routes.findUnique.mockResolvedValue({ is_active: true })
      mockPrisma.clients.findUnique.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' })
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
      mockPrisma.routes.findUnique.mockResolvedValue({ is_active: true })
      mockPrisma.clients.findUnique.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' })
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

    it('should create a new rate if none exists with route_id', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.routes.findUnique.mockResolvedValue({ is_active: true })
      mockPrisma.clients.findUnique.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' })
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
          route_id: BigInt(3),
          trip_type: 'ida',
          base_price: 0,
        }),
        select: { id: true, base_price: true },
      })
    })

    it('should use existing rate specific to route_id when available', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.routes.findUnique.mockResolvedValue({ is_active: true })
      mockPrisma.clients.findUnique.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' })
      mockPrisma.rates.findFirst.mockResolvedValueOnce({
        id: BigInt(20),
        base_price: 5000,
      })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 5000 })

      await tripService.create({
        client_id: '5',
        route_id: '3',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      }, driverUser)

      expect(mockPrisma.rates.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            client_id: BigInt(5),
            route_id: BigInt(3),
          }),
        }),
      )
    })

    it('should calculate final_price from rate_id base_price', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.routes.findUnique.mockResolvedValue({ is_active: true })
      mockPrisma.clients.findUnique.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' })
      mockPrisma.rates.findUnique.mockResolvedValue({
        id: BigInt(25),
        base_price: 6000,
        surcharge_price: null,
      })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 6000 })

      const result = await tripService.create({
        client_id: '5',
        route_id: '3',
        rate_id: '25',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      }, driverUser)

      expect(result).toEqual({ id: BigInt(1), final_price: 6000 })
      expect(mockPrisma.trips.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ final_price: 6000, rate_id: BigInt(25) }),
        })
      )
    })

    it('should add surcharge_price when rate_id and has_surcharge are provided', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.routes.findUnique.mockResolvedValue({ is_active: true })
      mockPrisma.clients.findUnique.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' })
      mockPrisma.rates.findUnique.mockResolvedValue({
        id: BigInt(25),
        base_price: 6000,
        surcharge_price: 1500,
      })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 7500 })

      const result = await tripService.create({
        client_id: '5',
        route_id: '3',
        rate_id: '25',
        trip_date: '2025-06-01',
        trip_type: 'ida',
        has_surcharge: true,
      }, driverUser)

      expect(result).toEqual({ id: BigInt(1), final_price: 7500 })
      expect(mockPrisma.trips.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ final_price: 7500 }),
        })
      )
    })

    it('should allow final_price override when rate_id is provided', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.routes.findUnique.mockResolvedValue({ is_active: true })
      mockPrisma.clients.findUnique.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' })
      mockPrisma.rates.findUnique.mockResolvedValue({
        id: BigInt(25),
        base_price: 6000,
        surcharge_price: null,
      })
      mockPrisma.trips.create.mockResolvedValue({ id: BigInt(1), final_price: 5500 })

      const result = await tripService.create({
        client_id: '5',
        route_id: '3',
        rate_id: '25',
        trip_date: '2025-06-01',
        trip_type: 'ida',
        final_price: 5500,
      }, driverUser)

      expect(result).toEqual({ id: BigInt(1), final_price: 5500 })
      expect(mockPrisma.trips.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ final_price: 5500 }),
        })
      )
    })

    it('should throw if rate_id does not exist', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.routes.findUnique.mockResolvedValue({ is_active: true })
      mockPrisma.clients.findUnique.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' })
      mockPrisma.rates.findUnique.mockResolvedValue(null)

      await expect(tripService.create({
        client_id: '5',
        route_id: '3',
        rate_id: '999',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      }, driverUser)).rejects.toThrow('Tarifa no encontrada')
    })

    it('should throw if route is inactive', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ is_active: false })

      await expect(tripService.create({
        client_id: '5',
        route_id: '3',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      }, driverUser)).rejects.toThrow('ruta eliminada')
    })

    it('should throw if route does not exist', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue(null)

      await expect(tripService.create({
        client_id: '5',
        route_id: '3',
        trip_date: '2025-06-01',
        trip_type: 'ida',
      }, driverUser)).rejects.toThrow('Ruta no encontrada')
    })
  })

  describe('update', () => {
    it('should update a trip when user has full access', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.clients.findUnique.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' })
      mockPrisma.trips.update.mockResolvedValue({ id: BigInt(1), final_price: 7000 })

      const result = await tripService.update(BigInt(1), { final_price: 7000 }, driverUser)

      expect(result).toEqual({ id: BigInt(1), final_price: 7000 })
    })

    it('should throw if user has no write access', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('read-only')

      await expect(tripService.update(BigInt(1), { final_price: 7000 }, driverUser)).rejects.toThrow('No tienes permisos')
    })

    it('should throw if new route is inactive', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockPrisma.routes.findUnique.mockResolvedValue({ is_active: false })

      await expect(tripService.update(BigInt(1), { route_id: '3' }, driverUser)).rejects.toThrow('ruta eliminada')
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

  describe('startTrip', () => {
    it('should record start time and GPS', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.trips.update.mockResolvedValue({ id: BigInt(1) })

      const result = await tripService.startTrip(BigInt(1), -34.6, -58.38, driverUser)

      expect(result).toEqual({ id: BigInt(1) })
      expect(mockPrisma.trips.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            start_lat: -34.6,
            start_lng: -58.38,
          }),
        }),
      )
    })

    it('should throw without full access', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('none')

      await expect(tripService.startTrip(BigInt(1), 0, 0, driverUser)).rejects.toThrow('No tienes permisos')
    })
  })

  describe('addStop', () => {
    it('should create a trip stop', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.trip_stops.create.mockResolvedValue({ id: BigInt(10) })

      const result = await tripService.addStop(BigInt(1), -34.6, -58.38, driverUser)

      expect(result).toEqual({ id: BigInt(10) })
      expect(mockPrisma.trip_stops.create).toHaveBeenCalledWith({
        data: {
          trip_id: BigInt(1),
          lat: -34.6,
          lng: -58.38,
        },
      })
    })
  })

  describe('endTrip', () => {
    it('should record end time and GPS', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.trips.update.mockResolvedValue({ id: BigInt(1) })

      const result = await tripService.endTrip(BigInt(1), -34.6, -58.38, driverUser)

      expect(result).toEqual({ id: BigInt(1) })
      expect(mockPrisma.trips.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            end_lat: -34.6,
            end_lng: -58.38,
          }),
        }),
      )
    })
  })
})
