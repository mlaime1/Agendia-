import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import {
  CreateSummaryManualDTO,
  CreateSummaryAutoDTO,
  UpdateSummaryStatusDTO,
} from './types'
import { calculateBillingPeriod } from './billingPeriod'

 
const normalizeBillingCycle = (value: string): string => {
  const map: Record<string, string> = {
    mensual: 'monthly',
    semanal: 'weekly',
    quincenal: 'biweekly',
  }

  return map[value.toLowerCase()] ?? value
}


const summaryInclude = {
  clients: true,
  users: true,
  trips: {
    include: {
      routes: true,
    },
    orderBy: { trip_date: 'asc' as const },
  },
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const buildSummary = async (
  clientId: bigint,
  driverId: bigint,
  periodStart: Date,
  periodEnd: Date,
  periodType: string,
  notes?: string
) => {
  // period_end incluye todo el día
  const periodEndInclusive = new Date(periodEnd)
  periodEndInclusive.setUTCHours(23, 59, 59, 999)

  const trips = await prisma.trips.findMany({
    where: {
      client_id: clientId,
      summary_id: null,
      trip_date: {
        gte: periodStart,
        lte: periodEndInclusive,
      },
    },
  })

  if (trips.length === 0) {
    throw new Error('No hay viajes sin resumen para el período indicado')
  }

  const totalAmount = trips.reduce(
    (acc, trip) => acc.add(trip.final_price),
    new Prisma.Decimal(0)
  )

  const summary = await prisma.summaries.create({
    data: {
      client_id: clientId,
      driver_id: driverId,
      period_start: periodStart,
      period_end: periodEnd,
      period_type: periodType,
      total_trips: trips.length,
      total_amount: totalAmount,
      status: 'draft',
      notes: notes ?? null,
      trips: {
        connect: trips.map((t) => ({ id: t.id })),
      },
    },
    include: summaryInclude,
  })

  return summary
}

// ─── Crear manual ─────────────────────────────────────────────────────────────
// El usuario elige el rango libremente desde el panel

export const createSummaryManual = async (dto: CreateSummaryManualDTO) => {
  const clientId = BigInt(dto.client_id)
  const driverId = BigInt(dto.driver_id)
  const periodStart = new Date(dto.period_start)
  const periodEnd = new Date(dto.period_end)

  // Obtener billing_cycle del cliente para guardarlo en period_type
  const client = await prisma.clients.findUnique({
    where: { id: clientId },
    select: { billing_cycle: true },
  })

  const periodType = client?.billing_cycle ?? 'manual'

  return buildSummary(clientId, driverId, periodStart, periodEnd, periodType, dto.notes)
}

// ─── Crear automático ─────────────────────────────────────────────────────────
// Calcula el período según la config del cliente

export const createSummaryAuto = async (
  clientId: string,
  dto: CreateSummaryAutoDTO
) => {
  const clientBigInt = BigInt(clientId)

  const client = await prisma.clients.findUnique({
    where: { id: clientBigInt },
    select: {
      billing_cycle: true,
      billing_day: true,
      billing_start_date: true,
    },
  })

  if (!client) throw new Error('Cliente no encontrado')

  if (!client.billing_cycle) {
    throw new Error('El cliente no tiene configurado un ciclo de facturación')
  }

  const referenceDate = dto.reference_date
    ? new Date(dto.reference_date)
    : new Date()

  const normalizedCycle = normalizeBillingCycle(client.billing_cycle)

  const { period_start, period_end, period_type } = calculateBillingPeriod(
    {
      billing_cycle: normalizedCycle,
      billing_day: client.billing_day,
      billing_start_date: client.billing_start_date,
    },
    referenceDate
  )

  // Evitar duplicados: verificar si ya existe un summary para este cliente y período
  const existing = await prisma.summaries.findFirst({
    where: {
      client_id: clientBigInt,
      period_start: period_start,
      period_end: period_end,
    },
  })

  if (existing) {
    throw new Error(
      `Ya existe un resumen para este período (id: ${existing.id})`
    )
  }

  return buildSummary(
    clientBigInt,
    BigInt(dto.driver_id),
    period_start,
    period_end,
    period_type,
    dto.notes
  )
}

// ─── Consultas ────────────────────────────────────────────────────────────────

export const getAllByClient = async (clientId: string) => {
  return prisma.summaries.findMany({
    where: { client_id: BigInt(clientId) },
    include: summaryInclude,
    orderBy: { period_start: 'desc' },
  })
}

export const getById = async (id: string) => {
  const summary = await prisma.summaries.findUnique({
    where: { id: BigInt(id) },
    include: summaryInclude,
  })

  if (!summary) throw new Error('Resumen no encontrado')
  return summary
}

// ─── Actualizar status ────────────────────────────────────────────────────────

export const updateStatus = async (id: string, dto: UpdateSummaryStatusDTO) => {
  const now = new Date()

  const extraFields: Partial<{
    sent_at: Date
    paid_at: Date
    archived_at: Date
  }> = {}

  if (dto.status === 'sent') extraFields.sent_at = now
  if (dto.status === 'paid') extraFields.paid_at = now
  if (dto.status === 'archived') extraFields.archived_at = now

  return prisma.summaries.update({
    where: { id: BigInt(id) },
    data: {
      status: dto.status,
      ...extraFields,
    },
    include: summaryInclude,
  })
}

// ─── Eliminar ─────────────────────────────────────────────────────────────────

export const deleteSummary = async (id: string) => {
  const summaryId = BigInt(id)

  // Desvincular viajes antes de borrar
  await prisma.trips.updateMany({
    where: { summary_id: summaryId },
    data: { summary_id: null },
  })

  return prisma.summaries.delete({
    where: { id: summaryId },
  })
}

// ─── Preview del período activo ───────────────────────────────────────────────
// Util para mostrar en el panel antes de confirmar la generación automática

export const previewBillingPeriod = async (clientId: string, referenceDate?: string) => {
  const client = await prisma.clients.findUnique({
    where: { id: BigInt(clientId) },
    select: {
      nombre: true,
      billing_cycle: true,
      billing_day: true,
      billing_start_date: true,
    },
  })

  if (!client) throw new Error('Cliente no encontrado')
  if (!client.billing_cycle) throw new Error('El cliente no tiene ciclo de facturación configurado')

  const ref = referenceDate ? new Date(referenceDate) : new Date()
  const period = calculateBillingPeriod(
    {
      billing_cycle: client.billing_cycle,
      billing_day: client.billing_day,
      billing_start_date: client.billing_start_date,
    },
    ref
  )

  // Contar viajes disponibles para ese período (sin summary aún)
  const availableTrips = await prisma.trips.count({
    where: {
      client_id: BigInt(clientId),
      summary_id: null,
      trip_date: {
        gte: period.period_start,
        lte: (() => {
          const d = new Date(period.period_end)
          d.setUTCHours(23, 59, 59, 999)
          return d
        })(),
      },
    },
  })

  return {
    client: client.nombre,
    billing_cycle: client.billing_cycle,
    period_start: period.period_start,
    period_end: period.period_end,
    period_type: period.period_type,
    available_trips: availableTrips,
  }
}