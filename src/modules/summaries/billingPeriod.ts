// src/modules/summaries/billingPeriod.ts

export interface BillingPeriod {
  period_start: Date
  period_end: Date
  period_type: 'weekly' | 'biweekly' | 'monthly'
}

interface ClientBillingConfig {
  billing_cycle: string
  billing_day?: number | null
  billing_start_date?: Date | null
}

/**
 * Dado un cliente y una fecha de referencia (default: hoy),
 * devuelve el período de facturación cerrado más reciente.
 *
 * "Cerrado" = el período ya terminó (period_end < hoy).
 * Si el período actual todavía no cerró, devuelve el anterior.
 */
export const calculateBillingPeriod = (
  client: ClientBillingConfig,
  referenceDate: Date = new Date()
): BillingPeriod => {
  const ref = stripTime(referenceDate)

  switch (client.billing_cycle) {
    case 'weekly':
      return calcWeekly(ref, client.billing_day ?? 1)
    case 'biweekly':
      if (!client.billing_start_date) {
        throw new Error('billing_start_date es requerido para ciclo quincenal')
      }
      return calcBiweekly(ref, stripTime(client.billing_start_date))
    case 'monthly':
      return calcMonthly(ref, client.billing_day ?? 1)
    default:
      throw new Error(`billing_cycle inválido: ${client.billing_cycle}`)
  }
}

// ─── Weekly ───────────────────────────────────────────────────────────────────
// billing_day: 1=lunes, 2=martes ... 7=domingo (ISO)
// Devuelve la semana cerrada más reciente.
// Si hoy es el mismo día que billing_day, devuelve la semana anterior
// (la semana actual acaba de empezar, todavía no cerró).

const calcWeekly = (ref: Date, billingDay: number): BillingPeriod => {
  // ISO weekday del día de referencia (1=lun..7=dom)
  const refDow = isoWeekday(ref)

  // Cuántos días atrás está el último billing_day
  let daysBack = (refDow - billingDay + 7) % 7

  // Si hoy ES el billing_day, el período actual acaba de empezar → tomamos el anterior
  if (daysBack === 0) daysBack = 7

  const period_end = addDays(ref, -daysBack)
  const period_start = addDays(period_end, -6)

  return { period_start, period_end, period_type: 'weekly' }
}

// ─── Biweekly ─────────────────────────────────────────────────────────────────
// Calcula quincenas de 14 días exactos desde billing_start_date.
// Devuelve el ciclo cerrado más reciente.

const calcBiweekly = (ref: Date, anchor: Date): BillingPeriod => {
  const daysSinceAnchor = daysBetween(anchor, ref)

  // Cuántos ciclos completos pasaron
  const completedCycles = Math.floor(daysSinceAnchor / 14)

  if (completedCycles === 0) {
    throw new Error(
      'No hay ciclos quincenal cerrados desde billing_start_date'
    )
  }

  const period_start = addDays(anchor, (completedCycles - 1) * 14)
  const period_end = addDays(period_start, 13)

  return { period_start, period_end, period_type: 'biweekly' }
}

// ─── Monthly ──────────────────────────────────────────────────────────────────
// billing_day: día del mes en que empieza el ciclo (ej: 1 = del 1 al 31, 15 = del 15 al 14)
// Devuelve el mes cerrado más reciente.

const calcMonthly = (ref: Date, billingDay: number): BillingPeriod => {
  let startYear = ref.getFullYear()
  let startMonth = ref.getMonth() // 0-indexed

  // Si ref todavía no llegó al billing_day de este mes,
  // el ciclo actual no cerró → tomamos el mes anterior
  if (ref.getDate() < billingDay) {
    startMonth -= 1
    if (startMonth < 0) {
      startMonth = 11
      startYear -= 1
    }
  }

  // Si ref >= billing_day, el ciclo que cerró empieza en el mes anterior
  else {
    startMonth -= 1
    if (startMonth < 0) {
      startMonth = 11
      startYear -= 1
    }
  }

  const period_start = safeDate(startYear, startMonth, billingDay)

  // period_end = día anterior al billing_day del mes siguiente
  let endMonth = startMonth + 1
  let endYear = startYear
  if (endMonth > 11) {
    endMonth = 0
    endYear += 1
  }
  const period_end = addDays(safeDate(endYear, endMonth, billingDay), -1)

  return { period_start, period_end, period_type: 'monthly' }
}

// ─── Date utils ───────────────────────────────────────────────────────────────

/** Elimina la parte horaria dejando medianoche UTC */
const stripTime = (d: Date): Date => {
  const out = new Date(d)
  out.setUTCHours(0, 0, 0, 0)
  return out
}

/** ISO weekday: 1=lunes … 7=domingo */
const isoWeekday = (d: Date): number => {
  const dow = d.getUTCDay() // 0=dom
  return dow === 0 ? 7 : dow
}

const addDays = (d: Date, n: number): Date => {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + n)
  return out
}

const daysBetween = (a: Date, b: Date): number => {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Crea una fecha segura: si el billing_day es mayor al último día del mes
 * (ej: billing_day=31 en febrero), usa el último día disponible.
 * month es 0-indexed.
 */
const safeDate = (year: number, month: number, day: number): Date => {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const clampedDay = Math.min(day, lastDay)
  return new Date(Date.UTC(year, month, clampedDay))
}
