const mockSendMail = jest.fn()
const mockCreateTransport = jest.fn()

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: (options: unknown) => mockCreateTransport(options),
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

interface SmtpOverrides {
  host?: string
  port?: number
  secure?: boolean
  user?: string
  pass?: string
}

/**
 * Each case gets a fresh copy of the mail module: the nodemailer transport is
 * cached per module instance, so the configuration is only observable once.
 */
function loadMail(smtp: SmtpOverrides = {}) {
  jest.resetModules()
  mockCreateTransport.mockReturnValue({ sendMail: mockSendMail })

  const { env } = require('../../../src/config/env') as any
  Object.assign(env.mail.smtp, smtp)

  const mail = require('../../../src/lib/mail') as typeof import('../../../src/lib/mail')

  return mail
}

describe('mail transport', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('refuses to send when SMTP is not configured', () => {
    const mail = loadMail()

    let caught: any
    try {
      mail.resolveTransport()
    } catch (error) {
      caught = error
    }

    expect(caught?.statusCode).toBe(500)
    expect(caught?.message).toContain('SMTP_HOST')
  })

  it('treats a blank SMTP host as missing', () => {
    const mail = loadMail({ host: '   ' })

    expect(() => mail.resolveTransport()).toThrow(/SMTP_HOST/)
  })

  it('rejects the send instead of silently dropping the message', async () => {
    const mail = loadMail()

    await expect(
      mail.sendMail({ to: 'driver@mail.com', subject: 'asunto', text: 'cuerpo' })
    ).rejects.toMatchObject({ statusCode: 500 })
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('uses the SMTP transport when a host is configured', () => {
    const mail = loadMail({ host: 'smtp-relay.brevo.com' })

    expect(mail.resolveTransport().name).toBe('smtp')
  })

  it('sends through nodemailer with the configured sender', async () => {
    const mail = loadMail({ host: 'smtp-relay.brevo.com' })

    await mail.sendMail({ to: 'driver@mail.com', subject: 'asunto', text: 'cuerpo' })

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'Agendia <no-reply@test>',
      to: 'driver@mail.com',
      subject: 'asunto',
      text: 'cuerpo',
    })
  })

  it('requires TLS and bounds timeouts when credentials go over a plaintext port', async () => {
    const mail = loadMail({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      user: 'user@smtp-brevo.com',
      pass: 'key',
    })

    await mail.sendMail({ to: 'driver@mail.com', subject: 'asunto', text: 'cuerpo' })

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'user@smtp-brevo.com', pass: 'key' },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    })
  })

  it('does not require an upgrade on a direct TLS port', async () => {
    const mail = loadMail({
      host: 'smtp-relay.brevo.com',
      port: 465,
      secure: true,
      user: 'user@smtp-brevo.com',
      pass: 'key',
    })

    await mail.sendMail({ to: 'driver@mail.com', subject: 'asunto', text: 'cuerpo' })

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true, requireTLS: false })
    )
  })
})
