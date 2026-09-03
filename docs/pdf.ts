import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

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
  period_type: string // kept in the data model, intentionally not shown to the client
  total_trips: number
  total_amount: any
  paid_amount: any
  status: string
  clients: { nombre: string }
  users: { name: string }
  trips: Trip[]
}

interface RouteGroup {
  label: string
  count: number
  dates: Date[]
  total: number
  unitPrice: number | null // set only when every trip in the group costs the same
}

// ─── Fonts ────────────────────────────────────────────────────────────────────
// The approved design uses Inter (headings/body) and IBM Plex Mono (dates/money).
// pdfkit only ships the 14 standard PDF fonts (Helvetica/Times/Courier), so these
// have to be embedded as real font files. Drop the .ttf files below into FONT_DIR
// (e.g. `npm i @fontsource/inter @fontsource/ibm-plex-mono` and copy the files, or
// download them directly) — https://fonts.google.com/specimen/Inter and
// https://fonts.google.com/specimen/IBM+Plex+Mono.
// If the files aren't present, this silently falls back to Helvetica/Courier so
// the PDF still generates correctly, just without the exact typeface.

const FONT_DIR = path.join(__dirname, 'fonts')

const FONT_FILES = {
  sans: 'Inter-Regular.ttf',
  sansMedium: 'Inter-Medium.ttf',
  sansSemiBold: 'Inter-SemiBold.ttf',
  sansBold: 'Inter-Bold.ttf',
  mono: 'IBMPlexMono-Regular.ttf',
  monoMedium: 'IBMPlexMono-Medium.ttf',
  monoSemiBold: 'IBMPlexMono-SemiBold.ttf',
}

const registerFonts = (doc: PDFKit.PDFDocument) => {
  const fonts = {
    sans: 'Helvetica',
    sansMedium: 'Helvetica',
    sansSemiBold: 'Helvetica-Bold',
    sansBold: 'Helvetica-Bold',
    mono: 'Courier',
    monoMedium: 'Courier',
    monoSemiBold: 'Courier-Bold',
  }

  const allFilesExist = Object.values(FONT_FILES).every((file) =>
    fs.existsSync(path.join(FONT_DIR, file))
  )

  if (!allFilesExist) return fonts

  try {
    doc.registerFont('Inter', path.join(FONT_DIR, FONT_FILES.sans))
    doc.registerFont('Inter-Medium', path.join(FONT_DIR, FONT_FILES.sansMedium))
    doc.registerFont('Inter-SemiBold', path.join(FONT_DIR, FONT_FILES.sansSemiBold))
    doc.registerFont('Inter-Bold', path.join(FONT_DIR, FONT_FILES.sansBold))
    doc.registerFont('PlexMono', path.join(FONT_DIR, FONT_FILES.mono))
    doc.registerFont('PlexMono-Medium', path.join(FONT_DIR, FONT_FILES.monoMedium))
    doc.registerFont('PlexMono-SemiBold', path.join(FONT_DIR, FONT_FILES.monoSemiBold))

    fonts.sans = 'Inter'
    fonts.sansMedium = 'Inter-Medium'
    fonts.sansSemiBold = 'Inter-SemiBold'
    fonts.sansBold = 'Inter-Bold'
    fonts.mono = 'PlexMono'
    fonts.monoMedium = 'PlexMono-Medium'
    fonts.monoSemiBold = 'PlexMono-SemiBold'
  } catch {
    // Fall back silently — fonts stay as the Helvetica/Courier defaults above.
  }

  return fonts
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLOR_INK = '#1a1a1a'
const COLOR_TEXT_SOFT = '#6f6f6a'
const COLOR_LINE = '#e3e1d9'
const COLOR_GOLD = '#a8791f'
const COLOR_RED = '#b5432f'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (trip.special_type) return trip.special_type

  const t = trip.trip_type.toLowerCase()

  if (t === 'ida') return 'Ida'
  if (t === 'vuelta') return 'Vuelta'
  if (t.includes('vuelta')) return 'Ida y vuelta'

  return trip.trip_type
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

// Group all trips in the period by route/type, regardless of which day they
// happened on. Routes that repeat float to the top (most frequent first);
// one-off routes are listed after, in chronological order.
const groupTripsByRoute = (trips: Trip[]): RouteGroup[] => {
  const map = new Map<string, Trip[]>()

  for (const trip of trips) {
    const label = normalizeTripType(trip)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(trip)
  }

  const groups: RouteGroup[] = Array.from(map.entries()).map(([label, groupTrips]) => {
    const dates = groupTrips
      .map((t) => new Date(t.trip_date))
      .sort((a, b) => a.getTime() - b.getTime())

    const prices = groupTrips.map((t) => parseFloat(t.final_price.toString()))
    const total = prices.reduce((acc, p) => acc + p, 0)
    const uniformPrice = prices.every((p) => p === prices[0]) ? prices[0] : null

    return { label, count: groupTrips.length, dates, total, unitPrice: uniformPrice }
  })

  groups.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.dates[0].getTime() - b.dates[0].getTime()
  })

  return groups
}

// Keeps a single group's date list from overflowing into an unreadable wall of
// dates when a route repeats a lot over a month. Tune MAX_DATES as needed.
const MAX_DATES_INLINE = 8

const formatDatesList = (dates: Date[]): string => {
  const formatted = dates.map(formatDate)
  if (formatted.length <= MAX_DATES_INLINE) return formatted.join(' · ')

  const shown = formatted.slice(0, MAX_DATES_INLINE)
  const remaining = formatted.length - MAX_DATES_INLINE
  return `${shown.join(' · ')} y ${remaining} más`
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

export const generateSummaryPdf = (summary: Summary): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const FONT = registerFonts(doc)

    const PAGE_WIDTH = doc.page.width
    const PAGE_HEIGHT = doc.page.height
    const MARGIN = 50
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

    const ensureSpace = (neededHeight: number, currentY: number): number => {
      if (currentY + neededHeight > PAGE_HEIGHT - 100) {
        doc.addPage()
        return MARGIN
      }
      return currentY
    }

    // ── Header ───────────────────────────────────────────────────────────────

    let y = MARGIN

    doc
      .fontSize(20)
      .font(FONT.sansBold)
      .fillColor(COLOR_INK)
      .text('Resumen de viajes', MARGIN, y, { width: CONTENT_WIDTH - 100 })

    y += 26

    const periodStr = `${formatDateFull(summary.period_start)} – ${formatDateFull(summary.period_end)}`

    doc
      .fontSize(11)
      .font(FONT.mono)
      .fillColor(COLOR_TEXT_SOFT)
      .text(periodStr, MARGIN, y)

    // Status tag — plain, no fill color, just a label so it doesn't add to the
    // palette. The client doesn't need to know the summary's period_type
    // (manual/weekly/monthly/etc.), so it's intentionally not rendered here.

    const statusLabels: Record<string, string> = {
      draft: 'Borrador',
      sent: 'Enviado',
      paid: 'Abonado',
      partial: 'Pago parcial',
      archived: 'Archivado',
    }
    const statusText = statusLabels[summary.status] ?? summary.status

    doc.fontSize(9).font(FONT.sans)
    const tagWidth = doc.widthOfString(statusText) + 22
    doc
      .rect(PAGE_WIDTH - MARGIN - tagWidth, MARGIN, tagWidth, 22)
      .strokeColor(COLOR_LINE)
      .lineWidth(1)
      .stroke()
    doc
      .fillColor(COLOR_TEXT_SOFT)
      .text(statusText, PAGE_WIDTH - MARGIN - tagWidth, MARGIN + 6, {
        width: tagWidth,
        align: 'center',
      })

    y += 24

    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_WIDTH - MARGIN, y)
      .strokeColor(COLOR_INK)
      .lineWidth(1.5)
      .stroke()

    y += 22

    // ── Meta (cliente / chofer) ────────────────────────────────────────────

    doc.fontSize(9).font(FONT.sans).fillColor(COLOR_TEXT_SOFT).text('Cliente', MARGIN, y)
    doc
      .fontSize(9)
      .font(FONT.sans)
      .fillColor(COLOR_TEXT_SOFT)
      .text('Chofer', MARGIN + 220, y)

    y += 14

    doc
      .fontSize(13)
      .font(FONT.sansSemiBold)
      .fillColor(COLOR_INK)
      .text(summary.clients.nombre, MARGIN, y)
    doc.text(summary.users.name, MARGIN + 220, y)

    y += 28

    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_WIDTH - MARGIN, y)
      .strokeColor(COLOR_LINE)
      .lineWidth(1)
      .stroke()

    y += 8

    // ── Routes ──────────────────────────────────────────────────────────────

    const routeGroups = groupTripsByRoute(summary.trips)

    const TOTALS_COL_WIDTH = 110
    const COL_GAP = 20
    const MAIN_COL_WIDTH = CONTENT_WIDTH - TOTALS_COL_WIDTH - COL_GAP

    for (const group of routeGroups) {
      const datesText = formatDatesList(group.dates)

      doc.fontSize(10).font(FONT.mono)
      const datesHeight = doc.heightOfString(datesText, { width: MAIN_COL_WIDTH })

      const rowHeight = 14 + 4 + datesHeight + 14 // title + gap + dates + bottom padding
      y = ensureSpace(rowHeight, y)

      const rowTop = y

      // Route name + count
      doc.fontSize(12).font(FONT.sansSemiBold).fillColor(COLOR_INK)
      const nameWidth = doc.widthOfString(group.label)
      doc.text(group.label, MARGIN, rowTop)

      doc
        .fontSize(10)
        .font(FONT.sans)
        .fillColor(COLOR_TEXT_SOFT)
        .text(
          group.count === 1 ? '1 viaje' : `${group.count} viajes`,
          MARGIN + nameWidth + 8,
          rowTop + 1
        )

      // Dates
      doc
        .fontSize(10)
        .font(FONT.mono)
        .fillColor(COLOR_TEXT_SOFT)
        .text(datesText, MARGIN, rowTop + 16, { width: MAIN_COL_WIDTH })

      // Totals column
      const totalsX = MARGIN + MAIN_COL_WIDTH + COL_GAP

      doc
        .fontSize(13)
        .font(FONT.monoSemiBold)
        .fillColor(COLOR_INK)
        .text(formatMoney(group.total), totalsX, rowTop, {
          width: TOTALS_COL_WIDTH,
          align: 'right',
        })

      if (group.count > 1 && group.unitPrice !== null) {
        doc
          .fontSize(9)
          .font(FONT.mono)
          .fillColor(COLOR_TEXT_SOFT)
          .text(`${formatMoney(group.unitPrice)} c/u`, totalsX, rowTop + 16, {
            width: TOTALS_COL_WIDTH,
            align: 'right',
          })
      }

      y = rowTop + rowHeight

      doc
        .moveTo(MARGIN, y)
        .lineTo(PAGE_WIDTH - MARGIN, y)
        .strokeColor(COLOR_LINE)
        .lineWidth(1)
        .stroke()

      y += 8
    }

    // ── Payment summary ─────────────────────────────────────────────────────

    const totalPaid = parseFloat(summary.paid_amount.toString())
    const totalDue = parseFloat(summary.total_amount.toString()) - totalPaid
    const methods = collectPaymentMethods(summary.trips)

    y = ensureSpace(120, y)
    y += 6

    doc
      .fontSize(11)
      .font(FONT.sansSemiBold)
      .fillColor(COLOR_TEXT_SOFT)
      .text('Resumen de pagos', MARGIN, y)

    y += 18

    doc.fontSize(10.5).font(FONT.mono).fillColor(COLOR_INK)

    doc.text('Total del período', MARGIN, y)
    doc.text(formatMoney(summary.total_amount), MARGIN, y, {
      width: CONTENT_WIDTH,
      align: 'right',
    })
    y += 16

    doc.text('Total pagado', MARGIN, y)
    doc.text(formatMoney(summary.paid_amount), MARGIN, y, {
      width: CONTENT_WIDTH,
      align: 'right',
    })
    y += 16

    if (totalDue > 0) {
      doc.fillColor(COLOR_RED).font(FONT.monoSemiBold)
      doc.text('Saldo pendiente', MARGIN, y)
      doc.text(formatMoney(totalDue), MARGIN, y, {
        width: CONTENT_WIDTH,
        align: 'right',
      })
      y += 16
      doc.fillColor(COLOR_INK).font(FONT.mono)
    }

    if (methods.length > 0) {
      doc
        .fontSize(9.5)
        .font(FONT.sans)
        .fillColor(COLOR_TEXT_SOFT)
        .text(`Métodos: ${methods.map(methodLabel).join(', ')}`, MARGIN, y)
      y += 16
    }

    // ── Footer / grand total ────────────────────────────────────────────────

    y = ensureSpace(60, y)
    y += 10

    doc.rect(MARGIN, y, CONTENT_WIDTH, 60).fill(COLOR_INK)

    doc
      .fontSize(10.5)
      .font(FONT.sans)
      .fillColor('#b8b6ae')
      .text(`Total de viajes: ${summary.total_trips}`, MARGIN + 16, y + 14)

    doc
      .fontSize(9.5)
      .font(FONT.sans)
      .fillColor('#b8b6ae')
      .text('Total a abonar', MARGIN + 16, y + 32)

    doc
      .fontSize(19)
      .font(FONT.monoSemiBold)
      .fillColor(COLOR_GOLD)
      .text(formatMoney(summary.total_amount), MARGIN, y + 14, {
        width: CONTENT_WIDTH - 16,
        align: 'right',
      })

    doc.end()
  })
}
