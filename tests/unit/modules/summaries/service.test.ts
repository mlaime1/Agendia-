jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    summaries: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    clients: {
      findUnique: jest.fn(),
    },
    client_passengers: {
      findUnique: jest.fn(),
    },
    trips: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    payments: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) => {
      // Support both callback and array styles in mock
      if (typeof callback === 'function') {
        return callback({
          summaries: { update: mockPrisma.summaries.update },
          trips: { update: mockPrisma.trips.update },
          payments: { create: mockPrisma.payments.create },
       }, adminUser)
      }
      // Array fallback
      const results = []
      for (const op of callback) {
        results.push(await op)
      }
      return results
    }),
  },
}))

jest.mock('../../../../src/lib/supabase', () => ({
  supabase: {},
}))

jest.mock('../../../../src/utils/calendarAuth', () => ({
  getClientAccessLevel: jest.fn().mockResolvedValue('full'),
}))

import {
  createSummaryManual,
  createSummaryAuto,
  getAllByClient,
  getById,
  updateStatus,
  deleteSummary,
  previewBillingPeriod,
  paySummary,
  reportPayment,
  rejectPayment,
} from '../../../../src/modules/summaries/service'
import { prisma } from '../../../../src/config/prisma'

const mockPrisma = prisma as any
const adminUser = { authId: 'admin', role: 'ADMIN' as const, dbId: BigInt(1) }

describe('summaries/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(require('../../../../src/utils/calendarAuth').getClientAccessLevel as jest.Mock).mockResolvedValue('full')
    mockPrisma.clients.findUnique.mockResolvedValue({ driver_id: BigInt(1) })
  })

  describe('getAllByClient', () => {
    it('should return all summaries for a client', async () => {
      const mockSummaries = [{ id: BigInt(1), client_id: BigInt(5) }]
      mockPrisma.summaries.findMany.mockResolvedValue(mockSummaries)

       const result = await getAllByClient('5', adminUser)

      expect(result).toEqual(mockSummaries)
      expect(mockPrisma.summaries.findMany).toHaveBeenCalledWith({
        where: { client_id: BigInt(5) },
        include: expect.any(Object),
        orderBy: { period_start: 'desc' },
       })
     })
  })

  describe('getById', () => {
    it('should return a summary by id', async () => {
      const mockSummary = { id: BigInt(1), total_trips: 10 }
      mockPrisma.summaries.findUnique.mockResolvedValue(mockSummary)

       const result = await getById('1', adminUser)

      expect(result).toEqual(mockSummary)
    })

    it('should throw if summary not found', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue(null)

       await expect(getById('999', adminUser)).rejects.toThrow('Resumen no encontrado')
    })
  })

  describe('updateStatus', () => {
    it('should update status to sent with sent_at', async () => {
      const mockUpdated = { id: BigInt(1), status: 'sent' }
      mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5), status: 'draft' })
      mockPrisma.summaries.update.mockResolvedValue(mockUpdated)

      const result = await updateStatus('1', { status: 'sent' }, { authId: 'a', role: 'ADMIN', dbId: BigInt(1) })

      expect(result).toEqual(mockUpdated)
      expect(mockPrisma.summaries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'sent',
            sent_at: expect.any(Date),
          }),
        })
      )
    })

    it('should update status to paid with paid_at', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5), status: 'payment_reported' })

      await expect(updateStatus('1', { status: 'paid' }, { authId: 'a', role: 'ADMIN', dbId: BigInt(1) }))
        .rejects.toThrow('flujo dedicado')

      expect(mockPrisma.summaries.update).not.toHaveBeenCalled()
    })

    it('should update status to partial without paid_at', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5), status: 'sent' })

      await expect(updateStatus('1', { status: 'partial' }, { authId: 'a', role: 'ADMIN', dbId: BigInt(1) }))
        .rejects.toThrow('flujo dedicado')

      expect(mockPrisma.summaries.update).not.toHaveBeenCalled()
    })

    it('should update status to archived with archived_at', async () => {
      mockPrisma.summaries.update.mockResolvedValue({ id: BigInt(1), status: 'archived' })
      mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5), status: 'sent' })

      await updateStatus('1', { status: 'archived' }, { authId: 'a', role: 'ADMIN', dbId: BigInt(1) })

      expect(mockPrisma.summaries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'archived',
            archived_at: expect.any(Date),
          }),
        })
      )
    })

    it('should reject read-only users', async () => {
      const calendarAuth = require('../../../../src/utils/calendarAuth') as typeof import('../../../../src/utils/calendarAuth')
      ;(calendarAuth.getClientAccessLevel as jest.Mock).mockResolvedValue('read-only')
      mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5) })

      await expect(updateStatus('1', { status: 'sent' }, adminUser)).rejects.toThrow('No tienes permisos')
      expect(mockPrisma.summaries.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteSummary', () => {
    it('should unlink trips and delete summary', async () => {
      mockPrisma.trips.updateMany.mockResolvedValue({})
       mockPrisma.summaries.delete.mockResolvedValue({ id: BigInt(1) })
       mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5) })

       const result = await deleteSummary('1', adminUser)

      expect(mockPrisma.trips.updateMany).toHaveBeenCalledWith({
        where: { summary_id: BigInt(1) },
        data: { summary_id: null },
      })
      expect(mockPrisma.summaries.delete).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
      })
    })
  })

  describe('createSummaryManual', () => {
    it('should include pending and partial trips in a manual summary', async () => {
      mockPrisma.trips.findMany.mockResolvedValue([
        { id: BigInt(1), final_price: 1000, paid_amount: 0, payment_status: 'pending' },
        { id: BigInt(2), final_price: 500, paid_amount: 100, payment_status: 'partial' },
      ])
      mockPrisma.summaries.create.mockResolvedValue({ id: BigInt(10) })

      const result = await createSummaryManual({
        client_id: '5',
        driver_id: '1',
        period_start: '2025-06-01',
         period_end: '2025-06-01',
         period_type: 'manual',
       }, adminUser)

      expect(result).toEqual({ id: BigInt(10) })
      expect(mockPrisma.summaries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            period_type: 'manual',
            status: 'partial',
          }),
        })
      )
    })

    it('should exclude paid trips and preserve the no-trips behavior', async () => {
      mockPrisma.trips.findMany.mockResolvedValue([])

      await expect(createSummaryManual({ client_id: '5', driver_id: '1', period_start: '2025-06-01', period_end: '2025-06-01' }, adminUser))
        .rejects.toThrow('No hay viajes sin resumen')
      expect(mockPrisma.trips.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ payment_status: { in: ['pending', 'partial'] } }),
      }))
    })
    it('should use the client assigned driver instead of body driver_id', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue({ driver_id: BigInt(99) })
      mockPrisma.trips.findMany.mockResolvedValue([
        { id: BigInt(1), final_price: 1000, paid_amount: 0 },
      ])
      mockPrisma.summaries.create.mockResolvedValue({ id: BigInt(10) })

      await createSummaryManual({
        client_id: '5', driver_id: '1', period_start: '2025-06-01', period_end: '2025-06-01',
      }, adminUser)

      expect(mockPrisma.summaries.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ driver_id: BigInt(99) }),
      }))
    })


    it('should create draft summary when trips have zero price and no payments', async () => {
      mockPrisma.trips.findMany.mockResolvedValue([
        { id: BigInt(1), final_price: 0, paid_amount: 0 },
      ])
      mockPrisma.summaries.create.mockResolvedValue({ id: BigInt(10) })

      const result = await createSummaryManual({
        client_id: '5',
        driver_id: '1',
         period_start: '2025-06-01',
         period_end: '2025-06-01',
       }, adminUser)

      expect(result).toEqual({ id: BigInt(10) })
      expect(mockPrisma.summaries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            period_type: 'manual',
            status: 'draft',
          }),
        })
      )
    })

    it('should throw if no trips available', async () => {
      mockPrisma.trips.findMany.mockResolvedValue([])

      await expect(
        createSummaryManual({
          client_id: '5',
          driver_id: '1',
         period_start: '2025-06-01',
         period_end: '2025-06-01',
         }, adminUser)
      ).rejects.toThrow('No hay viajes sin resumen')
    })
  })

  describe('createSummaryAuto', () => {
    it('should throw if client not found', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue(null)

      await expect(
        createSummaryAuto('999', { driver_id: '1' }, adminUser)
      ).rejects.toThrow('Cliente no encontrado')
    })

    it('should throw if client has no billing_cycle', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue({
        billing_cycle: null,
        billing_day: null,
        billing_start_date: null,
      })

      await expect(
        createSummaryAuto('1', { driver_id: '1' }, adminUser)
      ).rejects.toThrow('no tiene configurado un ciclo de facturación')
    })

    it('should throw if duplicate summary exists', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue({
        billing_cycle: 'monthly',
        billing_day: 1,
        billing_start_date: null,
      })
      mockPrisma.summaries.findFirst.mockResolvedValue({ id: BigInt(10) })

      await expect(
        createSummaryAuto('1', { driver_id: '1' }, adminUser)
      ).rejects.toThrow('Ya existe un resumen para este período')
    })
  })

  describe('paySummary', () => {
    it('should distribute payment across pending trips (FIFO)', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue({
        id: BigInt(1),
        total_amount: 3000,
        paid_amount: 0,
        trips: [
          { id: BigInt(10), final_price: 1000, paid_amount: 0, payment_status: 'pending', trip_date: new Date('2025-06-01') },
          { id: BigInt(11), final_price: 2000, paid_amount: 0, payment_status: 'pending', trip_date: new Date('2025-06-02') },
        ],
      })
      mockPrisma.summaries.update.mockResolvedValue({ id: BigInt(1), paid_amount: 2500, status: 'partial' })
      mockPrisma.trips.update.mockResolvedValue({})
      mockPrisma.payments.create.mockResolvedValue({})

      const result = await paySummary('1', { amount: 2500, method: 'cash' }, adminUser)

      expect(result).toEqual({ id: BigInt(1), paid_amount: 2500, status: 'partial' })
      expect(mockPrisma.trips.update).toHaveBeenCalledTimes(2)
      expect(mockPrisma.payments.create).toHaveBeenCalledTimes(2)
    })

    it('should mark summary as paid when full amount is covered', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue({
        id: BigInt(1),
        total_amount: 3000,
        paid_amount: 0,
        trips: [
          { id: BigInt(10), final_price: 3000, paid_amount: 0, payment_status: 'pending', trip_date: new Date('2025-06-01') },
        ],
      })
      mockPrisma.summaries.update.mockResolvedValue({ id: BigInt(1), paid_amount: 3000, status: 'paid' })
      mockPrisma.trips.update.mockResolvedValue({})
      mockPrisma.payments.create.mockResolvedValue({})

      const result = await paySummary('1', { amount: 3000, method: 'transfer' }, adminUser)

      expect(result).toEqual({ id: BigInt(1), paid_amount: 3000, status: 'paid' })
      expect(mockPrisma.summaries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'paid',
            paid_at: expect.any(Date),
          }),
        })
      )
    })

    it('should throw if payment exceeds summary balance', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue({
        id: BigInt(1),
        total_amount: 3000,
        paid_amount: 0,
        trips: [
          { id: BigInt(10), final_price: 3000, paid_amount: 0, payment_status: 'pending', trip_date: new Date('2025-06-01') },
        ],
      })

      await expect(
        paySummary('1', { amount: 5000, method: 'cash' }, adminUser)
      ).rejects.toThrow('excede el saldo')
    })

    it('should reject actual payments without a driver or admin user', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5), total_amount: 1, paid_amount: 0, trips: [] })
      await expect(paySummary('1', { amount: 1, method: 'cash' }, undefined as any)).rejects.toThrow('permisos')
    })
  })

  describe('payment report workflow', () => {
    const clientUser = { authId: 'client-auth', role: 'client' as const, dbId: BigInt(5) }
    const adminUser = { authId: 'admin-auth', role: 'ADMIN' as const, dbId: BigInt(1) }

    it('allows the owning client to report only a sent summary', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5), status: 'sent' })
      mockPrisma.summaries.update.mockResolvedValue({ id: BigInt(1), status: 'payment_reported' })

      await expect(reportPayment('1', clientUser)).resolves.toEqual({ id: BigInt(1), status: 'payment_reported' })
      expect(mockPrisma.summaries.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: 'payment_reported' },
      }))
    })

    it('rejects duplicate reports and unrelated clients', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5), status: 'payment_reported' })
      await expect(reportPayment('1', clientUser)).rejects.toThrow('resumen enviado')

      mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5), status: 'sent' })
      ;(require('../../../../src/utils/calendarAuth').getClientAccessLevel as jest.Mock).mockResolvedValueOnce('none')
      await expect(reportPayment('1', { ...clientUser, dbId: BigInt(99) })).rejects.toThrow('acceso')
    })

    it('allows an admin to reject a report and returns it to sent', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue({ client_id: BigInt(5), status: 'payment_reported' })
      mockPrisma.summaries.update.mockResolvedValue({ id: BigInt(1), status: 'sent' })

      await expect(rejectPayment('1', adminUser)).resolves.toEqual({ id: BigInt(1), status: 'sent' })
      expect(mockPrisma.summaries.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'sent' } }))
    })

    it('rejects payment reports from drivers', async () => {
      await expect(reportPayment('1', { authId: 'driver-auth', role: 'DRIVER', dbId: BigInt(2) }))
        .rejects.toThrow('cliente o un pasajero')
    })
  })

  describe('previewBillingPeriod', () => {
    it('should throw if client not found', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue(null)

       await expect(previewBillingPeriod('999', undefined, adminUser)).rejects.toThrow('Cliente no encontrado')
    })

    it('should throw if client has no billing cycle', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue({
        nombre: 'Client',
        billing_cycle: null,
        billing_day: null,
        billing_start_date: null,
      })

       await expect(previewBillingPeriod('1', undefined, adminUser)).rejects.toThrow('no tiene ciclo de facturación configurado')
    })

    it('should return preview with available trips count', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue({
        nombre: 'Test Client',
        billing_cycle: 'monthly',
        billing_day: 1,
        billing_start_date: null,
      })
      mockPrisma.trips.count.mockResolvedValue(5)

       const result = await previewBillingPeriod('1', '2025-06-15', adminUser)

      expect(result).toEqual(
        expect.objectContaining({
          client: 'Test Client',
          billing_cycle: 'monthly',
          available_trips: 5,
        })
      )
    })
  })
})
