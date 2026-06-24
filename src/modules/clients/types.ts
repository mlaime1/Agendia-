import { BillingCycle } from '@prisma/client'

export type { BillingCycle }

export interface CreateClientDTO {
  nombre: string
  phone: string // Decimal en BD → string en DTO
  billing_cycle: BillingCycle
  billing_day?: number | null
  billing_start_date?: string | null // YYYY-MM-DD
  timezone?: string // IANA timezone, e.g. America/Argentina/Buenos_Aires
}

export interface UpdateClientDTO {
  nombre?: string
  phone?: string
  billing_cycle?: BillingCycle
  billing_day?: number | null
  billing_start_date?: string | null // YYYY-MM-DD
  timezone?: string // IANA timezone, e.g. America/Argentina/Buenos_Aires
}

// Solo los campos de facturación — para el panel de configuración
export interface UpdateBillingConfigDTO {
  billing_cycle: BillingCycle
  billing_day?: number | null
  billing_start_date?: string | null // YYYY-MM-DD
}