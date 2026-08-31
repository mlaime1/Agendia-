import { $Enums } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { supabase } from '../../lib/supabase'
import { AppError } from '../../utils/AppError'
import { sanitizePhone } from '../../utils/phone'
import { UpdateUserDTO } from './types'

export async function getMe(authId: string, phone?: string) {
  const user = await prisma.users.findUnique({
    where: { auth_id: authId },
    select: {
      id: true,
      created_at: true,
      name: true,
      email: true,
      alias: true,
      role: true,
    }
  })

  if (user) {
    const clients = user.role === 'PASSENGER'
      ? await prisma.client_passengers.findMany({
          where: { user_id: user.id },
          select: {
            client_id: true,
            client: { select: { nombre: true, driver_id: true } },
          },
        })
      : []

    return {
      ...user,
      phone: phone ?? null,
      type: user.role.toLowerCase() as 'driver' | 'admin' | 'passenger',
      ...(clients.length > 0 ? {
        clients: clients.map((c) => ({
          id: c.client_id.toString(),
          nombre: c.client.nombre,
          driver_id: c.client.driver_id?.toString(),
        })),
      } : {}),
    }
  }

  const client = await prisma.clients.findUnique({
    where: { auth_id: authId },
    select: {
      id: true,
      nombre: true,
    }
  })

  if (client) {
    return {
      type: 'client' as const,
      role: 'client' as const,
      id: client.id,
      linked_client_id: client.id.toString(),
      name: client.nombre,
      phone: phone ?? null,
    }
  }

  throw new AppError('Usuario no encontrado', 404)
}

export async function updateMe(dbId: bigint, authId: string, role: $Enums.Role | 'client', dto: UpdateUserDTO) {
  if (role === 'client') {
    throw new AppError('Los clientes no pueden editar su perfil con este endpoint', 400)
  }

  let updatedPhone: string | undefined

  if (dto.phone !== undefined) {
    updatedPhone = sanitizePhone(dto.phone)
    const { data, error } = await supabase.auth.admin.updateUserById(authId, {
      phone: updatedPhone,
      phone_confirm: true,
    })

    if (error || !data.user) {
      throw new AppError(error?.message ?? 'No se pudo actualizar el teléfono', 400)
    }
  }

  const { phone: _phone, ...profileData } = dto

  const user = await prisma.users.update({
    where: { id: dbId },
    data: profileData,
    select: {
      id: true,
      name: true,
      email: true,
      alias: true,
      role: true,
    }
  })

  return updatedPhone !== undefined ? { ...user, phone: updatedPhone } : user
}

export async function getAll() {
  return prisma.users.findMany({
    select: {
      id: true,
      created_at: true,
      name: true,
      email: true,
      alias: true,
      role: true,
    },
    orderBy: { created_at: 'desc' }
  })
}
