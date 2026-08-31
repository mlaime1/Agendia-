export interface CreateItineraryDto {
  name: string
  client_id: string
}

export interface UpdateItineraryDto {
  name?: string
}

export interface CreateStopDto {
  address: string
  stop_order?: number
  lat?: number
  lng?: number
}

export interface UpdateStopDto {
  address?: string
  stop_order?: number
  lat?: number
  lng?: number
}

export interface CreateRateDto {
  trip_type: 'ida' | 'ida y vuelta' | 'especial'
  base_price: number
  surcharge_price?: number
  start_date?: string
  end_date?: string
}

export interface UpdateRateDto {
  base_price?: number
  surcharge_price?: number
  start_date?: string | null
  end_date?: string | null
}

export interface MatchRequestDto {
  client_id: string
  points: { lat: number; lng: number }[]
}

export interface MatchResultDto {
  itinerary_id: bigint
  name: string
  distance_km: number
  rate: {
    id: bigint
    trip_type: string
    base_price: number
  } | null
}
