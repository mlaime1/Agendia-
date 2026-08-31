import { calculateBillingPeriod } from '../../../../src/modules/summaries/billingPeriod'

describe('billingPeriod', () => {
  describe('calculateBillingPeriod', () => {
    describe('weekly billing', () => {
      // calcWeekly logic:
      // daysBack = (refDow - billingDay + 7) % 7
      // if daysBack === 0, daysBack = 7
      // period_end = ref - daysBack
      // period_start = period_end - 6

      it('should return previous week when today is billing day', () => {
        // 2025-06-02 is Monday (dow=1), billing_day=1
        // daysBack = (1-1+7)%7 = 0 → 7
        // period_end = June 2 - 7 = May 26
        // period_start = May 26 - 6 = May 20
        const result = calculateBillingPeriod(
          { billing_cycle: 'weekly', billing_day: 1 },
          new Date('2025-06-02T12:00:00Z')
        )

        expect(result.period_type).toBe('weekly')
        expect(result.period_start.toISOString().slice(0, 10)).toBe('2025-05-20')
        expect(result.period_end.toISOString().slice(0, 10)).toBe('2025-05-26')
      })

      it('should return current week when billing day already passed', () => {
        // 2025-06-04 is Wednesday (dow=3), billing_day=1
        // daysBack = (3-1+7)%7 = 2
        // period_end = June 4 - 2 = June 2
        // period_start = June 2 - 6 = May 27
        const result = calculateBillingPeriod(
          { billing_cycle: 'weekly', billing_day: 1 },
          new Date('2025-06-04T12:00:00Z')
        )

        expect(result.period_type).toBe('weekly')
        expect(result.period_start.toISOString().slice(0, 10)).toBe('2025-05-27')
        expect(result.period_end.toISOString().slice(0, 10)).toBe('2025-06-02')
      })

      it('should handle billing_day=7 (domingo)', () => {
        // 2025-06-04 is Wednesday (dow=3), billing_day=7
        // daysBack = (3-7+7)%7 = 3
        // period_end = June 4 - 3 = June 1
        // period_start = June 1 - 6 = May 26
        const result = calculateBillingPeriod(
          { billing_cycle: 'weekly', billing_day: 7 },
          new Date('2025-06-04T12:00:00Z')
        )

        expect(result.period_type).toBe('weekly')
        expect(result.period_start.toISOString().slice(0, 10)).toBe('2025-05-26')
        expect(result.period_end.toISOString().slice(0, 10)).toBe('2025-06-01')
      })

      it('should default billing_day to 1 if not provided', () => {
        const result = calculateBillingPeriod(
          { billing_cycle: 'weekly' },
          new Date('2025-06-04T12:00:00Z')
        )

        expect(result.period_type).toBe('weekly')
        expect(result.period_start.toISOString().slice(0, 10)).toBe('2025-05-27')
        expect(result.period_end.toISOString().slice(0, 10)).toBe('2025-06-02')
      })
    })

    describe('monthly billing', () => {
      it('should return previous month period when before billing_day', () => {
        // billing_day=15, reference=2025-06-10 (before day 15)
        const result = calculateBillingPeriod(
          { billing_cycle: 'monthly', billing_day: 15 },
          new Date('2025-06-10T12:00:00Z')
        )

        expect(result.period_type).toBe('monthly')
        expect(result.period_start.toISOString().slice(0, 10)).toBe('2025-05-15')
        expect(result.period_end.toISOString().slice(0, 10)).toBe('2025-06-14')
      })

      it('should return previous month when on or after billing_day', () => {
        // billing_day=1, reference=2025-06-15 (after day 1)
        const result = calculateBillingPeriod(
          { billing_cycle: 'monthly', billing_day: 1 },
          new Date('2025-06-15T12:00:00Z')
        )

        expect(result.period_type).toBe('monthly')
        expect(result.period_start.toISOString().slice(0, 10)).toBe('2025-05-01')
        expect(result.period_end.toISOString().slice(0, 10)).toBe('2025-05-31')
      })

      it('should handle billing_day=31 correctly with month clamping', () => {
        // billing_day=31, reference=2025-06-15
        // startMonth = May (index 4)
        // period_start = safeDate(2025, 4, 31) = May 31
        // endMonth = June (index 5)
        // safeDate(2025, 5, 31) = June 30 (clamped)
        // period_end = June 30 - 1 = June 29
        const result = calculateBillingPeriod(
          { billing_cycle: 'monthly', billing_day: 31 },
          new Date('2025-06-15T12:00:00Z')
        )

        expect(result.period_type).toBe('monthly')
        expect(result.period_start.toISOString().slice(0, 10)).toBe('2025-05-31')
        expect(result.period_end.toISOString().slice(0, 10)).toBe('2025-06-29')
      })

      it('should handle month boundaries (January to December)', () => {
        const result = calculateBillingPeriod(
          { billing_cycle: 'monthly', billing_day: 1 },
          new Date('2025-01-15T12:00:00Z')
        )

        expect(result.period_type).toBe('monthly')
        expect(result.period_start.toISOString().slice(0, 10)).toBe('2024-12-01')
        expect(result.period_end.toISOString().slice(0, 10)).toBe('2024-12-31')
      })

      it('should default billing_day to 1 if not provided', () => {
        const result = calculateBillingPeriod(
          { billing_cycle: 'monthly' },
          new Date('2025-06-15T12:00:00Z')
        )

        expect(result.period_type).toBe('monthly')
        expect(result.period_start.toISOString().slice(0, 10)).toBe('2025-05-01')
        expect(result.period_end.toISOString().slice(0, 10)).toBe('2025-05-31')
      })
    })

    describe('biweekly billing', () => {
      it('should return previous biweekly cycle', () => {
        const result = calculateBillingPeriod(
          {
            billing_cycle: 'biweekly',
            billing_start_date: new Date('2025-05-01'),
          },
          new Date('2025-06-01T12:00:00Z')
        )

        expect(result.period_type).toBe('biweekly')
        expect(result.period_start.toISOString().slice(0, 10)).toBe('2025-05-15')
        expect(result.period_end.toISOString().slice(0, 10)).toBe('2025-05-28')
      })

      it('should throw if no biweekly cycles completed', () => {
        expect(() =>
          calculateBillingPeriod(
            {
              billing_cycle: 'biweekly',
              billing_start_date: new Date('2025-05-20'),
            },
            new Date('2025-06-01T12:00:00Z')
          )
        ).toThrow('No hay ciclos quincenal cerrados desde billing_start_date')
      })

      it('should throw if billing_start_date is missing', () => {
        expect(() =>
          calculateBillingPeriod(
            { billing_cycle: 'biweekly' },
            new Date('2025-06-01T12:00:00Z')
          )
        ).toThrow('billing_start_date es requerido para ciclo quincenal')
      })
    })

    describe('invalid billing_cycle', () => {
      it('should throw for invalid cycle', () => {
        expect(() =>
          calculateBillingPeriod(
            { billing_cycle: 'invalid' as any },
            new Date('2025-06-01T12:00:00Z')
          )
        ).toThrow('billing_cycle inválido: invalid')
      })
    })
  })
})
