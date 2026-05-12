// src/modules/trips/types.ts

export interface CreateTripDto {
  user_id: string;
  client_id: string;
  route_id: string;
  rate_id: string;
  trip_date: string;        // ISO string: "2025-03-01T08:00:00"
  trip_type: boolean | 'ida' | 'ida y vuelta' | 'especial';
  final_price: number;
  has_surcharge?: boolean;
  surcharge_reason?: string;
  special_type?: string;
  notes?: string;
}

export interface UpdateTripDto extends Partial<CreateTripDto> {}