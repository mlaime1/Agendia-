import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../config/env'
import { AppError } from '../utils/AppError'

export interface MailMessage {
  to: string
  subject: string
  text: string
}

export interface MailTransport {
  name: string
  send(message: MailMessage): Promise<void>
}

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!transporter) {
    const hasCredentials = Boolean(env.mail.smtp.user)

    transporter = nodemailer.createTransport({
      host: env.mail.smtp.host?.trim(),
      port: env.mail.smtp.port,
      secure: env.mail.smtp.secure,
      // With credentials, refuse to authenticate over a plaintext channel.
      requireTLS: hasCredentials && !env.mail.smtp.secure,
      auth: hasCredentials
        ? { user: env.mail.smtp.user, pass: env.mail.smtp.pass ?? '' }
        : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }
  return transporter
}

export const smtpTransport: MailTransport = {
  name: 'smtp',
  async send({ to, subject, text }) {
    await getTransporter().sendMail({ from: env.mail.from, to, subject, text })
  },
}

/**
 * Mail is the only delivery channel. Without SMTP configuration the send fails
 * loudly instead of pretending to deliver: the recovery flow would otherwise
 * replace a password with a value that never left the server.
 */
export function resolveTransport(): MailTransport {
  if (!env.mail.smtp.host?.trim()) {
    throw new AppError(
      'SMTP_HOST no está configurado: no se puede enviar el mail de recuperación',
      500
    )
  }

  return smtpTransport
}

export async function sendMail(message: MailMessage): Promise<void> {
  await resolveTransport().send(message)
}
