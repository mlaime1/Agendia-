export interface ParadaPayload extends Record<string, unknown> {}

export interface ParadaRecord extends Record<string, unknown> {
  id?: string | number;
}