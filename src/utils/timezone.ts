import { fromZonedTime, toZonedTime, format } from 'date-fns-tz'

/**
 * Convierte una fecha local de un cliente (string YYYY-MM-DD o YYYY-MM-DDTHH:mm)
 * a un objeto Date en UTC.
 * Si no se pasa hora, asume 00:00:00 en la zona horaria del cliente.
 */
export const toUTC = (dateStr: string, timezone: string): Date => {
  // Si solo es fecha (YYYY-MM-DD), agregar hora para evitar ambigüedades
  const hasTime = dateStr.includes('T') || dateStr.includes(' ')
  const fullDateStr = hasTime ? dateStr : `${dateStr}T00:00:00`
  return fromZonedTime(fullDateStr, timezone)
}

/**
 * Formatea un Date UTC a un string local del cliente.
 * Formato por defecto: yyyy-MM-dd HH:mm
 */
export const toClientTimeString = (
  utcDate: Date,
  timezone: string,
  fmt = 'yyyy-MM-dd HH:mm',
): string => {
  return format(toZonedTime(utcDate, timezone), fmt, { timeZone: timezone })
}

/**
 * Devuelve el inicio del día (00:00:00) en la zona horaria del cliente,
 * convertido a UTC.
 */
export const clientStartOfDay = (date: Date, timezone: string): Date => {
  const zoned = toZonedTime(date, timezone)
  const dateStr = format(zoned, 'yyyy-MM-dd', { timeZone: timezone })
  return fromZonedTime(`${dateStr}T00:00:00`, timezone)
}

/**
 * Devuelve el fin del día (23:59:59.999) en la zona horaria del cliente,
 * convertido a UTC.
 */
export const clientEndOfDay = (date: Date, timezone: string): Date => {
  const zoned = toZonedTime(date, timezone)
  const dateStr = format(zoned, 'yyyy-MM-dd', { timeZone: timezone })
  return fromZonedTime(`${dateStr}T23:59:59.999`, timezone)
}

/**
 * Valida si un string es un identificador de zona horaria IANA válido.
 * Ej: America/Argentina/Buenos_Aires, Europe/Madrid, UTC
 */
export const isValidIANA = (tz: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}
