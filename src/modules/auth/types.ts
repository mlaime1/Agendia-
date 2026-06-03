export interface RegisterDTO {
  email: string
  password: string
  name: string
  alias?: string
  invitation_code?: string
  phone?: string
}

export interface LoginDTO {
  email: string
  password: string
}