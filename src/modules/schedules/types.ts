export interface CreateScheduleDTO {
  day_of_week: number
  pickup_time: string
  return_time?: string | null
  label?: string | null
  is_active?: boolean
}

export interface UpdateScheduleDTO {
  day_of_week?: number
  pickup_time?: string
  return_time?: string | null
  label?: string | null
  is_active?: boolean
}

export interface BulkSchedulesDTO {
  schedules: CreateScheduleDTO[]
}
