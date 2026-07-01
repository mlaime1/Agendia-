jest.mock('../../../../src/config/prisma', () => {
  const mockPrisma = {
    routes: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    route_stops: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    rates: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    clients: {
      findMany: jest.fn(),
    },
    trips: {
      count: jest.fn(),
    },
  }
  return {
    prisma: {
      ...mockPrisma,
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    },
  }
})

jest.mock('../../../../src/lib/supabase', () => ({
  supabase: {},
}))

jest.mock('../../../../src/utils/calendarAuth', () => ({
  getClientAccessLevel: jest.fn(),
}))

import { itineraryService } from '../../../../src/modules/itinerary/service'
import { prisma } from '../../../../src/config/prisma'
import * as calendarAuth from '../../../../src/utils/calendarAuth'

const mockPrisma = prisma as any
const mockCalendarAuth = calendarAuth as jest.Mocked<typeof calendarAuth>

const driverUser = { authId: 'driver-auth', role: 'DRIVER' as const, dbId: BigInt(1) }
const adminUser = { authId: 'admin-auth', role: 'ADMIN' as const, dbId: BigInt(99) }

describe('itinerary/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAll', () => {
    it('should return only active itineraries when no user provided', async () => {
      const mockItineraries = [{ id: BigInt(1), name: 'Route A' }]
      mockPrisma.routes.findMany.mockResolvedValue(mockItineraries)

      const result = await itineraryService.getAll()

      expect(result).toEqual(mockItineraries)
      expect(mockPrisma.routes.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        include: { route_stops: true, rates: true, clients: true },
        orderBy: { name: 'asc' },
      })
    })

    it('should filter active itineraries by driver clients for DRIVER role', async () => {
      const mockItineraries = [{ id: BigInt(1) }]
      mockPrisma.clients.findMany.mockResolvedValue([{ id: BigInt(5) }, { id: BigInt(6) }])
      mockPrisma.routes.findMany.mockResolvedValue(mockItineraries)

      const result = await itineraryService.getAll(driverUser)

      expect(result).toEqual(mockItineraries)
      expect(mockPrisma.routes.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { is_active: true },
            { client_id: { in: [BigInt(5), BigInt(6)] } },
          ],
        },
        include: { route_stops: true, rates: true, clients: true },
        orderBy: { name: 'asc' },
      })
    })
  })

  describe('getById', () => {
    it('should return an itinerary by id', async () => {
      const mockItinerary = { id: BigInt(1), client_id: BigInt(5), is_active: true }
      mockPrisma.routes.findUnique.mockResolvedValue(mockItinerary)
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')

      const result = await itineraryService.getById('1', driverUser)

      expect(result).toEqual(mockItinerary)
    })

    it('should throw if not found', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue(null)

      await expect(itineraryService.getById('999')).rejects.toThrow('Itinerario no encontrado')
    })

    it('should throw if itinerary is deleted', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ id: BigInt(1), is_active: false })

      await expect(itineraryService.getById('1')).rejects.toThrow('eliminado')
    })
  })

  describe('create', () => {
    it('should create an itinerary with full access', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.routes.create.mockResolvedValue({ id: BigInt(1) })

      const result = await itineraryService.create(
        { name: 'New Route', client_id: '5' },
        driverUser,
      )

      expect(result).toEqual({ id: BigInt(1) })
      expect(mockPrisma.routes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New Route',
            client_id: BigInt(5),
          }),
        }),
      )
    })

    it('should throw without full access', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('none')

      await expect(
        itineraryService.create({ name: 'New Route', client_id: '5' }, driverUser),
      ).rejects.toThrow('No tienes permisos')
    })
  })

  describe('remove', () => {
    it('should soft delete an itinerary without trips', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ client_id: BigInt(5), is_active: true })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.trips.count.mockResolvedValue(0)
      mockPrisma.route_stops.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.rates.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.routes.update.mockResolvedValue({ id: BigInt(1), is_active: false })

      const result = await itineraryService.remove('1', driverUser)

      expect(result).toEqual({ id: BigInt(1), is_active: false })
      expect(mockPrisma.route_stops.deleteMany).toHaveBeenCalledWith({
        where: { route_id: BigInt(1) },
      })
      expect(mockPrisma.rates.deleteMany).toHaveBeenCalledWith({
        where: { route_id: BigInt(1) },
      })
      expect(mockPrisma.routes.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: {
          is_active: false,
          deleted_at: expect.any(Date),
        },
      })
    })

    it('should throw if itinerary has associated trips', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ client_id: BigInt(5), is_active: true })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.trips.count.mockResolvedValue(3)

      await expect(itineraryService.remove('1', driverUser)).rejects.toThrow('viaje(s) asociado(s)')
    })

    it('should throw if itinerary not found', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue(null)

      await expect(itineraryService.remove('999', driverUser)).rejects.toThrow('Itinerario no encontrado')
    })
  })

  describe('stops', () => {
    it('should create a stop', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ client_id: BigInt(5), is_active: true })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.route_stops.create.mockResolvedValue({ id: BigInt(10) })

      const result = await itineraryService.createStop(
        '1',
        { address: 'Main St', stop_order: 1, lat: -34.6, lng: -58.38 },
        driverUser,
      )

      expect(result).toEqual({ id: BigInt(10) })
    })

    it('should list stops', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ client_id: BigInt(5), is_active: true })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.route_stops.findMany.mockResolvedValue([{ id: BigInt(1) }])

      const result = await itineraryService.getStops('1', driverUser)

      expect(result).toEqual([{ id: BigInt(1) }])
    })

    it('should throw if itinerary not found', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue(null)

      await expect(itineraryService.getStops('999', driverUser)).rejects.toThrow('Itinerario no encontrado')
    })

    it('should update a stop', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ client_id: BigInt(5), is_active: true })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.route_stops.update.mockResolvedValue({ id: BigInt(1) })

      const result = await itineraryService.updateStop('1', '10', { address: 'New' }, driverUser)

      expect(result).toEqual({ id: BigInt(1) })
    })

    it('should delete a stop', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ client_id: BigInt(5), is_active: true })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.route_stops.delete.mockResolvedValue({ id: BigInt(1) })

      const result = await itineraryService.removeStop('1', '10', driverUser)

      expect(result).toEqual({ id: BigInt(1) })
    })

    it('should throw if itinerary not found', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue(null)

      await expect(itineraryService.removeStop('999', '10', driverUser)).rejects.toThrow('Itinerario no encontrado')
    })
  })

  describe('rates', () => {
    it('should create a rate', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ client_id: BigInt(5), is_active: true })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.rates.findFirst.mockResolvedValue(null)
      mockPrisma.rates.create.mockResolvedValue({ id: BigInt(20) })

      const result = await itineraryService.createRate(
        '1',
        { trip_type: 'ida', base_price: 5000 },
        driverUser,
      )

      expect(result).toEqual({ id: BigInt(20) })
    })

    it('should throw if rate already exists for trip_type', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ client_id: BigInt(5), is_active: true })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.rates.findFirst.mockResolvedValue({ id: BigInt(20) })

      await expect(
        itineraryService.createRate('1', { trip_type: 'ida', base_price: 5000 }, driverUser),
      ).rejects.toThrow('Ya existe una tarifa')
    })

    it('should list rates', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue({ client_id: BigInt(5), is_active: true })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.rates.findMany.mockResolvedValue([{ id: BigInt(1) }])

      const result = await itineraryService.getRates('1', driverUser)

      expect(result).toEqual([{ id: BigInt(1) }])
    })

    it('should throw if itinerary not found', async () => {
      mockPrisma.routes.findUnique.mockResolvedValue(null)

      await expect(itineraryService.getRates('999', driverUser)).rejects.toThrow('Itinerario no encontrado')
    })
  })

  describe('matchItinerary', () => {
    it('should return the best matching active itinerary', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.routes.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          name: 'Route A',
          client_id: BigInt(5),
          route_stops: [
            { id: BigInt(1), lat: -34.6037, lng: -58.3816, stop_order: 1 },
          ],
          rates: [{ id: BigInt(10), trip_type: 'ida', base_price: 5000 }],
        },
      ])

      const result = await itineraryService.matchItinerary(
        { client_id: '5', points: [{ lat: -34.6037, lng: -58.3816 }] },
        driverUser,
      )

      expect(mockPrisma.routes.findMany).toHaveBeenCalledWith({
        where: { client_id: BigInt(5), is_active: true },
        include: expect.any(Object),
      })
      expect(result).toEqual(
        expect.objectContaining({
          itinerary_id: BigInt(1),
          name: 'Route A',
          rate: expect.objectContaining({
            id: BigInt(10),
            base_price: 5000,
          }),
        }),
      )
    })

    it('should return null if no itineraries', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.routes.findMany.mockResolvedValue([])

      const result = await itineraryService.matchItinerary(
        { client_id: '5', points: [{ lat: 0, lng: 0 }] },
        driverUser,
      )

      expect(result).toBeNull()
    })
  })
})
