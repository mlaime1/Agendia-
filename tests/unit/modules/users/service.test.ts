jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    users: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    clients: {
      findUnique: jest.fn(),
    },
    client_passengers: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('../../../../src/lib/supabase', () => ({
  supabase: {},
}))

import { getMe, updateMe, getAll } from '../../../../src/modules/users/service'
import { prisma } from '../../../../src/config/prisma'

const mockPrisma = prisma as any

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

      const result = await getMe('auth-123')

      expect(result).toEqual({
        ...mockUser,
        type: 'driver',
      })
    })

    it('should return client profile when auth_id matches a client', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null)
      const mockClient = { id: BigInt(10), nombre: 'Test Client' }
      mockPrisma.clients.findUnique.mockResolvedValue(mockClient)

      const result = await getMe('auth-client-123')

      expect(result).toEqual({
        type: 'client',
        role: 'client',
        id: BigInt(10),
        linked_client_id: '10',
        name: 'Test Client',
      })
    })

    it('should return PASSENGER profile with linked clients', async () => {
      const mockUser = {
        id: BigInt(10),
        name: 'Test Passenger',
        email: 'pass@test.com',
        alias: null,
        role: 'PASSENGER',
      }
      mockPrisma.users.findUnique.mockResolvedValue(mockUser)
      mockPrisma.client_passengers.findMany.mockResolvedValue([
        {
          client_id: BigInt(5),
          client: { nombre: 'Client A', driver_id: BigInt(1) },
        },
      ])

      const result = await getMe('auth-pass')

      expect(result).toEqual({
        ...mockUser,
        type: 'passenger',
        clients: [
          { id: '5', nombre: 'Client A', driver_id: '1' },
        ],
      })
    })

    it('should throw if user not found', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null)
      mockPrisma.clients.findUnique.mockResolvedValue(null)

      await expect(getMe('auth-nonexistent')).rejects.toThrow('Usuario no encontrado')
    })
  })

  describe('updateMe', () => {
    it('should update user and return new data', async () => {
      const mockUpdated = { id: BigInt(1), name: 'Updated Name', email: 'test@example.com' }
      mockPrisma.users.update.mockResolvedValue(mockUpdated)

      const result = await updateMe(BigInt(1), { name: 'Updated Name' })

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
