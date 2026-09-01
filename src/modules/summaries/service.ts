import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import {
  CreateSummaryManualDTO,
  CreateSummaryAutoDTO,
  UpdateSummaryStatusDTO,
  CreateSummaryPaymentDTO,
} from './types'
import { calculateBillingPeriod } from './billingPeriod'
import { AuthUser, getClientAccessLevel } from '../../utils/calendarAuth'
import { AppError } from '../../utils/AppError'

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
      payments: true,
    },
    orderBy: { trip_date: 'asc' as const },
  },
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const determineSummaryStatus = (total: Prisma.Decimal, paid: Prisma.Decimal): string => {
  if (paid.greaterThan(0) && paid.greaterThanOrEqualTo(total)) return 'paid'
  if (paid.greaterThan(0)) return 'partial'
  return 'draft'
}

const requireFullAccess = async (user: AuthUser, clientId: bigint, action: string) => {
  if ((await getClientAccessLevel(user, clientId)) !== 'full') {
    throw new AppError(`No tienes permisos para ${action}`, 403)
  }
}

const requireReadAccess = async (user: AuthUser, clientId: bigint, action: string) => {
  if ((await getClientAccessLevel(user, clientId)) === 'none') {
    throw new AppError(`No tienes acceso para ${action}`, 403)
  }
}

const getClientDriver = async (clientId: bigint): Promise<bigint> => {
  const client = await prisma.clients.findUnique({
    where: { id: clientId },
    select: { driver_id: true },
  })
  if (!client) throw new AppError('Cliente no encontrado', 404)
  if (!client.driver_id) throw new AppError('El cliente no tiene un chofer asignado', 400)
  return client.driver_id
}

export const createSummary = async (
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

  const paidAmount = trips.reduce(
    (acc, trip) => acc.add(trip.paid_amount),
    new Prisma.Decimal(0)
  )

  const status = determineSummaryStatus(totalAmount, paidAmount)

  const summary = await prisma.summaries.create({
    data: {
      client_id: clientId,
      driver_id: driverId,
      period_start: periodStart,
      period_end: periodEnd,
      period_type: periodType as any,
      total_trips: trips.length,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      status,
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

export const createSummaryManual = async (dto: CreateSummaryManualDTO, user: AuthUser) => {
  const clientId = BigInt(dto.client_id)
  await requireFullAccess(user, clientId, 'crear resúmenes')
  const driverId = await getClientDriver(clientId)
  const periodStart = new Date(dto.period_start)
  const periodEnd = new Date(dto.period_end)
  const periodType = dto.period_type ?? 'manual'

  return createSummary(clientId, driverId, periodStart, periodEnd, periodType, dto.notes)
}

// ─── Crear automático ─────────────────────────────────────────────────────────
// Calcula el período según la config del cliente

export const createSummaryAuto = async (
  clientId: string,
  dto: CreateSummaryAutoDTO,
  user: AuthUser,
) => {
  const clientBigInt = BigInt(clientId)

  const client = await prisma.clients.findUnique({
    where: { id: clientBigInt },
    select: {
      billing_cycle: true,
      billing_day: true,
      billing_start_date: true,
      driver_id: true,
    },
  })

  if (!client) throw new Error('Cliente no encontrado')

  if (!client.billing_cycle) {
    throw new Error('El cliente no tiene configurado un ciclo de facturación')
  }

  await requireFullAccess(user, clientBigInt, 'crear resúmenes')

  const referenceDate = dto.reference_date
    ? new Date(dto.reference_date)
    : new Date()

  const normalizedCycle = normalizeBillingCycle(client.billing_cycle)

  const { period_start, period_end, period_type } = calculateBillingPeriod(
    {
      billing_cycle: normalizedCycle as any,
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

  return createSummary(
    clientBigInt,
    client.driver_id ?? await getClientDriver(clientBigInt),
    period_start,
    period_end,
    period_type,
    dto.notes
  )
}

// ─── Procesar auto para scheduler ─────────────────────────────────────────────
// Usa el driver_id del cliente (no de un request manual)

export const processAutoSummary = async (clientId: bigint) => {
  const client = await prisma.clients.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      nombre: true,
      billing_cycle: true,
      billing_day: true,
      billing_start_date: true,
      driver_id: true,
    },
  })

  if (!client) return { status: 'skipped' as const, reason: 'Cliente no encontrado' }
  if (!client.billing_cycle) return { status: 'skipped' as const, reason: 'Sin ciclo de facturación' }
  if (!client.driver_id) return { status: 'skipped' as const, reason: 'Sin driver asignado' }

  const referenceDate = new Date()
  const normalizedCycle = normalizeBillingCycle(client.billing_cycle)

  let period_start: Date, period_end: Date, period_type: string

  try {
    const period = calculateBillingPeriod(
      {
        billing_cycle: normalizedCycle as any,
        billing_day: client.billing_day,
        billing_start_date: client.billing_start_date,
      },
      referenceDate
    )
    period_start = period.period_start
    period_end = period.period_end
    period_type = period.period_type
  } catch {
    return { status: 'skipped' as const, reason: 'Error al calcular período' }
  }

  const existing = await prisma.summaries.findFirst({
    where: {
      client_id: clientId,
      period_start,
      period_end,
    },
  })

  if (existing) return { status: 'skipped' as const, reason: `Ya existe (id: ${existing.id})` }

  try {
    const summary = await createSummary(
      clientId,
      client.driver_id,
      period_start,
      period_end,
      period_type
    )
    return { status: 'created' as const, summaryId: summary.id.toString() }
  } catch (err: any) {
    return { status: 'skipped' as const, reason: err.message }
  }
}

// ─── Consultas ────────────────────────────────────────────────────────────────

export const getAllByClient = async (clientId: string, user: AuthUser) => {
  await requireReadAccess(user, BigInt(clientId), 'ver resúmenes de este cliente')
  return prisma.summaries.findMany({
    where: { client_id: BigInt(clientId) },
    include: summaryInclude,
    orderBy: { period_start: 'desc' },
  })
}

export const getById = async (id: string, user: AuthUser) => {
  const summary = await prisma.summaries.findUnique({
    where: { id: BigInt(id) },
    include: summaryInclude,
  })

  if (!summary) throw new Error('Resumen no encontrado')
  await requireReadAccess(user, summary.client_id, 'ver este resumen')
  return summary
}

// ─── Actualizar status ────────────────────────────────────────────────────────

export const updateStatus = async (id: string, dto: UpdateSummaryStatusDTO, user: AuthUser) => {
  const summary = await prisma.summaries.findUnique({ where: { id: BigInt(id) }, select: { client_id: true } })
  if (!summary) throw new AppError('Resumen no encontrado', 404)
  await requireFullAccess(user, summary.client_id, 'actualizar resúmenes')
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

export const deleteSummary = async (id: string, user: AuthUser) => {
  const summaryId = BigInt(id)
  const summary = await prisma.summaries.findUnique({ where: { id: summaryId }, select: { client_id: true } })
  if (!summary) throw new AppError('Resumen no encontrado', 404)
  await requireFullAccess(user, summary.client_id, 'eliminar resúmenes')

  // Desvincular viajes antes de borrar
  await prisma.trips.updateMany({
    where: { summary_id: summaryId },
    data: { summary_id: null },
  })

  return prisma.summaries.delete({
    where: { id: summaryId },
  })
}

// ─── Pago sobre summary ───────────────────────────────────────────────────────
// Distribuye un pago global a los viajes del summary (FIFO cronológico)

export const paySummary = async (id: string, dto: CreateSummaryPaymentDTO, user: AuthUser) => {
  const summaryId = BigInt(id)

  const summary = await prisma.summaries.findUnique({
    where: { id: summaryId },
    include: {
      trips: {
        where: {
          payment_status: { in: ['pending', 'partial'] },
        },
        orderBy: { trip_date: 'asc' },
      },
    },
  })

  if (!summary) throw new Error('Resumen no encontrado')
  await requireFullAccess(user, summary.client_id, 'registrar pagos de este resumen')

  const totalAmount = Number(summary.total_amount)
  const currentPaid = Number(summary.paid_amount)
  const paymentAmount = dto.amount

  if (currentPaid + paymentAmount > totalAmount) {
    throw new Error(
      `El pago excede el saldo del resumen. Pendiente: $${totalAmount - currentPaid}`
    )
  }

  let remaining = paymentAmount

  const newPaidAmount = currentPaid + paymentAmount
  const newStatus = determineSummaryStatus(
    new Prisma.Decimal(totalAmount),
    new Prisma.Decimal(newPaidAmount)
  )

  const extraFields: Partial<{ paid_at: Date }> = {}
  if (newStatus === 'paid') extraFields.paid_at = new Date()

  const updatedSummary = await prisma.$transaction(async (tx) => {
    for (const trip of summary.trips) {
      if (remaining <= 0) break

      const tripPrice = Number(trip.final_price)
      const tripPaid = Number(trip.paid_amount)
      const tripPending = tripPrice - tripPaid

      if (tripPending <= 0) continue

      const apply = Math.min(remaining, tripPending)
      const newTripPaid = tripPaid + apply

      let tripNewStatus: 'pending' | 'partial' | 'paid' = 'partial'
      if (newTripPaid >= tripPrice) tripNewStatus = 'paid'
      else if (newTripPaid <= 0) tripNewStatus = 'pending'

      await tx.trips.update({
        where: { id: trip.id },
        data: {
          paid_amount: newTripPaid,
          payment_status: tripNewStatus,
        },
      })

      await tx.payments.create({
        data: {
          trip_id: trip.id,
          amount: apply,
          method: dto.method,
          notes: dto.notes ?? `Pago de resumen #${id}`,
        },
      })

      remaining -= apply
    }

    const s = await tx.summaries.update({
      where: { id: summaryId },
      data: {
        paid_amount: newPaidAmount,
        status: newStatus,
        ...extraFields,
      },
      include: summaryInclude,
    })

    return s
  })

  return updatedSummary
}

// ─── Preview del período activo ───────────────────────────────────────────────
// Util para mostrar en el panel antes de confirmar la generación automática

export const previewBillingPeriod = async (clientId: string, referenceDate: string | undefined, user: AuthUser) => {
  await requireReadAccess(user, BigInt(clientId), 'ver la facturación de este cliente')
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
      billing_cycle: client.billing_cycle as any,
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
