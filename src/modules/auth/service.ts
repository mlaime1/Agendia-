import { supabase } from '../../lib/supabase'
import { prisma } from '../../config/prisma'
import { env } from '../../config/env'
import { AppError } from '../../utils/AppError'
import { RegisterDTO, LoginDTO } from './types'
import * as invitationService from '../invitations/service'

function getProfileName(name: string | undefined, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return email.split('@')[0] || 'Sin nombre'
}

async function registerDriver({ email, password, name, alias }: RegisterDTO) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    email_confirm: true,
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
  })

  if (error) throw new AppError(error.message, 400)
  if (!data.user) throw new AppError('No se pudo crear el usuario en Auth', 500)

  const profileName = getProfileName(name, email)

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.users.upsert({
      where: { auth_id: data.user!.id },
      update: { role: 'PASSENGER', name: profileName, email },
      create: {
        auth_id: data.user!.id,
        name: profileName,
        email,
        role: 'PASSENGER',
      },
    })

    let clientId: bigint

    if (invitation.client_id) {
      clientId = invitation.client_id
    } else {
      const newClient = await tx.clients.create({
        data: {
          nombre: name,
          phone: phone ?? '0',
          billing_cycle: 'monthly',
          driver_id: invitation.driver_id,
        },
      })
      clientId = newClient.id
    }

    await tx.client_passengers.create({
      data: {
        client_id: clientId,
        user_id: user.id,
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
