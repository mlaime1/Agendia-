jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    payments: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(async (ops: any[]) => {
      const results = []
      for (const op of ops) {
        results.push(await op)
      }
      return results
    }),
    trips: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('../../../../src/utils/calendarAuth', () => ({
  getClientAccessLevel: jest.fn(),
}))

import { paymentService } from '../../../../src/modules/payments/service'
import { prisma } from '../../../../src/config/prisma'
import * as calendarAuth from '../../../../src/utils/calendarAuth'

const mockPrisma = prisma as any
const mockCalendarAuth = calendarAuth as jest.Mocked<typeof calendarAuth>

const driverUser = { authId: 'driver-auth', role: 'DRIVER' as const, dbId: BigInt(1) }

describe('payments/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getByTrip', () => {
    it('should return payments for a trip when user has access', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({ client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.payments.findMany.mockResolvedValue([{ id: BigInt(1), amount: 1000 }])

      const result = await paymentService.getByTrip(BigInt(10), driverUser)

      expect(result).toEqual([{ id: BigInt(1), amount: 1000 }])
      expect(mockPrisma.payments.findMany).toHaveBeenCalledWith({
        where: { trip_id: BigInt(10) },
        orderBy: { paid_at: 'desc' },
      })
    })

    it('should throw if trip not found', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue(null)

      await expect(paymentService.getByTrip(BigInt(10), driverUser)).rejects.toThrow('Viaje no encontrado')
    })
  })

  describe('create', () => {
    it('should create a payment and update trip to paid', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({
        client_id: BigInt(5),
        final_price: 5000,
        paid_amount: 0,
        payment_status: 'pending',
      })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.payments.create.mockResolvedValue({ id: BigInt(1), amount: 5000 })
      mockPrisma.trips.update.mockResolvedValue({ id: BigInt(10), payment_status: 'paid' })

      const result = await paymentService.create(BigInt(10), { amount: 5000, method: 'cash' }, driverUser)

      expect(result).toEqual({ id: BigInt(1), amount: 5000 })
      expect(mockPrisma.trips.update).toHaveBeenCalledWith({
        where: { id: BigInt(10) },
        data: { paid_amount: 5000, payment_status: 'paid' },
      })
    })

    it('should create a partial payment and update trip to partial', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({
        client_id: BigInt(5),
        final_price: 5000,
        paid_amount: 0,
        payment_status: 'pending',
      })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.payments.create.mockResolvedValue({ id: BigInt(1), amount: 2000 })
      mockPrisma.trips.update.mockResolvedValue({ id: BigInt(10), payment_status: 'partial' })

      const result = await paymentService.create(BigInt(10), { amount: 2000, method: 'transfer' }, driverUser)

      expect(result).toEqual({ id: BigInt(1), amount: 2000 })
      expect(mockPrisma.trips.update).toHaveBeenCalledWith({
        where: { id: BigInt(10) },
        data: { paid_amount: 2000, payment_status: 'partial' },
      })
    })

    it('should throw if payment exceeds final_price', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({
        client_id: BigInt(5),
        final_price: 5000,
        paid_amount: 0,
        payment_status: 'pending',
      })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')

      await expect(
        paymentService.create(BigInt(10), { amount: 6000, method: 'cash' }, driverUser)
      ).rejects.toThrow('excede el monto')
    })

    it('should throw if user has no full access', async () => {
      mockPrisma.trips.findUnique.mockResolvedValue({
        client_id: BigInt(5),
        final_price: 5000,
        paid_amount: 0,
        payment_status: 'pending',
      })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('read-only')

      await expect(
        paymentService.create(BigInt(10), { amount: 1000, method: 'cash' }, driverUser)
      ).rejects.toThrow('No tienes permisos')
    })
  })

  describe('update', () => {
    it('should update payment amount and recalculate trip status', async () => {
      mockPrisma.payments.findUnique.mockResolvedValue({
        id: BigInt(1),
        amount: 2000,
        trips: {
          id: BigInt(10),
          client_id: BigInt(5),
          final_price: 5000,
          paid_amount: 2000,
          payment_status: 'partial',
        },
      })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.payments.update.mockResolvedValue({ id: BigInt(1), amount: 5000 })
      mockPrisma.trips.update.mockResolvedValue({ id: BigInt(10), payment_status: 'paid' })

      const result = await paymentService.update(BigInt(1), { amount: 5000 }, driverUser)

      expect(result).toEqual({ id: BigInt(1), amount: 5000 })
      expect(mockPrisma.trips.update).toHaveBeenCalledWith({
        where: { id: BigInt(10) },
        data: { paid_amount: 5000, payment_status: 'paid' },
      })
    })

    it('should throw if new amount exceeds final_price', async () => {
      mockPrisma.payments.findUnique.mockResolvedValue({
        id: BigInt(1),
        amount: 2000,
        trips: {
          id: BigInt(10),
          client_id: BigInt(5),
          final_price: 5000,
          paid_amount: 2000,
          payment_status: 'partial',
        },
      })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')

      await expect(
        paymentService.update(BigInt(1), { amount: 6000 }, driverUser)
      ).rejects.toThrow('excede el precio')
    })
  })

  describe('delete', () => {
    it('should delete payment and revert trip status to pending', async () => {
      mockPrisma.payments.findUnique.mockResolvedValue({
        id: BigInt(1),
        amount: 2000,
        trips: {
          id: BigInt(10),
          client_id: BigInt(5),
          final_price: 5000,
          paid_amount: 2000,
          payment_status: 'partial',
        },
      })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.payments.delete.mockResolvedValue({ id: BigInt(1) })
      mockPrisma.trips.update.mockResolvedValue({ id: BigInt(10), payment_status: 'pending' })

      const result = await paymentService.delete(BigInt(1), driverUser)

      expect(result).toEqual({ deleted: true })
      expect(mockPrisma.trips.update).toHaveBeenCalledWith({
        where: { id: BigInt(10) },
        data: { paid_amount: 0, payment_status: 'pending' },
      })
    })
  })
})
