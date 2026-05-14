export interface RegisterDTO {
  email: string
  password: string
  name: string
  alias?: string
}

export interface LoginDTO {
  email: string
  password: string
}