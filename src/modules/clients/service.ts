import { BillingCycle } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { isValidIANA } from '../../utils/timezone'
import { CreateClientDTO, UpdateClientDTO, UpdateBillingConfigDTO } from './types'
import { AuthUser, getClientAccessLevel } from '../../utils/calendarAuth'
import { AppError } from '../../utils/AppError'

const clientInclude = {
  routes: true,
  summaries: {
    orderBy: { period_start: 'desc' as const },
    take: 5, // últimos 5 resúmenes en el detalle
  },
}

const normalizeBillingCycle = (value: string): BillingCycle => {
  const map: Record<string, BillingCycle> = {
    mensual: 'monthly',
    semanal: 'weekly',
    quincenal: 'biweekly',
  }

  return map[value.toLowerCase()] ?? (value as BillingCycle)
}

// ─── Validaciones de billing ──────────────────────────────────────────────────

const validateBillingConfig = (
  billing_cycle: BillingCycle,
  billing_day?: number | null,
  billing_start_date?: string | null
) => {
  const cycle = normalizeBillingCycle(billing_cycle)

  if (cycle === 'weekly') {
    if (billing_day == null) {
      throw new Error('billing_day es requerido para ciclo semanal (1=lun … 7=dom)')
    }
    if (billing_day < 1 || billing_day > 7) {
      throw new Error('billing_day para ciclo semanal debe ser entre 1 (lunes) y 7 (domingo)')
    }
  }

  if (cycle === 'biweekly') {
    if (!billing_start_date) {
      throw new Error('billing_start_date es requerido para ciclo quincenal')
    }
  }

  if (cycle === 'monthly') {
    if (billing_day == null) {
      throw new Error('billing_day es requerido para ciclo mensual (día del mes: 1-31)')
    }
    if (billing_day < 1 || billing_day > 31) {
      throw new Error('billing_day para ciclo mensual debe ser entre 1 y 31')
    }
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const getAll = async (user: AuthUser) => {
  if (user.role === 'ADMIN') {
    return prisma.clients.findMany({ orderBy: { nombre: 'asc' } })
  }

  const where = user.role === 'DRIVER'
    ? { driver_id: user.dbId }
    : user.role === 'PASSENGER'
      ? { client_passengers: { some: { user_id: user.dbId } } }
      : { id: user.dbId }

  return prisma.clients.findMany({
    where,
    orderBy: { nombre: 'asc' },
  })
}

export const getById = async (id: string, user: AuthUser) => {
  const clientId = BigInt(id)
  if ((await getClientAccessLevel(user, clientId)) === 'none') {
    throw new AppError('No tienes acceso a este cliente', 403)
  }
  const client = await prisma.clients.findUnique({
    where: { id: clientId },
    include: clientInclude,
  })

  if (!client) throw new Error('Cliente no encontrado')
  return client
}

export const create = async (dto: CreateClientDTO, user: AuthUser) => {
  if (user.role !== 'ADMIN' && user.role !== 'DRIVER') {
    throw new AppError('No tienes permisos para crear clientes', 403)
  }
  validateBillingConfig(dto.billing_cycle, dto.billing_day, dto.billing_start_date)

  const tz = dto.timezone ?? 'America/Argentina/Buenos_Aires'
  if (!isValidIANA(tz)) {
    throw new Error(`timezone no es un identificador IANA válido: ${tz}`)
  }

  return prisma.clients.create({
    data: {
      created_at: new Date(),
      nombre: dto.nombre,
      phone: dto.phone,
      billing_cycle: dto.billing_cycle,
      billing_day: dto.billing_day ?? null,
      billing_start_date: dto.billing_start_date
        ? new Date(dto.billing_start_date)
        : null,
      timezone: tz,
      ...(user.role === 'DRIVER' && { driver_id: user.dbId }),
    },
  })
}

export const update = async (id: string, dto: UpdateClientDTO, user: AuthUser) => {
  if ((await getClientAccessLevel(user, BigInt(id))) !== 'full') {
    throw new AppError('No tienes permisos para modificar este cliente', 403)
  }
  // Si viene algún campo de billing, validar la configuración completa
  if (dto.billing_cycle) {
    validateBillingConfig(dto.billing_cycle, dto.billing_day, dto.billing_start_date)
  }

  if (dto.timezone !== undefined && !isValidIANA(dto.timezone)) {
    throw new Error(`timezone no es un identificador IANA válido: ${dto.timezone}`)
  }

  return prisma.clients.update({
    where: { id: BigInt(id) },
    data: {
      ...(dto.nombre && { nombre: dto.nombre }),
      ...(dto.phone && { phone: dto.phone }),
      ...(dto.billing_cycle && { billing_cycle: dto.billing_cycle }),
      ...(dto.billing_day !== undefined && { billing_day: dto.billing_day }),
      ...(dto.billing_start_date !== undefined && {
        billing_start_date: dto.billing_start_date
          ? new Date(dto.billing_start_date)
          : null,
      }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
    },
  })
}

// ─── Billing config ───────────────────────────────────────────────────────────
// Endpoint dedicado para el panel de configuración de facturación

export const updateBillingConfig = async (id: string, dto: UpdateBillingConfigDTO, user: AuthUser) => {
  if ((await getClientAccessLevel(user, BigInt(id))) !== 'full') {
    throw new AppError('No tienes permisos para modificar este cliente', 403)
  }
  const cycle = normalizeBillingCycle(dto.billing_cycle)

  validateBillingConfig(cycle, dto.billing_day, dto.billing_start_date)

  return prisma.clients.update({
    where: { id: BigInt(id) },
    data: {
      billing_cycle: cycle,
      billing_day: dto.billing_day ?? null,
      // Al cambiar el ciclo, limpiar billing_start_date si no aplica
      billing_start_date:
        cycle === 'biweekly' && dto.billing_start_date
          ? new Date(dto.billing_start_date)
          : null,
    },
  })
}

export const remove = async (id: string, user: AuthUser) => {
  const clientId = BigInt(id)

  if ((await getClientAccessLevel(user, clientId)) !== 'full') {
    throw new AppError('No tienes permisos para eliminar este cliente', 403)
  }

  // Verificar que no tenga summaries pendientes de cobro
  const pendingSummaries = await prisma.summaries.count({
    where: {
      client_id: clientId,
      status: { in: ['draft', 'sent'] },
    },
  })

  if (pendingSummaries > 0) {
    throw new Error(
      `El cliente tiene ${pendingSummaries} resumen/es pendiente/s de cobro. Resolvelos antes de eliminar.`
    )
  }

  return prisma.clients.delete({
    where: { id: clientId },
  })
}
