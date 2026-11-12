import crypto from 'crypto'
import { supabase } from '../../lib/supabase'
import { prisma } from '../../config/prisma'
import { env } from '../../config/env'
import { AppError } from '../../utils/AppError'
import { RegisterDTO, LoginDTO, PasswordRecoveryDTO } from './types'
import * as invitationService from '../invitations/service'
import { sanitizePhone } from '../../utils/phone'
import { sendMail } from '../../lib/mail'
import { createRateLimiter } from './rateLimiter'

function getProfileName(name: string | undefined, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return email.split('@')[0] || 'Sin nombre'
}

async function registerDriver({ email, password, name, alias, phone }: RegisterDTO) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    email_confirm: true,
    ...(phone !== undefined ? { phone: sanitizePhone(phone) } : {}),
  })

  if (error) throw new AppError(error.message, 400)
  if (!data.user) throw new AppError('No se pudo crear el usuario en Auth', 500)

  const profileName = getProfileName(name, email)
  await prisma.users.upsert({
    where: { auth_id: data.user.id },
    update: { name: profileName, email, ...(alias !== undefined ? { alias } : {}) },
    create: {
      auth_id: data.user.id,
      name: profileName,
      email,
      role: 'DRIVER',
      ...(alias !== undefined ? { alias } : {}),
    },
  })

  const session = await supabase.auth.signInWithPassword({ email, password })
  if (session.error) throw new AppError(session.error.message, 401)

  return session.data
}

async function registerPassenger({ email, password, name, invitation_code, phone }: RegisterDTO) {
  if (!invitation_code) {
    throw new AppError('Código de invitación requerido', 400)
  }

  const validation = await invitationService.validateCode(invitation_code)
  if (!validation.valid) {
    throw new AppError('Código de invitación inválido o expirado', 400)
  }

  const invitation = await prisma.invitation_codes.findUnique({
    where: { code: invitation_code },
    select: { driver_id: true, client_id: true },
  })
  if (!invitation) {
    throw new AppError('Código de invitación no encontrado', 404)
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    email_confirm: true,
    ...(phone !== undefined ? { phone: sanitizePhone(phone) } : {}),
  })

  if (error) throw new AppError(error.message, 400)
  if (!data.user) throw new AppError('No se pudo crear el usuario en Auth', 500)

  const profileName = getProfileName(name, email)

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.users.upsert({
      where: { auth_id: data.user!.id },
      update: { role: 'CLIENT', name: profileName, email },
      create: {
        auth_id: data.user!.id,
        name: profileName,
        email,
        role: 'CLIENT',
      },
    })

    let clientId: bigint

    if (invitation.client_id) {
      clientId = invitation.client_id
    } else {
      const newClient = await tx.passenger.create({
        data: {
          nombre: name,
          phone: phone ?? '0',
          billing_cycle: 'monthly',
          billing_day: 1,
          driver_id: invitation.driver_id,
          // Self-management link: the registering account owns this passenger.
          auth_id: data.user!.id,
        },
      })
      clientId = newClient.id
    }

    await tx.passenger_client_access.create({
      data: {
        passenger_id: clientId,
        client_user_id: user.id,
      },
    })

    await tx.invitation_codes.update({
      where: { code: invitation_code },
      data: {
        used_at: new Date(),
        used_by_id: user.id,
      },
    })

    return user
  })

  const session = await supabase.auth.signInWithPassword({ email, password })
  if (session.error) throw new AppError(session.error.message, 401)

  return {
    ...session.data,
    user_role: 'PASSENGER',
  }
}

export async function register(dto: RegisterDTO) {
  if (dto.invitation_code) {
    return registerPassenger(dto)
  }
  throw new AppError('Registro cerrado. Se requiere código de invitación.', 403)
}

export async function login({ email, password }: LoginDTO) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new AppError(error.message, 401)
  return data
}

export async function logout(accessToken: string) {
  const { error } = await supabase.auth.admin.signOut(accessToken)
  if (error) throw new AppError(error.message, 400)
}

export async function refreshSession(refreshToken: string) {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
  if (error) throw new AppError(error.message, 401)
  return data
}

export async function registerAdmin(dto: RegisterDTO) {
  return registerDriver(dto)
}

// Same answer whether or not the email is registered, so the endpoint
// cannot be used to discover which accounts exist.
const RECOVERY_MESSAGE =
  'Si el correo está registrado, te enviamos una contraseña temporal.'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Ambiguous characters (0/O, 1/l/I) are excluded: the password is retyped
// from a mail, often on a phone.
const UPPERCASE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWERCASE_CHARS = 'abcdefghijkmnopqrstuvwxyz'
const DIGIT_CHARS = '23456789'
const ALL_CHARS = UPPERCASE_CHARS + LOWERCASE_CHARS + DIGIT_CHARS

const COOLDOWN_MAX_ENTRIES = 10000
const MAX_EMAIL_LENGTH = 254

// In-memory limits: keyed by email and by client IP, both applied before the
// lookup, so a throttled answer never reveals whether the account exists.
const emailLimiter = createRateLimiter({
  limit: 1,
  windowMs: env.passwordRecovery.cooldownMinutes * 60 * 1000,
  maxKeys: COOLDOWN_MAX_ENTRIES,
})

const ipLimiter = createRateLimiter({
  limit: env.passwordRecovery.ipRequestsPerHour,
  windowMs: 60 * 60 * 1000,
  maxKeys: COOLDOWN_MAX_ENTRIES,
})

function pickChar(source: string): string {
  return source[crypto.randomInt(source.length)]
}

export function generateTemporaryPassword(
  length: number = env.passwordRecovery.temporaryPasswordLength
): string {
  if (length < 3) throw new AppError('La contraseña temporal es demasiado corta', 500)

  const chars = [
    pickChar(UPPERCASE_CHARS),
    pickChar(LOWERCASE_CHARS),
    pickChar(DIGIT_CHARS),
  ]

  while (chars.length < length) {
    chars.push(pickChar(ALL_CHARS))
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1)
    const swap = chars[i]
    chars[i] = chars[j]
    chars[j] = swap
  }

  return chars.join('')
}

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function assertValidEmail(email: string): void {
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new AppError('Ingresá un correo electrónico válido', 400)
  }
}

function assertWithinLimits(email: string, clientIp: string | undefined): void {
  if (clientIp && !ipLimiter.hit(clientIp)) {
    throw new AppError(
      'Demasiados pedidos de restablecimiento desde esta conexión. Probá más tarde',
      429
    )
  }

  if (!emailLimiter.hit(email)) {
    throw new AppError(
      'Esperá unos minutos antes de volver a pedir el restablecimiento',
      429
    )
  }
}

function releaseLimit(email: string): void {
  emailLimiter.reset(email)
}

function buildRecoveryMessage(email: string, temporaryPassword: string) {
  return {
    to: email,
    subject: 'Agendia: tu contraseña temporal',
    text: [
      'Recibimos un pedido para recuperar el acceso a tu cuenta de Agendia.',
      '',
      `Contraseña temporal: ${temporaryPassword}`,
      '',
      'Ingresá con esa contraseña y cambiala desde Perfil → Cambiar contraseña.',
      'La contraseña anterior deja de ser válida en cuanto usás la temporal.',
      '',
      'Si no pediste este cambio, avisale a tu administrador.',
    ].join('\n'),
  }
}

/**
 * Emails a temporary password and applies it to the Auth account.
 *
 * The mail is sent before the password is replaced on purpose: if delivery
 * fails, the current password is left untouched instead of locking the owner
 * out with a password nobody received.
 */
export async function requestPasswordRecovery(
  { email }: PasswordRecoveryDTO,
  clientIp?: string
) {
  const normalizedEmail = normalizeEmail(email)

  assertValidEmail(normalizedEmail)
  assertWithinLimits(normalizedEmail, clientIp)

  const profile = await prisma.users.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { auth_id: true },
  })

  if (!profile?.auth_id) {
    return { message: RECOVERY_MESSAGE }
  }

  const temporaryPassword = generateTemporaryPassword()

  try {
    await sendMail(buildRecoveryMessage(normalizedEmail, temporaryPassword))
  } catch (error) {
    console.error(
      `[auth] No se envió la contraseña temporal a ${normalizedEmail}; la contraseña actual no se modificó`,
      error
    )
    releaseLimit(normalizedEmail)
    return { message: RECOVERY_MESSAGE }
  }

  const { error } = await supabase.auth.admin.updateUserById(profile.auth_id, {
    password: temporaryPassword,
  })

  if (error) {
    console.error(
      `[auth] El mail con la contraseña temporal salió pero Auth rechazó el cambio para ${normalizedEmail}`,
      error
    )
    releaseLimit(normalizedEmail)
  }

  return { message: RECOVERY_MESSAGE }
}
