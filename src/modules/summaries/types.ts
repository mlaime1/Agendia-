export interface CreateSummaryManualDTO {
  client_id: string
  driver_id: string
  period_start: string // YYYY-MM-DD
  period_end: string   // YYYY-MM-DD
  period_type?: string // default: 'manual'
  notes?: string
}

export interface UpdateSummaryStatusDTO {
  status: 'draft' | 'sent' | 'paid' | 'archived' | 'partial' | 'payment_reported'
}

export interface CreateSummaryPaymentDTO {
  amount: number
  method: 'cash' | 'transfer' | 'debit' | 'credit' | 'other'
  notes?: string
}

export type SummaryStatus = 'draft' | 'sent' | 'paid' | 'archived' | 'partial' | 'payment_reported'
export type BillingCycle = 'weekly' | 'biweekly' | 'monthly'
