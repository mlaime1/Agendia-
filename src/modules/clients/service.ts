import { prisma } from '../../config/prisma'
import { CreateClientDTO, UpdateClientDTO, UpdateBillingConfigDTO } from './types'

const clientInclude = {
  routes: true,
  summaries: {
    orderBy: { period_start: 'desc' as const },
    take: 5, // últimos 5 resúmenes en el detalle
  },
}

// ─── Validaciones de billing ──────────────────────────────────────────────────

const validateBillingConfig = (
  billing_cycle: string,
  billing_day?: number | null,
  billing_start_date?: string | null
) => {
  if (billing_cycle === 'weekly') {
    if (billing_day == null) {
      throw new Error('billing_day es requerido para ciclo semanal (1=lun … 7=dom)')
    }
    if (billing_day < 1 || billing_day > 7) {
      throw new Error('billing_day para ciclo semanal debe ser entre 1 (lunes) y 7 (domingo)')
    }
  }

  if (billing_cycle === 'biweekly') {
    if (!billing_start_date) {
      throw new Error('billing_start_date es requerido para ciclo quincenal')
    }
  }

  if (billing_cycle === 'monthly') {
    if (billing_day == null) {
      throw new Error('billing_day es requerido para ciclo mensual (día del mes: 1-31)')
    }
    if (billing_day < 1 || billing_day > 31) {
      throw new Error('billing_day para ciclo mensual debe ser entre 1 y 31')
    }
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const getAll = async () => {
  return prisma.clients.findMany({
    orderBy: { nombre: 'asc' },
  })
}

export const getById = async (id: string) => {
  const client = await prisma.clients.findUnique({
    where: { id: BigInt(id) },
    include: clientInclude,
  })

  if (!client) throw new Error('Cliente no encontrado')
  return client
}

export const create = async (dto: CreateClientDTO) => {
  validateBillingConfig(dto.billing_cycle, dto.billing_day, dto.billing_start_date)

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
    },
  })
}

export const update = async (id: string, dto: UpdateClientDTO) => {
  // Si viene algún campo de billing, validar la configuración completa
  if (dto.billing_cycle) {
    validateBillingConfig(dto.billing_cycle, dto.billing_day, dto.billing_start_date)
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
    },
  })
}

// ─── Billing config ───────────────────────────────────────────────────────────
// Endpoint dedicado para el panel de configuración de facturación

export const updateBillingConfig = async (id: string, dto: UpdateBillingConfigDTO) => {
  validateBillingConfig(dto.billing_cycle, dto.billing_day, dto.billing_start_date)

  return prisma.clients.update({
    where: { id: BigInt(id) },
    data: {
      billing_cycle: dto.billing_cycle,
      billing_day: dto.billing_day ?? null,
      // Al cambiar el ciclo, limpiar billing_start_date si no aplica
      billing_start_date:
        dto.billing_cycle === 'biweekly' && dto.billing_start_date
          ? new Date(dto.billing_start_date)
          : null,
    },
  })
}

export const remove = async (id: string) => {
  const clientId = BigInt(id)

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