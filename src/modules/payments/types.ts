// src/modules/payments/types.ts

export interface CreatePaymentDto {
  amount: number
  method: 'cash' | 'transfer' | 'debit' | 'credit' | 'other'
  notes?: string
}

export interface UpdatePaymentDto {
  amount?: number
  method?: 'cash' | 'transfer' | 'debit' | 'credit' | 'other'
  notes?: string
}
