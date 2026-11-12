jest.mock('../../../../src/config/env', () => ({
  env: {
    nodeEnv: 'test',
    mail: {
      from: 'Agendia <no-reply@test>',
      smtp: {
        host: undefined,
        port: 587,
        secure: false,
        user: undefined,
        pass: undefined,
      },
    },
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

// The mail module is NOT mocked here: this suite exercises the real seam
// between the recovery flow and the transport.

import crypto from 'crypto'
import {
  requestPasswordRecovery,
  generateTemporaryPassword,
} from '../../../../src/modules/auth/service'
import { prisma } from '../../../../src/config/prisma'
import { supabase } from '../../../../src/lib/supabase'

const mockPrisma = prisma as any
const mockSupabase = supabase as any

const GENERIC_MESSAGE =
  'Si el correo está registrado, te enviamos una contraseña temporal.'

describe('password recovery through the real mail transport', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fails closed and never prints the temporary password when SMTP is unset', async () => {
    const captured: string[] = []
    const capture = (...args: unknown[]) => {
      captured.push(args.map(String).join(' '))
    }

    const randomSpy = jest.spyOn(crypto as any, 'randomInt').mockReturnValue(0)
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(capture as any),
      jest.spyOn(console, 'info').mockImplementation(capture as any),
      jest.spyOn(console, 'error').mockImplementation(capture as any),
      jest.spyOn(process.stdout, 'write').mockImplementation(((chunk: any) => {
        captured.push(String(chunk))
        return true
      }) as any),
      jest.spyOn(process.stderr, 'write').mockImplementation(((chunk: any) => {
        captured.push(String(chunk))
        return true
      }) as any),
    ]

    const expectedPassword = generateTemporaryPassword()
    mockPrisma.users.findFirst.mockResolvedValue({ auth_id: 'auth-seam' })

    const result = await requestPasswordRecovery({ email: 'seam@mail.com' })

    spies.forEach((spy) => spy.mockRestore())
    randomSpy.mockRestore()

    const output = captured.join('\n')

    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(result).toEqual({ message: GENERIC_MESSAGE })
    expect(output).not.toContain(expectedPassword)
    expect(output).toContain('SMTP_HOST')
  })

  it('exposes no transport that pretends to deliver', () => {
    const mailModule = require('../../../../src/lib/mail') as any

    expect(Object.keys(mailModule).sort()).toEqual([
      'resolveTransport',
      'sendMail',
      'smtpTransport',
    ])
    expect(mailModule.consoleTransport).toBeUndefined()
  })
})
