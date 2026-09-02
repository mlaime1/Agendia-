import { formatDatesList, generateSummaryPdf, groupTripsByRoute } from '../../../../src/modules/summaries/pdf'

const trip = (overrides: Record<string, unknown> = {}) => ({
  trip_date: new Date('2026-07-01T00:00:00Z'),
  trip_type: 'ida',
  final_price: 4000,
  has_surcharge: false,
  special_type: null,
  payment_status: 'pending',
  paid_amount: 0,
  routes: { name: 'Casa - Facu' },
  payments: [],
  ...overrides,
})

describe('summary PDF layout helpers', () => {
  it('groups trips by route and keeps route-less categories user-facing', () => {
    const groups = groupTripsByRoute([
      trip(),
      trip({ routes: null, trip_type: 'especial', final_price: 2500 }),
      trip({ routes: null, trip_type: 'ida', final_price: 3000 }),
    ])

    expect(groups.map(({ label, count, total }) => ({ label, count, total }))).toEqual([
      { label: 'Casa - Facu', count: 1, total: 4000 },
      { label: 'Otros viajes', count: 1, total: 2500 },
      { label: 'Fuera de ruta', count: 1, total: 3000 },
    ])
  })

  it('limits long date lists without dropping the group', () => {
    const dates = Array.from({ length: 10 }, (_, index) => new Date(`2026-07-${String(index + 1).padStart(2, '0')}T00:00:00Z`))
    expect(formatDatesList(dates)).toContain('y 2 más')
  })

  it('generates a multi-page PDF for many route groups with payment totals', async () => {
    const trips = Array.from({ length: 45 }, (_, index) => trip({
      trip_date: new Date(`2026-07-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`),
      routes: { name: `Ruta ${index + 1}` },
      payments: index === 0 ? [{ amount: 4000, method: 'cash' }] : [],
    }))
    const pdf = await generateSummaryPdf({
      id: BigInt(1),
      period_start: new Date('2026-07-01T00:00:00Z'),
      period_end: new Date('2026-07-31T00:00:00Z'),
      period_type: 'monthly',
      total_trips: trips.length,
      total_amount: 180000,
      paid_amount: 4000,
      status: 'partial',
      clients: { nombre: 'Fede' },
      users: { name: 'Mauro' },
      trips,
    })

    expect(pdf).toBeInstanceOf(Buffer)
    expect(pdf.toString('latin1')).toContain('/Count 4')
  })
})
