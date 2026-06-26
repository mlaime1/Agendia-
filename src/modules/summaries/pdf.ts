import PDFDocument from 'pdfkit'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  amount: any // Prisma Decimal
  method: string
}

interface Trip {
  trip_date: Date
  trip_type: string
  final_price: any // Prisma Decimal
  has_surcharge: boolean
  special_type?: string | null
  payment_status: string
  paid_amount: any
  payments?: Payment[]
}

interface Summary {
  id: bigint
  period_start: Date
  period_end: Date
  period_type: string
  total_trips: number
  total_amount: any
  paid_amount: any
  status: string
  clients: { nombre: string }
  users: { name: string }
  trips: Trip[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

const formatDate = (date: Date) => {
  const d = new Date(date)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

const formatDateFull = (date: Date) => {
  const d = new Date(date)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `${day}/${month}/${year}`
}

const formatMoney = (amount: any) => {
  const num = parseFloat(amount.toString())
  return `$${num.toLocaleString('es-AR')}`
}

const normalizeTripType = (trip: Trip): string => {
  if (trip.special_type) return `Especial (${trip.special_type})`

  const t = trip.trip_type.toLowerCase()

  if (t === 'ida') return 'Ida'
  if (t === 'vuelta') return 'Vuelta'
  if (t.includes('vuelta')) return 'Ida y vuelta'

  return trip.trip_type
}

const paymentStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    partial: 'Parcial',
    paid: 'Pagado',
  }
  return map[status] ?? status
}

const paymentStatusColor = (status: string): string => {
  const map: Record<string, string> = {
    pending: '#ef4444',
    partial: '#f59e0b',
    paid: '#10b981',
  }
  return map[status] ?? '#6b7280'
}

// Group trips by day → then by trip_type
const groupTrips = (trips: Trip[]) => {
  const byDay = new Map<string, Trip[]>()

  for (const trip of trips) {
    const d = new Date(trip.trip_date)
    const key = d.toISOString().slice(0, 10)

    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(trip)
  }

  const sortedDays = Array.from(byDay.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )

  return sortedDays.map(([dateKey, dayTrips]) => {
    const date = new Date(dateKey + 'T00:00:00Z')
    const dayName = DAYS_ES[date.getUTCDay()]
    const dateStr = formatDate(date)

    const byType = new Map<string, { count: number; total: number; trips: Trip[] }>()

    for (const trip of dayTrips) {
      const type = normalizeTripType(trip)
      const price = parseFloat(trip.final_price.toString())

      if (!byType.has(type)) {
        byType.set(type, { count: 0, total: 0, trips: [] })
      }

      const entry = byType.get(type)!

      entry.count += 1
      entry.total += price
      entry.trips.push(trip)
    }

    const dayTotal = dayTrips.reduce(
      (acc, t) => acc + parseFloat(t.final_price.toString()),
      0
    )

    return {
      dayName,
      dateStr,
      byType,
      dayTotal,
      tripCount: dayTrips.length,
    }
  })
}

const collectPaymentMethods = (trips: Trip[]): string[] => {
  const methods = new Set<string>()
  for (const trip of trips) {
    if (trip.payments) {
      for (const p of trip.payments) {
        methods.add(p.method)
      }
    }
  }
  return Array.from(methods)
}

const methodLabel = (method: string): string => {
  const map: Record<string, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    debit: 'Débito',
    credit: 'Crédito',
    other: 'Otro',
  }
  return map[method] ?? method
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

export const generateSummaryPdf = (
  summary: Summary
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    })

    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const PAGE_WIDTH = doc.page.width
    const MARGIN = 50
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

    // ── Colors ──────────────────────────────────────────────────────────────

    const COLOR_PRIMARY = '#1a1a2e'
    const COLOR_ACCENT = '#4f46e5'
    const COLOR_LIGHT_GRAY = '#f5f5f5'
    const COLOR_TEXT = '#374151'

    // ── Header ───────────────────────────────────────────────────────────────

    doc.rect(0, 0, PAGE_WIDTH, 90).fill(COLOR_PRIMARY)

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('Resumen de viajes', MARGIN, 28, {
        width: CONTENT_WIDTH,
      })

    const periodLabel =
      summary.period_type === 'weekly'
        ? 'Semanal'
        : summary.period_type === 'monthly'
        ? 'Mensual'
        : summary.period_type === 'biweekly'
        ? 'Quincenal'
        : 'Manual'

    const periodStr = `${formatDateFull(summary.period_start)} al ${formatDateFull(summary.period_end)}`

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#a5b4fc')
      .text(`${periodLabel}  ·  ${periodStr}`, MARGIN, 56, {
        width: CONTENT_WIDTH,
      })

    // ── Status badge ────────────────────────────────────────────────────────

    const statusColors: Record<string, string> = {
      draft: '#f59e0b',
      sent: '#3b82f6',
      paid: '#10b981',
      partial: '#f97316',
      archived: '#6b7280',
    }

    const statusLabels: Record<string, string> = {
      draft: 'Borrador',
      sent: 'Enviado',
      paid: 'Abonado',
      partial: 'Pago parcial',
      archived: 'Archivado',
    }

    const status = summary.status ?? 'draft'
    const badgeColor = statusColors[status] ?? '#6b7280'
    const badgeLabel = statusLabels[status] ?? status

    doc
      .roundedRect(PAGE_WIDTH - MARGIN - 90, 28, 80, 26, 6)
      .fill(badgeColor)

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text(badgeLabel, PAGE_WIDTH - MARGIN - 90, 36, {
        width: 80,
        align: 'center',
      })

    // ── Info block ───────────────────────────────────────────────────────────

    let y = 110

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor(COLOR_TEXT)
      .text('Cliente:', MARGIN, y)

    doc
      .font('Helvetica')
      .text(summary.clients.nombre, MARGIN + 58, y)

    y += 18

    doc
      .font('Helvetica-Bold')
      .text('Chofer:', MARGIN, y)

    doc
      .font('Helvetica')
      .text(summary.users.name, MARGIN + 58, y)

    // Divider

    y += 28

    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_WIDTH - MARGIN, y)
      .strokeColor('#e5e7eb')
      .lineWidth(1)
      .stroke()

    y += 20

    // ── Days ────────────────────────────────────────────────────────────────

    const groupedDays = groupTrips(summary.trips)

    for (const day of groupedDays) {
      const neededHeight =
        30 + day.byType.size * 30 + 20

      if (y + neededHeight > doc.page.height - 100) {
        doc.addPage()
        y = MARGIN
      }

      // Day header

      doc
        .rect(MARGIN, y, CONTENT_WIDTH, 26)
        .fill(COLOR_LIGHT_GRAY)

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(COLOR_PRIMARY)
        .text(
          `${day.dayName} ${day.dateStr}`,
          MARGIN + 10,
          y + 7,
          {
            width: CONTENT_WIDTH - 20,
          }
        )

      y += 26

      // Trip rows

      for (const [type, { count, total, trips: typeTrips }] of day.byType) {
        const label =
          count === 1
            ? `1 viaje — ${type}`
            : `${count} viajes — ${type}`

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor(COLOR_TEXT)
          .text(label, MARGIN + 12, y + 5, {
            width: CONTENT_WIDTH - 120,
          })

        doc
          .font('Helvetica-Bold')
          .fillColor(COLOR_ACCENT)
          .text(
            formatMoney(total),
            MARGIN + CONTENT_WIDTH - 100,
            y + 5,
            {
              width: 100,
              align: 'right',
            }
          )

        y += 16

        // Payment status per trip (if there are multiple trips of same type, show aggregate)
        for (const trip of typeTrips) {
          const stLabel = paymentStatusLabel(trip.payment_status)
          const stColor = paymentStatusColor(trip.payment_status)

          doc
            .fontSize(8)
            .font('Helvetica')
            .fillColor(stColor)
            .text(
              `  ● ${stLabel}${trip.payment_status === 'partial' ? ` (${formatMoney(trip.paid_amount)})` : ''}`,
              MARGIN + 12,
              y,
              {
                width: CONTENT_WIDTH - 120,
              }
            )
          y += 12
        }

        y += 4
      }

      y += 10
    }

    // ── Payment summary ─────────────────────────────────────────────────────

    const totalPaid = parseFloat(summary.paid_amount.toString())
    const totalDue = parseFloat(summary.total_amount.toString()) - totalPaid
    const methods = collectPaymentMethods(summary.trips)

    if (totalPaid > 0 || totalDue > 0) {
      y += 10

      doc
        .moveTo(MARGIN, y)
        .lineTo(PAGE_WIDTH - MARGIN, y)
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .stroke()

      y += 14

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(COLOR_PRIMARY)
        .text('Resumen de pagos', MARGIN, y)

      y += 20

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(COLOR_TEXT)
        .text('Total del período:', MARGIN + 12, y)
      doc
        .font('Helvetica-Bold')
        .text(formatMoney(summary.total_amount), MARGIN + 150, y)

      y += 16

      doc
        .font('Helvetica')
        .fillColor('#10b981')
        .text('Total pagado:', MARGIN + 12, y)
      doc
        .font('Helvetica-Bold')
        .text(formatMoney(summary.paid_amount), MARGIN + 150, y)

      y += 16

      if (totalDue > 0) {
        doc
          .font('Helvetica')
          .fillColor('#ef4444')
          .text('Saldo pendiente:', MARGIN + 12, y)
        doc
          .font('Helvetica-Bold')
          .text(formatMoney(totalDue), MARGIN + 150, y)
        y += 16
      }

      if (methods.length > 0) {
        doc
          .font('Helvetica')
          .fillColor(COLOR_TEXT)
          .text(`Métodos: ${methods.map(methodLabel).join(', ')}`, MARGIN + 12, y)
        y += 16
      }
    }

    // ── Footer / Totals ─────────────────────────────────────────────────────

    y += 10

    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_WIDTH - MARGIN, y)
      .strokeColor('#e5e7eb')
      .lineWidth(1)
      .stroke()

    y += 14

    doc
      .rect(MARGIN, y, CONTENT_WIDTH, 60)
      .fill(COLOR_PRIMARY)

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#a5b4fc')
      .text(
        `Total de viajes: ${summary.total_trips}`,
        MARGIN + 16,
        y + 16
      )

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text(
        `TOTAL A ABONAR: ${formatMoney(summary.total_amount)}`,
        MARGIN + 16,
        y + 34
      )

    doc.end()
  })
}
