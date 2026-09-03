import PDFDocument from 'pdfkit'

interface Payment {
  amount: any
  method: string
}

interface Trip {
  trip_date: Date
  trip_type: string
  final_price: any
  has_surcharge: boolean
  special_type?: string | null
  payment_status: string
  paid_amount: any
  routes?: { name: string | null } | null
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

export interface RouteGroup {
  label: string
  count: number
  dates: Date[]
  total: number
  unitPrice: number | null
}

const COLOR_PAPER = '#faf9f6'
const COLOR_LINE = '#e3e1d9'
const COLOR_INK = '#1a1a1a'
const COLOR_TEXT_SOFT = '#6f6f6a'
const COLOR_GOLD = '#a8791f'
const COLOR_RED = '#b5432f'
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MAX_DATES_INLINE = 8

const formatDate = (date: Date) => {
  const d = new Date(date)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const formatDateFull = (date: Date) => {
  const d = new Date(date)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

const formatMoney = (amount: any) => `$${parseFloat(amount.toString()).toLocaleString('es-AR')}`

const routeLabel = (trip: Trip): string => {
  if (trip.routes?.name) return trip.routes.name
  return trip.trip_type.toLowerCase() === 'especial'
    ? 'Otros viajes'
    : 'Fuera de ruta'
}

const methodLabel = (method: string): string => ({
  cash: 'Efectivo',
  transfer: 'Transferencia',
  debit: 'Débito',
  credit: 'Crédito',
  other: 'Otro',
}[method] ?? method)

const collectPaymentMethods = (trips: Trip[]): string[] => {
  const methods = new Set<string>()
  for (const trip of trips) for (const payment of trip.payments ?? []) methods.add(payment.method)
  return [...methods]
}

export const groupTripsByRoute = (trips: Trip[]): RouteGroup[] => {
  const groups = new Map<string, Trip[]>()
  for (const trip of trips) {
    const label = routeLabel(trip)
    groups.set(label, [...(groups.get(label) ?? []), trip])
  }

  return [...groups.entries()]
    .map(([label, group]) => {
      const dates = group.map((trip) => new Date(trip.trip_date)).sort((a, b) => a.getTime() - b.getTime())
      const prices = group.map((trip) => parseFloat(trip.final_price.toString()))
      return {
        label,
        count: group.length,
        dates,
        total: prices.reduce((sum, price) => sum + price, 0),
        unitPrice: prices.every((price) => price === prices[0]) ? prices[0] : null,
      }
    })
    .sort((a, b) => b.count - a.count || a.dates[0].getTime() - b.dates[0].getTime())
}

export const formatDatesList = (dates: Date[]): string => {
  const formatted = dates.map(formatDate)
  if (formatted.length <= MAX_DATES_INLINE) return formatted.join(' · ')
  return `${formatted.slice(0, MAX_DATES_INLINE).join(' · ')} y ${formatted.length - MAX_DATES_INLINE} más`
}

export const generateSummaryPdf = (summary: Summary): Promise<Buffer> => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(chunk))
  doc.on('end', () => resolve(Buffer.concat(chunks)))
  doc.on('error', reject)

  const PAGE_WIDTH = doc.page.width
  const PAGE_HEIGHT = doc.page.height
  const MARGIN = 50
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
  const TOTALS_WIDTH = 110
  const COLUMN_GAP = 20
  const MAIN_WIDTH = CONTENT_WIDTH - TOTALS_WIDTH - COLUMN_GAP
  const statusLabels: Record<string, string> = {
    draft: 'Borrador', sent: 'Enviado', paid: 'Abonado', partial: 'Pago parcial', payment_reported: 'Pago informado', archived: 'Archivado',
  }

  const ensureSpace = (height: number, currentY: number) => {
    if (currentY + height > PAGE_HEIGHT - MARGIN) {
      doc.addPage()
      return MARGIN
    }
    return currentY
  }

  let y = MARGIN
  doc.fontSize(20).font('Helvetica-Bold').fillColor(COLOR_INK).text('Resumen de viajes', MARGIN, y)
  y += 26
  doc.fontSize(11).font('Courier').fillColor(COLOR_TEXT_SOFT)
    .text(`${formatDateFull(summary.period_start)} – ${formatDateFull(summary.period_end)}`, MARGIN, y)

  const statusText = statusLabels[summary.status] ?? summary.status
  const tagWidth = doc.widthOfString(statusText) + 22
  doc.rect(PAGE_WIDTH - MARGIN - tagWidth, MARGIN, tagWidth, 22).strokeColor(COLOR_LINE).stroke()
  doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXT_SOFT)
    .text(statusText, PAGE_WIDTH - MARGIN - tagWidth, MARGIN + 6, { width: tagWidth, align: 'center' })

  y += 24
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor(COLOR_INK).lineWidth(1.5).stroke()
  y += 22

  doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXT_SOFT).text('Cliente', MARGIN, y)
  doc.text('Chofer', MARGIN + 220, y)
  y += 14
  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLOR_INK).text(summary.clients.nombre, MARGIN, y)
  doc.text(summary.users.name, MARGIN + 220, y)
  y += 28
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor(COLOR_LINE).lineWidth(1).stroke()
  y += 8

  for (const group of groupTripsByRoute(summary.trips)) {
    doc.fontSize(10).font('Courier')
    const datesText = formatDatesList(group.dates)
    const datesHeight = doc.heightOfString(datesText, { width: MAIN_WIDTH })
    const rowHeight = Math.max(34, 16 + datesHeight + 14)
    y = ensureSpace(rowHeight, y)
    const rowTop = y

    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLOR_INK)
      .text(group.label, MARGIN, rowTop, { width: MAIN_WIDTH - 55, ellipsis: true })
    const titleWidth = Math.min(doc.widthOfString(group.label), MAIN_WIDTH - 55)
    doc.fontSize(10).font('Helvetica').fillColor(COLOR_TEXT_SOFT)
      .text(group.count === 1 ? '1 viaje' : `${group.count} viajes`, MARGIN + titleWidth + 8, rowTop + 1)
    doc.fontSize(10).font('Courier').fillColor(COLOR_TEXT_SOFT)
      .text(datesText, MARGIN, rowTop + 16, { width: MAIN_WIDTH })

    const totalsX = MARGIN + MAIN_WIDTH + COLUMN_GAP
    doc.fontSize(13).font('Courier-Bold').fillColor(COLOR_INK)
      .text(formatMoney(group.total), totalsX, rowTop, { width: TOTALS_WIDTH, align: 'right' })
    if (group.count > 1 && group.unitPrice !== null) {
      doc.fontSize(9).font('Courier').fillColor(COLOR_TEXT_SOFT)
        .text(`${formatMoney(group.unitPrice)} c/u`, totalsX, rowTop + 16, { width: TOTALS_WIDTH, align: 'right' })
    }
    y = rowTop + rowHeight
    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor(COLOR_LINE).lineWidth(1).stroke()
    y += 8
  }

  const totalPaid = parseFloat(summary.paid_amount.toString())
  const totalDue = parseFloat(summary.total_amount.toString()) - totalPaid
  const methods = collectPaymentMethods(summary.trips)
  y = ensureSpace(112, y) + 6
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLOR_TEXT_SOFT).text('Resumen de pagos', MARGIN, y)
  y += 18
  doc.fontSize(10.5).font('Courier').fillColor(COLOR_INK)
  const paymentRow = (label: string, value: string) => {
    doc.text(label, MARGIN, y)
    doc.text(value, MARGIN, y, { width: CONTENT_WIDTH, align: 'right' })
    y += 16
  }
  paymentRow('Total del período', formatMoney(summary.total_amount))
  paymentRow('Total pagado', formatMoney(summary.paid_amount))
  if (totalDue > 0) {
    doc.fillColor(COLOR_RED).font('Courier-Bold')
    paymentRow('Saldo pendiente', formatMoney(totalDue))
    doc.fillColor(COLOR_INK).font('Courier')
  }
  if (methods.length > 0) {
    doc.fontSize(9.5).font('Helvetica').fillColor(COLOR_TEXT_SOFT)
      .text(`Métodos: ${methods.map(methodLabel).join(', ')}`, MARGIN, y)
    y += 16
  }

  y = ensureSpace(60, y) + 10
  doc.rect(MARGIN, y, CONTENT_WIDTH, 60).fill(COLOR_INK)
  doc.fontSize(10.5).font('Helvetica').fillColor('#b8b6ae')
    .text(`Total de viajes: ${summary.total_trips}`, MARGIN + 16, y + 14)
  doc.fontSize(9.5).font('Helvetica').text('Total a abonar', MARGIN + 16, y + 32)
  doc.fontSize(19).font('Courier-Bold').fillColor(COLOR_GOLD)
    .text(formatMoney(summary.total_amount), MARGIN, y + 14, { width: CONTENT_WIDTH - 16, align: 'right' })
  doc.end()
})
