jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    users: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    passenger: {
      findUnique: jest.fn(),
    },
    passenger_client_access: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('../../../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      admin: {
        updateUserById: jest.fn(),
      },
    },
  },
}))

import { getMe, updateMe, getAll } from '../../../../src/modules/users/service'
import { prisma } from '../../../../src/config/prisma'
import { supabase } from '../../../../src/lib/supabase'

const mockPrisma = prisma as any
const mockSupabase = supabase as any

describe('users/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getMe', () => {
    it('should return user profile when auth_id matches a user', async () => {
      const mockUser = {
        id: BigInt(1),
        name: 'Test User',
        email: 'test@example.com',
        role: 'DRIVER',
      }
      mockPrisma.users.findUnique.mockResolvedValue(mockUser)

      const result = await getMe('auth-123', '+5491122334455')

      expect(result).toEqual({
        ...mockUser,
        phone: '+5491122334455',
        type: 'driver',
      })
    })

    it('should return client profile when auth_id matches a client', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null)
      const mockClient = { id: BigInt(10), nombre: 'Test Client' }
      mockPrisma.passenger.findUnique.mockResolvedValue(mockClient)

      const result = await getMe('auth-client-123')

      expect(result).toEqual({
        type: 'client',
        role: 'client',
        id: BigInt(10),
        linked_client_id: '10',
        name: 'Test Client',
        phone: null,
      })
    })

    it('should return CLIENT profile with linked clients', async () => {
      const mockUser = {
        id: BigInt(10),
        name: 'Test Passenger',
        email: 'pass@test.com',
        alias: null,
        role: 'CLIENT',
      }
      mockPrisma.users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.passenger_client_access.findMany.mockResolvedValue([
        {
          passenger_id: BigInt(5),
          passenger: { nombre: 'Client A', driver_id: BigInt(1) },
        },
      ])

      const result = await getMe('auth-pass')

      expect(result).toEqual({
        ...mockUser,
        role: 'PASSENGER',
        phone: null,
        type: 'passenger',
        clients: [
          { id: '5', nombre: 'Client A', driver_id: '1' },
        ],
      })
    })

    it('should throw if user not found', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null)
      mockPrisma.passenger.findUnique.mockResolvedValue(null)

      await expect(getMe('auth-nonexistent')).rejects.toThrow('Usuario no encontrado')
    })
  })

  describe('updateMe', () => {
    it('should update user and return new data', async () => {
      const mockUpdated = { id: BigInt(1), name: 'Updated Name', email: 'test@example.com' }
      mockPrisma.users.update.mockResolvedValue(mockUpdated)

      const result = await updateMe(BigInt(1), 'auth-123', 'DRIVER', { name: 'Updated Name' })

      expect(result).toEqual(mockUpdated)
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: { name: 'Updated Name' },
        select: {
          id: true,
          name: true,
          email: true,
          alias: true,
          role: true,
        },
      })
    })

    it('should update phone in Supabase Auth and return it', async () => {
      const mockUpdated = { id: BigInt(1), name: 'Test User', email: 'test@example.com' }
      mockPrisma.users.update.mockResolvedValue(mockUpdated)
      mockSupabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: { id: 'auth-123' } },
        error: null,
      })

      const result = await updateMe(BigInt(1), 'auth-123', 'DRIVER', { phone: '+54 9 11 2233-4455' })

      expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledWith('auth-123', {
        phone: '+5491122334455',
        phone_confirm: true,
      })
      expect(result).toEqual({ ...mockUpdated, phone: '+5491122334455' })
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: {},
        select: {
          id: true,
          name: true,
          email: true,
          alias: true,
          role: true,
        },
      })
    })

    it('should throw when Supabase fails to update the phone', async () => {
      mockSupabase.auth.admin.updateUserById.mockResolvedValue({
        data: { user: null },
        error: { message: 'Phone already registered' },
      })

      await expect(
        updateMe(BigInt(1), 'auth-123', 'DRIVER', { phone: '1122334455' })
      ).rejects.toThrow('Phone already registered')
    })

    it('should throw on invalid phone format', async () => {
      await expect(
        updateMe(BigInt(1), 'auth-123', 'DRIVER', { phone: '123' })
      ).rejects.toThrow('Teléfono inválido')
    })

    it('should reject clients without touching Supabase or Prisma', async () => {
      await expect(
        updateMe(BigInt(1), 'auth-123', 'CLIENT', { name: 'Client Name', phone: '1122334455' })
      ).rejects.toThrow('Los clientes no pueden editar su perfil con este endpoint')

      expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled()
      expect(mockPrisma.users.update).not.toHaveBeenCalled()
    })
  })

  describe('getAll', () => {
    it('should return all users', async () => {
      const mockUsers = [
        { id: BigInt(1), name: 'User 1' },
        { id: BigInt(2), name: 'User 2' },
      ]
      mockPrisma.users.findMany.mockResolvedValue(mockUsers)

      const result = await getAll()

      expect(result).toEqual(mockUsers)
      expect(mockPrisma.users.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          created_at: true,
          name: true,
          email: true,
          alias: true,
          role: true,
        },
        orderBy: { created_at: 'desc' },
      })
    })
  })
})
