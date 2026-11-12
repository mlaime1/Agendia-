const mockSendMail = jest.fn()

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
  },
}))

jest.mock('../../../src/config/env', () => ({
  env: {
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
  },
}))

import { env } from '../../../src/config/env'
import { resolveTransport, sendMail } from '../../../src/lib/mail'

const mutableEnv = env as any

describe('mail transport', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mutableEnv.mail.smtp.host = undefined
    mutableEnv.mail.smtp.user = undefined
  })

  it('refuses to send when SMTP is not configured', () => {
    let caught: any
    try {
      resolveTransport()
    } catch (error) {
      caught = error
    }

    expect(caught?.statusCode).toBe(500)
    expect(caught?.message).toContain('SMTP_HOST')
  })

  it('rejects the send instead of silently dropping the message', async () => {
    await expect(
      sendMail({ to: 'driver@mail.com', subject: 'asunto', text: 'cuerpo' })
    ).rejects.toMatchObject({ statusCode: 500 })
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('uses the SMTP transport when a host is configured', () => {
    mutableEnv.mail.smtp.host = 'smtp-relay.brevo.com'

    expect(resolveTransport().name).toBe('smtp')
  })

  it('sends through nodemailer with the configured sender', async () => {
    mutableEnv.mail.smtp.host = 'smtp-relay.brevo.com'
    mutableEnv.mail.smtp.user = 'user@smtp-brevo.com'
    mutableEnv.mail.smtp.pass = 'key'

    await sendMail({ to: 'driver@mail.com', subject: 'asunto', text: 'cuerpo' })

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'Agendia <no-reply@test>',
      to: 'driver@mail.com',
      subject: 'asunto',
      text: 'cuerpo',
    })
  })
})
