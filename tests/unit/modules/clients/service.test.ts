jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    clients: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    summaries: {
      count: jest.fn(),
    },
  },
}))

jest.mock('../../../../src/lib/supabase', () => ({
  supabase: {},
}))

import { create, getAll, getById, update, remove, updateBillingConfig } from '../../../../src/modules/clients/service'
import { prisma } from '../../../../src/config/prisma'

const mockPrisma = prisma as any

describe('clients/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAll', () => {
    it('should return all clients ordered by name', async () => {
      const mockClients = [{ id: BigInt(1), nombre: 'Client A' }]
      mockPrisma.clients.findMany.mockResolvedValue(mockClients)

      const result = await getAll()

      expect(result).toEqual(mockClients)
      expect(mockPrisma.clients.findMany).toHaveBeenCalledWith({
        orderBy: { nombre: 'asc' },
      })
    })
  })

  describe('getById', () => {
    it('should return a client by id', async () => {
      const mockClient = { id: BigInt(1), nombre: 'Test Client' }
      mockPrisma.clients.findUnique.mockResolvedValue(mockClient)

      const result = await getById('1')

      expect(result).toEqual(mockClient)
    })

    it('should throw if client not found', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue(null)

      await expect(getById('999')).rejects.toThrow('Cliente no encontrado')
    })
  })

  describe('create', () => {
    it('should create a client with valid billing config', async () => {
      const mockClient = { id: BigInt(1), nombre: 'New Client', billing_cycle: 'monthly' }
      mockPrisma.clients.create.mockResolvedValue(mockClient)

      const result = await create({
        nombre: 'New Client',
        phone: '1234567890',
        billing_cycle: 'monthly',
        billing_day: 1,
      })

      expect(result).toEqual(mockClient)
      expect(mockPrisma.clients.create).toHaveBeenCalled()
    })

    it('should throw for weekly billing without billing_day', async () => {
      await expect(
        create({
          nombre: 'Client',
          phone: '1234567890',
          billing_cycle: 'weekly',
        })
      ).rejects.toThrow('billing_day es requerido para ciclo semanal')
    })

    it('should throw for weekly billing with invalid billing_day', async () => {
      await expect(
        create({
          nombre: 'Client',
          phone: '1234567890',
          billing_cycle: 'weekly',
          billing_day: 8,
        })
      ).rejects.toThrow('billing_day para ciclo semanal debe ser entre 1')
    })

    it('should throw for biweekly billing without billing_start_date', async () => {
      await expect(
        create({
          nombre: 'Client',
          phone: '1234567890',
          billing_cycle: 'biweekly',
        })
      ).rejects.toThrow('billing_start_date es requerido para ciclo quincenal')
    })

    it('should throw for monthly billing without billing_day', async () => {
      await expect(
        create({
          nombre: 'Client',
          phone: '1234567890',
          billing_cycle: 'monthly',
        })
      ).rejects.toThrow('billing_day es requerido para ciclo mensual')
    })

    it('should throw for monthly billing with billing_day > 31', async () => {
      await expect(
        create({
          nombre: 'Client',
          phone: '1234567890',
          billing_cycle: 'monthly',
          billing_day: 32,
        })
      ).rejects.toThrow('billing_day para ciclo mensual debe ser entre 1 y 31')
    })
  })

  describe('update', () => {
    it('should update a client', async () => {
      const mockClient = { id: BigInt(1), nombre: 'Updated' }
      mockPrisma.clients.update.mockResolvedValue(mockClient)

      const result = await update('1', { nombre: 'Updated' })

      expect(result).toEqual(mockClient)
    })

    it('should validate billing config when billing_cycle is provided', async () => {
      await expect(
        update('1', { billing_cycle: 'weekly' })
      ).rejects.toThrow('billing_day es requerido para ciclo semanal')
    })
  })

  describe('updateBillingConfig', () => {
    it('should update billing config with valid data', async () => {
      mockPrisma.clients.update.mockResolvedValue({ id: BigInt(1) })

      await updateBillingConfig('1', {
        billing_cycle: 'monthly',
        billing_day: 15,
      })

      expect(mockPrisma.clients.update).toHaveBeenCalled()
    })

    it('should clear billing_start_date for non-biweekly cycles', async () => {
      mockPrisma.clients.update.mockResolvedValue({ id: BigInt(1) })

      await updateBillingConfig('1', {
        billing_cycle: 'monthly',
        billing_day: 1,
        billing_start_date: '2025-01-01',
      })

      expect(mockPrisma.clients.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billing_start_date: null,
          }),
        })
      )
    })
  })

  describe('remove', () => {
    it('should delete a client without pending summaries', async () => {
      mockPrisma.summaries.count.mockResolvedValue(0)
      mockPrisma.clients.delete.mockResolvedValue({ id: BigInt(1) })

      const result = await remove('1')

      expect(result).toEqual({ id: BigInt(1) })
    })

    it('should throw if client has pending summaries', async () => {
      mockPrisma.summaries.count.mockResolvedValue(3)

      await expect(remove('1')).rejects.toThrow('resumen/es pendiente/s de cobro')
    })
  })
})
