import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { AppError } from '../../utils/AppError'
import { AuthUser, getClientAccessLevel } from '../../utils/calendarAuth'
import { CreateScheduleDTO, UpdateScheduleDTO, BulkSchedulesDTO } from './types'

const TIME_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

const timeStringToDate = (value: string): Date => {
  const [hh, mm] = value.split(':').map(Number)
  const d = new Date()
  d.setUTCHours(hh, mm, 0, 0)
  return d
}

const dateToTimeString = (value: Date | null): string | null => {
  if (!value) return null
  const hh = String(value.getUTCHours()).padStart(2, '0')
  const mm = String(value.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const validateDayOfWeek = (n: number): void => {
  if (!Number.isInteger(n) || n < 1 || n > 7) {
    throw new AppError('day_of_week debe ser un entero entre 1 (lunes) y 7 (domingo)', 400)
  }
}

const validateTimeFormat = (value: string): void => {
  if (typeof value !== 'string' || !TIME_REGEX.test(value)) {
    throw new AppError('time debe tener formato "HH:mm"', 400)
  }
}

const validateLabel = (label?: string | null): void => {
  if (label != null && label.length > 100) {
    throw new AppError('label debe tener como máximo 100 caracteres', 400)
  }
}

const validateScheduleFields = (fields: {
  day_of_week?: number
  pickup_time?: string
  return_time?: string | null
  label?: string | null
}): void => {
  if (fields.day_of_week !== undefined) validateDayOfWeek(fields.day_of_week)
  if (fields.pickup_time !== undefined) validateTimeFormat(fields.pickup_time)
  if (fields.return_time !== undefined && fields.return_time !== null) {
    validateTimeFormat(fields.return_time)
  }
  if (fields.label !== undefined) validateLabel(fields.label)
}

const ensureFullAccess = async (user: AuthUser, clientId: bigint): Promise<void> => {
  const level = await getClientAccessLevel(user, clientId)
  if (level === 'none') {
    throw new AppError('No tienes acceso a este cliente', 403)
  }
  if (level !== 'full') {
    throw new AppError('No tienes permisos para modificar los horarios de este cliente', 403)
  }
}

const ensureReadAccess = async (user: AuthUser, clientId: bigint): Promise<void> => {
  const level = await getClientAccessLevel(user, clientId)
  if (level === 'none') {
    throw new AppError('No tienes acceso a este cliente', 403)
  }
}

const serializeSchedule = (s: {
  id: bigint
  client_id: bigint
  day_of_week: number
  pickup_time: Date | null
  return_time: Date | null
  label: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}) => ({
  id: s.id.toString(),
  client_id: s.client_id.toString(),
  day_of_week: s.day_of_week,
  pickup_time: dateToTimeString(s.pickup_time),
  return_time: dateToTimeString(s.return_time),
  label: s.label,
  is_active: s.is_active,
  created_at: s.created_at,
  updated_at: s.updated_at,
})

export const getByClient = async (clientId: bigint, user: AuthUser) => {
  await ensureReadAccess(user, clientId)
  const schedules = await prisma.service_schedules.findMany({
    where: { client_id: clientId },
    orderBy: [{ day_of_week: 'asc' }, { pickup_time: 'asc' }],
  })
  return schedules.map(serializeSchedule)
}

export const create = async (clientId: bigint, dto: CreateScheduleDTO, user: AuthUser) => {
  await ensureFullAccess(user, clientId)
  validateScheduleFields(dto)
  if (dto.pickup_time === undefined) {
    throw new AppError('pickup_time es requerido', 400)
  }
  try {
    const created = await prisma.service_schedules.create({
      data: {
        client_id: clientId,
        day_of_week: dto.day_of_week,
        pickup_time: timeStringToDate(dto.pickup_time),
        return_time: dto.return_time ? timeStringToDate(dto.return_time) : null,
        label: dto.label ?? null,
        is_active: dto.is_active ?? true,
      },
    })
    return serializeSchedule(created)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Ya existe un horario con ese día y hora para este cliente', 409)
    }
    throw error
  }
}

export const update = async (
  clientId: bigint,
  scheduleId: bigint,
  dto: UpdateScheduleDTO,
  user: AuthUser,
) => {
  await ensureFullAccess(user, clientId)
  validateScheduleFields(dto)

  const existing = await prisma.service_schedules.findFirst({
    where: { id: scheduleId, client_id: clientId },
  })
  if (!existing) {
    throw new AppError('Horario no encontrado', 404)
  }

  const data: Prisma.service_schedulesUpdateInput = {}
  if (dto.day_of_week !== undefined) data.day_of_week = dto.day_of_week
  if (dto.pickup_time !== undefined) data.pickup_time = timeStringToDate(dto.pickup_time)
  if (dto.return_time !== undefined) {
    data.return_time = dto.return_time ? timeStringToDate(dto.return_time) : null
  }
  if (dto.label !== undefined) data.label = dto.label
  if (dto.is_active !== undefined) data.is_active = dto.is_active

  try {
    const updated = await prisma.service_schedules.update({
      where: { id: scheduleId },
      data,
    })
    return serializeSchedule(updated)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Ya existe un horario con ese día y hora para este cliente', 409)
    }
    throw error
  }
}

export const remove = async (clientId: bigint, scheduleId: bigint, user: AuthUser) => {
  await ensureFullAccess(user, clientId)
  const existing = await prisma.service_schedules.findFirst({
    where: { id: scheduleId, client_id: clientId },
  })
  if (!existing) {
    throw new AppError('Horario no encontrado', 404)
  }
  await prisma.service_schedules.delete({ where: { id: scheduleId } })
}

export const bulkReplace = async (
  clientId: bigint,
  dto: BulkSchedulesDTO,
  user: AuthUser,
) => {
  await ensureFullAccess(user, clientId)
  dto.schedules.forEach((s, idx) => {
    try {
      validateScheduleFields(s)
    } catch (err: any) {
      if (err instanceof AppError) {
        throw new AppError(`schedules[${idx}]: ${err.message}`, 400)
      }
      throw err
    }
    if (s.pickup_time === undefined) {
      throw new AppError(`schedules[${idx}]: pickup_time es requerido`, 400)
    }
  })

  const result = await prisma.$transaction(async (tx) => {
    await tx.service_schedules.deleteMany({ where: { client_id: clientId } })
    if (dto.schedules.length === 0) return []
    const data = dto.schedules.map((s) => ({
      client_id: clientId,
      day_of_week: s.day_of_week,
      pickup_time: timeStringToDate(s.pickup_time!),
      return_time: s.return_time ? timeStringToDate(s.return_time) : null,
      label: s.label ?? null,
      is_active: s.is_active ?? true,
    }))
    await tx.service_schedules.createMany({ data })
    return tx.service_schedules.findMany({
      where: { client_id: clientId },
      orderBy: [{ day_of_week: 'asc' }, { pickup_time: 'asc' }],
    })
  })

  return result.map(serializeSchedule)
}
