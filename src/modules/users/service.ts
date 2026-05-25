import { prisma } from '../../config/prisma'
import { AppError } from '../../utils/AppError'
import { UpdateUserDTO } from './types'

export async function getMe(authId: string) {
  const user = await prisma.users.findUnique({
    where: { auth_id: authId },
    select: {
      id: true,
      created_at: true,
      name: true,
      email: true,
      alias: true,
      role: true
    }
  })

  if (user) {
    return {
      ...user,
      type: user.role.toLowerCase() as 'driver' | 'admin'
    }
  }

  const client = await prisma.clients.findUnique({
    where: { auth_id: authId },
    select: {
      id: true,
      nombre: true
    }
  })

  if (client) {
    return {
      type: 'client' as const,
      id: client.id,
      name: client.nombre
    }
  }

  throw new AppError('Usuario no encontrado', 404)
}

export async function updateMe(dbId: bigint, dto: UpdateUserDTO) {
  return prisma.users.update({
    where: { id: dbId },
    data: dto,
    select: {
      id: true,
      name: true,
      email: true,
      alias: true,
      role: true
    }
  })
}

export async function getAll() {
  return prisma.users.findMany({
    select: {
      id: true,
      created_at: true,
      name: true,
      email: true,
      alias: true,
      role: true
    },
    orderBy: { created_at: 'desc' }
  })
}