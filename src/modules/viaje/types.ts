export interface CreateTripDto {
  user_id: string | number;
  client_id: string | number;
  route_id: string | number;
  rate_id: string | number;
  trip_date: string | Date;
  trip_type: boolean | 'ida' | 'ida y vuelta' | 'especial';
  final_price: number | string;
  has_surcharge?: boolean;
  surcharge_reason?: string | null;
  special_type?: string | null;
  notes?: string | null;
  summary_id?: string | number | null;
}

export interface UpdateTripDto extends Partial<CreateTripDto> {}

export interface ViajePayload extends Record<string, unknown> {}

export interface ViajeRecord extends Record<string, unknown> {
  id?: string | number;
}