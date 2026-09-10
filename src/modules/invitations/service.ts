import { prisma } from '../../config/prisma'
import { AppError } from '../../utils/AppError'
import { CreateInvitationDTO } from './types'
import crypto from 'crypto'

function generateCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

export async function create(driverId: bigint, dto: CreateInvitationDTO) {
  if (dto.client_id) {
    const client = await prisma.passenger.findUnique({
      where: { id: BigInt(dto.client_id) },
      select: { driver_id: true },
    })
    if (!client) throw new AppError('Cliente no encontrado', 404)
    if (client.driver_id !== driverId) throw new AppError('El cliente no te pertenece', 403)
  }

  const code = generateCode()

  const invitation = await prisma.invitation_codes.create({
    data: {
      code,
      driver_id: driverId,
      client_id: dto.client_id ? BigInt(dto.client_id) : null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  return {
    code: invitation.code,
    expires_at: invitation.expires_at,
  }
}

export async function findByDriver(driverId: bigint) {
  const invitations = await prisma.invitation_codes.findMany({
    where: { driver_id: driverId },
    orderBy: { created_at: 'desc' },
    include: {
      passenger: { select: { id: true, nombre: true } },
      used_by: { select: { id: true, name: true } },
    },
  })

  // Wire contract: the passenger relation is exposed as `client`.
  return invitations.map(({ passenger, ...rest }) => ({
    ...rest,
    client: passenger,
  }))
}

export async function validateCode(code: string) {
  const invitation = await prisma.invitation_codes.findUnique({
    where: { code },
    select: {
      id: true,
      client_id: true,
      expires_at: true,
      used_at: true,
    },
  })

  if (!invitation) {
    return { valid: false, client_id: null }
  }

  if (invitation.used_at) {
    return { valid: false, client_id: null }
  }

  if (new Date() > invitation.expires_at) {
    return { valid: false, client_id: null }
  }

  return {
    valid: true,
    client_id: invitation.client_id?.toString() ?? null,
  }
}

export async function consumeCode(code: string, userId: bigint) {
  const result = await prisma.invitation_codes.updateMany({
    where: {
      code,
      used_at: null,
      expires_at: { gte: new Date() },
    },
    data: {
      used_at: new Date(),
      used_by_id: userId,
    },
  })
  if (result.count === 0) {
    throw new AppError('Código de invitación inválido o expirado', 400)
  }
}
