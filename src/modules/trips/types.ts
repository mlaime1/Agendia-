// src/modules/trips/types.ts

export interface CreateTripDto {
  client_id: string;
  route_id?: string;        // Required for 'ida' / 'ida y vuelta'; ignored for 'especial'
  rate_id?: string;         // Optional: auto-lookup if not provided (only for routed trips)
  trip_date: string;        // ISO string: "2025-03-01T08:00:00"
  trip_type: boolean | 'ida' | 'ida y vuelta' | 'especial';
  final_price?: number;     // Required for 'especial'; optional override for regular trips
  has_surcharge?: boolean;
  surcharge_reason?: string;
  special_type?: string;    // Only meaningful when trip_type is 'especial'
  notes?: string;
}

export interface UpdateTripDto extends Partial<CreateTripDto> {}