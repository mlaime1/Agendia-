import { AppError } from './AppError'

export function sanitizePhone(phone: string): string {
  const trimmed = phone.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (digits.length < 7 || digits.length > 15) {
    throw new AppError('Teléfono inválido: debe contener entre 7 y 15 dígitos', 400)
  }

  return hasPlus ? `+${digits}` : digits
}
