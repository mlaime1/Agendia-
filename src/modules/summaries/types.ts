export interface CreateSummaryManualDTO {
  client_id: string
  driver_id: string
  period_start: string // YYYY-MM-DD
  period_end: string   // YYYY-MM-DD
  notes?: string
}

export interface CreateSummaryAutoDTO {
  driver_id: string
  reference_date?: string // YYYY-MM-DD — opcional, default: hoy
  notes?: string
}

export interface UpdateSummaryStatusDTO {
  status: 'draft' | 'sent' | 'paid' | 'archived'
}

export type SummaryStatus = 'draft' | 'sent' | 'paid' | 'archived'
export type BillingCycle = 'weekly' | 'biweekly' | 'monthly'