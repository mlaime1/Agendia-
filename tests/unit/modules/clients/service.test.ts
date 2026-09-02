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
    client_passengers: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
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
import { AuthUser } from '../../../../src/utils/calendarAuth'

const mockPrisma = prisma as any
const adminUser: AuthUser = { authId: 'admin', role: 'ADMIN', dbId: BigInt(1) }

describe('clients/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAll', () => {
    it('should return all clients ordered by name', async () => {
      const mockClients = [{ id: BigInt(1), nombre: 'Client A' }]
      mockPrisma.clients.findMany.mockResolvedValue(mockClients)

       const result = await getAll(adminUser)

      expect(result).toEqual(mockClients)
      expect(mockPrisma.clients.findMany).toHaveBeenCalledWith({
        orderBy: { nombre: 'asc' },
      })
    })

    it('should restrict drivers to their assigned clients', async () => {
      mockPrisma.clients.findMany.mockResolvedValue([])

      await getAll({ authId: 'driver', role: 'DRIVER', dbId: BigInt(42) })

      expect(mockPrisma.clients.findMany).toHaveBeenCalledWith({
        where: { driver_id: BigInt(42) },
        orderBy: { nombre: 'asc' },
      })
    })

    it('should restrict passengers to linked clients', async () => {
      mockPrisma.clients.findMany.mockResolvedValue([])

      await getAll({ authId: 'passenger', role: 'PASSENGER', dbId: BigInt(7) })

      expect(mockPrisma.clients.findMany).toHaveBeenCalledWith({
        where: { client_passengers: { some: { user_id: BigInt(7) } } },
        orderBy: { nombre: 'asc' },
      })
    })
  })

  describe('getById', () => {
    it('should return a client by id', async () => {
      const mockClient = { id: BigInt(1), nombre: 'Test Client' }
      mockPrisma.clients.findUnique.mockResolvedValue(mockClient)

       const result = await getById('1', adminUser)

      expect(result).toEqual(mockClient)
    })

    it('should throw if client not found', async () => {
      mockPrisma.clients.findUnique.mockResolvedValue(null)

       await expect(getById('999', adminUser)).rejects.toThrow('Cliente no encontrado')
    })

    it('should reject a client user reading another client', async () => {
      await expect(getById('999', { authId: 'client', role: 'client', dbId: BigInt(5) }))
        .rejects.toThrow('No tienes acceso')
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
       }, adminUser)

      expect(result).toEqual(mockClient)
      expect(mockPrisma.clients.create).toHaveBeenCalled()
    })

    it('should throw for weekly billing without billing_day', async () => {
      await expect(
        create({
          nombre: 'Client',
          phone: '1234567890',
          billing_cycle: 'weekly',
        }, adminUser)
      ).rejects.toThrow('billing_day es requerido para ciclo semanal')
    })

    it('should throw for weekly billing with invalid billing_day', async () => {
      await expect(
        create({
          nombre: 'Client',
          phone: '1234567890',
          billing_cycle: 'weekly',
          billing_day: 8,
        }, adminUser)
      ).rejects.toThrow('billing_day para ciclo semanal debe ser entre 1')
    })

    it('should throw for biweekly billing without billing_start_date', async () => {
      await expect(
        create({
          nombre: 'Client',
          phone: '1234567890',
          billing_cycle: 'biweekly',
        }, adminUser)
      ).rejects.toThrow('billing_start_date es requerido para ciclo quincenal')
    })

    it('should throw for monthly billing without billing_day', async () => {
      await expect(
        create({
          nombre: 'Client',
          phone: '1234567890',
          billing_cycle: 'monthly',
        }, adminUser)
      ).rejects.toThrow('billing_day es requerido para ciclo mensual')
    })

    it('should throw for monthly billing with billing_day > 31', async () => {
      await expect(
        create({
          nombre: 'Client',
          phone: '1234567890',
          billing_cycle: 'monthly',
          billing_day: 32,
        }, adminUser)
      ).rejects.toThrow('billing_day para ciclo mensual debe ser entre 1 y 31')
    })

    it('should pass driverId when provided', async () => {
      const mockClient = { id: BigInt(1), nombre: 'New Client', driver_id: BigInt(42) }
      mockPrisma.clients.create.mockResolvedValue(mockClient)

      const result = await create({
        nombre: 'New Client',
        phone: '1234567890',
        billing_cycle: 'monthly',
        billing_day: 1,
       }, { authId: 'driver', role: 'DRIVER', dbId: BigInt(42) })

      expect(result).toEqual(mockClient)
      expect(mockPrisma.clients.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ driver_id: BigInt(42) }),
        })
      )
    })
  })

  describe('update', () => {
    it('should update a client', async () => {
      const mockClient = { id: BigInt(1), nombre: 'Updated' }
      mockPrisma.clients.update.mockResolvedValue(mockClient)

       const result = await update('1', { nombre: 'Updated' }, adminUser)

      expect(result).toEqual(mockClient)
    })

    it('should validate billing config when billing_cycle is provided', async () => {
      await expect(
        update('1', { billing_cycle: 'weekly' }, adminUser)
      ).rejects.toThrow('billing_day es requerido para ciclo semanal')
    })

    it('should reject passenger mutations', async () => {
      mockPrisma.client_passengers.findUnique.mockResolvedValue({ client_id: BigInt(1) })

      await expect(update('1', { nombre: 'Blocked' }, {
        authId: 'passenger', role: 'PASSENGER', dbId: BigInt(7),
      })).rejects.toThrow('No tienes permisos')
      expect(mockPrisma.clients.update).not.toHaveBeenCalled()
    })
  })

  describe('updateBillingConfig', () => {
    it('should update billing config with valid data', async () => {
      mockPrisma.clients.update.mockResolvedValue({ id: BigInt(1) })

       await updateBillingConfig('1', {
        billing_cycle: 'monthly',
        billing_day: 15,
       }, adminUser)

      expect(mockPrisma.clients.update).toHaveBeenCalled()
    })

    it('should clear billing_start_date for non-biweekly cycles', async () => {
      mockPrisma.clients.update.mockResolvedValue({ id: BigInt(1) })

       await updateBillingConfig('1', {
        billing_cycle: 'monthly',
        billing_day: 1,
        billing_start_date: '2025-01-01',
       }, adminUser)

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

       const result = await remove('1', adminUser)

      expect(result).toEqual({ id: BigInt(1) })
    })

    it('should throw if client has pending summaries', async () => {
      mockPrisma.summaries.count.mockResolvedValue(3)

       await expect(remove('1', adminUser)).rejects.toThrow('resumen/es pendiente/s de cobro')
    })
  })
})
