jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    users: {
      upsert: jest.fn(),
    },
    clients: {
      create: jest.fn(),
    },
    client_passengers: {
      create: jest.fn(),
    },
    invitation_codes: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      admin: {
        createUser: jest.fn(),
        signOut: jest.fn(),
      },
      signInWithPassword: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}))

jest.mock('../../../../src/modules/invitations/service', () => ({
  validateCode: jest.fn(),
}))

import { register, login, logout, refreshSession } from '../../../../src/modules/auth/service'
import { supabase } from '../../../../src/lib/supabase'
import { prisma } from '../../../../src/config/prisma'
import * as invitationService from '../../../../src/modules/invitations/service'

const mockSupabase = supabase as any
const mockPrisma = prisma as any
const mockInvitation = invitationService as jest.Mocked<typeof invitationService>

describe('auth/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('register', () => {
    const passengerPayload = {
      email: 'pass@test.com',
      password: 'secret123',
      name: 'Juan Pérez',
      invitation_code: 'ABC123',
    }

    it('should register a passenger with valid invitation code', async () => {
      mockInvitation.validateCode.mockResolvedValue({ valid: true, client_id: null })
      mockPrisma.invitation_codes.findUnique.mockResolvedValue({
        driver_id: BigInt(1),
        client_id: null,
      })
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-uuid-123' } },
        error: null,
      })
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          users: { upsert: jest.fn().mockResolvedValue({ id: BigInt(10) }) },
          clients: { create: jest.fn().mockResolvedValue({ id: BigInt(5) }) },
          client_passengers: { create: jest.fn() },
          invitation_codes: { update: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'token' }, user: { id: 'auth-uuid-123' } },
        error: null,
      })

      const result = await register(passengerPayload)

      expect(result.user_role).toBe('PASSENGER')
      expect(mockInvitation.validateCode).toHaveBeenCalledWith('ABC123')
    })

    it('should throw when no invitation code provided', async () => {
      await expect(register({
        email: 'test@test.com',
        password: 'pass',
        name: 'Test',
      })).rejects.toThrow('Se requiere código de invitación')
    })

    it('should throw with invalid invitation code', async () => {
      mockInvitation.validateCode.mockResolvedValue({ valid: false, client_id: null })

      await expect(register(passengerPayload)).rejects.toThrow('Código de invitación inválido o expirado')
    })

    it('should link passenger to existing client when client_id is provided', async () => {
      mockInvitation.validateCode.mockResolvedValue({ valid: true, client_id: '5' })
      mockPrisma.invitation_codes.findUnique.mockResolvedValue({
        driver_id: BigInt(1),
        client_id: BigInt(5),
      })
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-uuid-456' } },
        error: null,
      })

      let capturedTx: any = null
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          users: { upsert: jest.fn().mockResolvedValue({ id: BigInt(20) }) },
          clients: { create: jest.fn() },
          client_passengers: { create: jest.fn() },
          invitation_codes: { update: jest.fn().mockResolvedValue({}) },
        }
        capturedTx = tx
        return cb(tx)
      })
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      })

      await register({ ...passengerPayload, invitation_code: 'DEF456' })

      expect(capturedTx.client_passengers.create).toHaveBeenCalledWith({
        data: { client_id: BigInt(5), user_id: BigInt(20) },
      })
      expect(capturedTx.clients.create).not.toHaveBeenCalled()
    })

    it('should create new client when invitation has no client_id', async () => {
      mockInvitation.validateCode.mockResolvedValue({ valid: true, client_id: null })
      mockPrisma.invitation_codes.findUnique.mockResolvedValue({
        driver_id: BigInt(1),
        client_id: null,
      })
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-uuid-789' } },
        error: null,
      })

      let capturedTx: any = null
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          users: { upsert: jest.fn().mockResolvedValue({ id: BigInt(30) }) },
          clients: { create: jest.fn().mockResolvedValue({ id: BigInt(10) }) },
          client_passengers: { create: jest.fn() },
          invitation_codes: { update: jest.fn().mockResolvedValue({}) },
        }
        capturedTx = tx
        return cb(tx)
      })
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      })

      await register({ ...passengerPayload, phone: '5411223344' })

      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '5411223344' })
      )
      expect(capturedTx.clients.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombre: 'Juan Pérez',
            phone: '5411223344',
            driver_id: BigInt(1),
          }),
        })
      )
    })

    it('should throw on Supabase auth error', async () => {
      mockInvitation.validateCode.mockResolvedValue({ valid: true, client_id: null })
      mockPrisma.invitation_codes.findUnique.mockResolvedValue({
        driver_id: BigInt(1),
        client_id: null,
      })
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Email already registered' },
      })

      await expect(register(passengerPayload)).rejects.toThrow('Email already registered')
    })
  })

  describe('login', () => {
    it('should return session on valid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null,
      })

      const result = await login({ email: 'test@test.com', password: 'pass' })

      expect(result).toEqual({ session: { access_token: 'token' } })
    })

    it('should throw on invalid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid login credentials' },
      })

      await expect(login({ email: 'bad@test.com', password: 'wrong' })).rejects.toThrow('Invalid login credentials')
    })
  })

  describe('logout', () => {
    it('should call supabase admin signOut', async () => {
      mockSupabase.auth.admin.signOut.mockResolvedValue({ error: null })

      await logout('token-123')

      expect(mockSupabase.auth.admin.signOut).toHaveBeenCalledWith('token-123')
    })
  })

  describe('refreshSession', () => {
    it('should return new session', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: { access_token: 'new-token' } },
        error: null,
      })

      const result = await refreshSession('refresh-token')

      expect(result).toEqual({ session: { access_token: 'new-token' } })
    })
  })
})
