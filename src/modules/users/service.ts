import { prisma } from '../../config/prisma'
import { UpdateUserDTO } from './types'

export async function getMe(dbId: bigint) {
  return prisma.users.findUnique({
    where: { id: dbId },
    select: {
      id: true,
      created_at: true,
      name: true,
      email: true,
      alias: true,
      role: true
    }
  })
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