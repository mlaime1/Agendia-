import { AppError } from './AppError'

export type TripType = 'ida' | 'ida_y_vuelta' | 'especial'

export function normalizeTripType(
  tripType: boolean | string,
): TripType {
  if (typeof tripType === 'boolean') {
    return tripType ? 'ida' : 'ida_y_vuelta'
  }

  const normalized = tripType.trim().toLowerCase()

  if (normalized === 'ida') return 'ida'
  if (normalized === 'ida y vuelta' || normalized === 'ida_y_vuelta') return 'ida_y_vuelta'
  if (normalized === 'especial') return 'especial'

  throw new AppError('trip_type must be "ida", "ida y vuelta", "especial", or boolean', 400)
}
