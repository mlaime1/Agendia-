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
    trips: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

jest.mock('../../../../src/lib/supabase', () => ({
  supabase: {},
}))

import {
  createSummaryManual,
  createSummaryAuto,
  getAllByClient,
  getById,
  updateStatus,
  deleteSummary,
  previewBillingPeriod,
} from '../../../../src/modules/summaries/service'
import { prisma } from '../../../../src/config/prisma'

const mockPrisma = prisma as any

describe('summaries/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAllByClient', () => {
    it('should return all summaries for a client', async () => {
      const mockSummaries = [{ id: BigInt(1), client_id: BigInt(5) }]
      mockPrisma.summaries.findMany.mockResolvedValue(mockSummaries)

      const result = await getAllByClient('5')

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

      const result = await getById('1')

      expect(result).toEqual(mockSummary)
    })

    it('should throw if summary not found', async () => {
      mockPrisma.summaries.findUnique.mockResolvedValue(null)

      await expect(getById('999')).rejects.toThrow('Resumen no encontrado')
    })
  })

  describe('updateStatus', () => {
    it('should update status to sent with sent_at', async () => {
      const mockUpdated = { id: BigInt(1), status: 'sent' }
      mockPrisma.summaries.update.mockResolvedValue(mockUpdated)

      const result = await updateStatus('1', { status: 'sent' })

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
      mockPrisma.summaries.update.mockResolvedValue({ id: BigInt(1), status: 'paid' })

      await updateStatus('1', { status: 'paid' })

      expect(mockPrisma.summaries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'paid',
            paid_at: expect.any(Date),
          }),
        })
      )
    })

    it('should update status to archived with archived_at', async () => {
      mockPrisma.summaries.update.mockResolvedValue({ id: BigInt(1), status: 'archived' })

      await updateStatus('1', { status: 'archived' })

      expect(mockPrisma.summaries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'archived',
            archived_at: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('deleteSummary', () => {
    it('should unlink trips and delete summary', async () => {
      mockPrisma.trips.updateMany.mockResolvedValue({})
      mockPrisma.summaries.delete.mockResolvedValue({ id: BigInt(1) })

      const result = await deleteSummary('1')

      expect(mockPrisma.trips.updateMany).toHaveBeenCalledWith({
        where: { summary_id: BigInt(1) },
        data: { summary_id: null },
      })
      expect(mockPrisma.summaries.delete).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
      })
    })
  })

  describe('createSummaryAuto', () => {
    it('should throw if client not found', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue(null)

      await expect(
        createSummaryAuto('999', { driver_id: '1' })
      ).rejects.toThrow('Cliente no encontrado')
    })

    it('should throw if client has no billing_cycle', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue({
        billing_cycle: null,
        billing_day: null,
        billing_start_date: null,
      })

      await expect(
        createSummaryAuto('1', { driver_id: '1' })
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
        createSummaryAuto('1', { driver_id: '1' })
      ).rejects.toThrow('Ya existe un resumen para este período')
    })
  })

  describe('previewBillingPeriod', () => {
    it('should throw if client not found', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue(null)

      await expect(previewBillingPeriod('999')).rejects.toThrow('Cliente no encontrado')
    })

    it('should throw if client has no billing cycle', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue({
        nombre: 'Client',
        billing_cycle: null,
        billing_day: null,
        billing_start_date: null,
      })

      await expect(previewBillingPeriod('1')).rejects.toThrow('no tiene ciclo de facturación configurado')
    })

    it('should return preview with available trips count', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue({
        nombre: 'Test Client',
        billing_cycle: 'monthly',
        billing_day: 1,
        billing_start_date: null,
      })
      mockPrisma.trips.count.mockResolvedValue(5)

      const result = await previewBillingPeriod('1', '2025-06-15')

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
