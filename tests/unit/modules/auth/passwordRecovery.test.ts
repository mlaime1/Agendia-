jest.mock('../../../../src/config/env', () => ({
  env: {
    nodeEnv: 'test',
    mail: { from: 'Agendia <no-reply@test>', smtp: {} },
    passwordRecovery: {
      cooldownMinutes: 10,
      ipRequestsPerHour: 20,
      temporaryPasswordLength: 12,
    },
  },
}))

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    users: {
      findFirst: jest.fn(),
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

jest.mock('../../../../src/lib/mail', () => ({
  sendMail: jest.fn(),
}))

import { requestPasswordRecovery } from '../../../../src/modules/auth/service'
import { supabase } from '../../../../src/lib/supabase'
import { prisma } from '../../../../src/config/prisma'
import { sendMail } from '../../../../src/lib/mail'

const mockSupabase = supabase as any
const mockPrisma = prisma as any
const mockSendMail = sendMail as jest.MockedFunction<typeof sendMail>

const GENERIC_MESSAGE =
  'Si el correo está registrado, te enviamos una contraseña temporal.'

describe('auth/service requestPasswordRecovery', () => {
  beforeEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
    mockSendMail.mockResolvedValue(undefined)
    mockSupabase.auth.admin.updateUserById.mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    })
  })

  it('mails a temporary password and applies it to the auth account', async () => {
    mockPrisma.users.findFirst.mockResolvedValue({
      id: BigInt(1),
      auth_id: 'auth-uuid',
    })

    const result = await requestPasswordRecovery({ email: 'Driver.One@Mail.com' })

    expect(mockPrisma.users.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'driver.one@mail.com', mode: 'insensitive' } },
      })
    )
    expect(mockSendMail).toHaveBeenCalledTimes(1)

    const [[authId, payload]] = mockSupabase.auth.admin.updateUserById.mock.calls
    expect(authId).toBe('auth-uuid')
    expect(payload.password).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{12}$/)

    const message = mockSendMail.mock.calls[0][0]
    expect(message.to).toBe('driver.one@mail.com')
    expect(message.text).toContain(payload.password)
    expect(result.message).toBe(GENERIC_MESSAGE)
  })

  it('does not reveal whether the email exists', async () => {
    mockPrisma.users.findFirst.mockResolvedValue(null)

    const result = await requestPasswordRecovery({ email: 'nobody@mail.com' })

    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(mockSendMail).not.toHaveBeenCalled()
    expect(result.message).toBe(GENERIC_MESSAGE)
  })

  it('never returns the temporary password in the response', async () => {
    mockPrisma.users.findFirst.mockResolvedValue({ id: BigInt(5), auth_id: 'auth-uuid-5' })

    const result = await requestPasswordRecovery({ email: 'payload@mail.com' })

    const [[, payload]] = mockSupabase.auth.admin.updateUserById.mock.calls
    expect(JSON.stringify(result)).not.toContain(payload.password)
  })

  it('rejects a malformed email before touching auth or mail', async () => {
    await expect(requestPasswordRecovery({ email: 'no-es-mail' })).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(mockPrisma.users.findFirst).not.toHaveBeenCalled()
    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('rejects an oversized email before hitting the database', async () => {
    const oversized = `${'a'.repeat(250)}@mail.com`

    await expect(requestPasswordRecovery({ email: oversized })).rejects.toMatchObject({
      statusCode: 400,
    })
    expect(mockPrisma.users.findFirst).not.toHaveBeenCalled()
  })

  it('throttles a repeated request for the same email', async () => {
    mockPrisma.users.findFirst.mockResolvedValue({
      id: BigInt(2),
      auth_id: 'auth-uuid-2',
    })

    await requestPasswordRecovery({ email: 'throttled@mail.com' })

    await expect(
      requestPasswordRecovery({ email: 'throttled@mail.com' })
    ).rejects.toMatchObject({ statusCode: 429 })

    expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledTimes(1)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
  })

  it('throttles unknown emails too, so a 429 cannot leak existence', async () => {
    mockPrisma.users.findFirst.mockResolvedValue(null)

    await requestPasswordRecovery({ email: 'unknown-throttled@mail.com' })

    await expect(
      requestPasswordRecovery({ email: 'unknown-throttled@mail.com' })
    ).rejects.toMatchObject({ statusCode: 429 })
  })

  it('allows a retry once the cooldown window expires', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
    mockPrisma.users.findFirst.mockResolvedValue(null)

    await requestPasswordRecovery({ email: 'expiry@mail.com' })
    await expect(
      requestPasswordRecovery({ email: 'expiry@mail.com' })
    ).rejects.toMatchObject({ statusCode: 429 })

    jest.setSystemTime(new Date('2026-01-01T00:10:01Z'))

    await expect(requestPasswordRecovery({ email: 'expiry@mail.com' })).resolves.toBeTruthy()
  })

  it('limits requests per client ip across different emails', async () => {
    mockPrisma.users.findFirst.mockResolvedValue(null)

    for (let index = 0; index < 20; index += 1) {
      await requestPasswordRecovery({ email: `bulk-${index}@mail.com` }, '10.0.0.9')
    }

    await expect(
      requestPasswordRecovery({ email: 'bulk-final@mail.com' }, '10.0.0.9')
    ).rejects.toMatchObject({ statusCode: 429 })
  })

  it('keeps the current password when the mail cannot be delivered', async () => {
    mockPrisma.users.findFirst.mockResolvedValue({
      id: BigInt(3),
      auth_id: 'auth-uuid-3',
    })
    mockSendMail.mockRejectedValueOnce(new Error('smtp down'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const result = await requestPasswordRecovery({ email: 'undeliverable@mail.com' })
    errorSpy.mockRestore()

    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(result.message).toBe(GENERIC_MESSAGE)
  })

  it('lets the user retry after a failed delivery', async () => {
    mockPrisma.users.findFirst.mockResolvedValue({ id: BigInt(7), auth_id: 'auth-uuid-7' })
    mockSendMail.mockRejectedValueOnce(new Error('smtp down'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await requestPasswordRecovery({ email: 'retry@mail.com' })
    const retried = await requestPasswordRecovery({ email: 'retry@mail.com' })
    errorSpy.mockRestore()

    expect(retried).toEqual({ message: GENERIC_MESSAGE })
    expect(mockSupabase.auth.admin.updateUserById).toHaveBeenCalledTimes(1)
  })

  it('does not surface auth errors and releases the cooldown', async () => {
    mockPrisma.users.findFirst.mockResolvedValue({ id: BigInt(6), auth_id: 'auth-uuid-6' })
    mockSupabase.auth.admin.updateUserById.mockResolvedValue({
      data: {},
      error: { message: 'LEAK service_role detail', status: 500 },
    })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const result = await requestPasswordRecovery({ email: 'autherr@mail.com' })
    errorSpy.mockRestore()

    expect(JSON.stringify(result)).not.toContain('LEAK')
    await expect(requestPasswordRecovery({ email: 'autherr@mail.com' })).resolves.toBeTruthy()
  })

  it('generates a temporary password without ambiguous characters', async () => {
    mockPrisma.users.findFirst.mockResolvedValue({
      id: BigInt(4),
      auth_id: 'auth-uuid-4',
    })

    await requestPasswordRecovery({ email: 'ambiguous@mail.com' })

    const [[, payload]] = mockSupabase.auth.admin.updateUserById.mock.calls
    expect(payload.password).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/)
  })
})
