export interface CreateInvitationDTO {
  client_id?: string | null
}

export interface InvitationResponse {
  code: string
  expires_at: Date
}

export interface ValidateCodeResponse {
  valid: boolean
  client_id: string | null
}
