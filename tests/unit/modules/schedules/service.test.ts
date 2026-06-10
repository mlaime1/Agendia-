jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    service_schedules: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../../src/lib/supabase', () => ({
  supabase: {},
}))

jest.mock('../../../../src/utils/calendarAuth', () => ({
  getClientAccessLevel: jest.fn(),
  isBillingActive: jest.fn(),
  getDriverClients: jest.fn(),
  getPassengerClients: jest.fn(),
  getDriverForClient: jest.fn(),
}))

import * as service from '../../../../src/modules/schedules/service'
import { prisma } from '../../../../src/config/prisma'
import * as calendarAuth from '../../../../src/utils/calendarAuth'
import { AppError } from '../../../../src/utils/AppError'
import { Prisma } from '@prisma/client'

const mockPrisma = prisma as any
const mockCalendarAuth = calendarAuth as jest.Mocked<typeof calendarAuth>

const driverUser = { authId: 'driver-auth', role: 'DRIVER' as const, dbId: BigInt(1) }
const clientId = BigInt(100)
const scheduleId = BigInt(1)

const buildScheduleRow = (overrides: Partial<any> = {}) => ({
  id: scheduleId,
  client_id: clientId,
  day_of_week: 1,
  pickup_time: new Date('1970-01-01T07:30:00.000Z'),
  return_time: new Date('1970-01-01T16:00:00.000Z'),
  label: 'Escuela',
  is_active: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
})

describe('schedules/service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getByClient', () => {
    it('returns schedules ordered by day and time for a user with read access', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('read-only')
      const row = buildScheduleRow()
      mockPrisma.service_schedules.findMany.mockResolvedValue([row])

      const result = await service.getByClient(clientId, driverUser)

      expect(mockCalendarAuth.getClientAccessLevel).toHaveBeenCalledWith(driverUser, clientId)
      expect(mockPrisma.service_schedules.findMany).toHaveBeenCalledWith({
        where: { client_id: clientId },
        orderBy: [{ day_of_week: 'asc' }, { pickup_time: 'asc' }],
      })
      expect(result).toEqual([
        {
          id: scheduleId.toString(),
          client_id: clientId.toString(),
          day_of_week: 1,
          pickup_time: '07:30',
          return_time: '16:00',
          label: 'Escuela',
          is_active: true,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
      ])
    })

    it('returns null return_time when DB has null', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.service_schedules.findMany.mockResolvedValue([
        buildScheduleRow({ return_time: null }),
      ])

      const result = await service.getByClient(clientId, driverUser)

      expect(result[0].return_time).toBeNull()
      expect(result[0].pickup_time).toBe('07:30')
    })

    it('throws 403 when user has no access', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('none')

      await expect(service.getByClient(clientId, driverUser)).rejects.toMatchObject({
        message: 'No tienes acceso a este cliente',
        statusCode: 403,
      })
    })
  })

  describe('create', () => {
    const baseDto = {
      day_of_week: 1,
      pickup_time: '07:30',
      return_time: '16:00',
      label: 'Escuela',
      is_active: true,
    }

    beforeEach(() => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
    })

    it('creates a schedule with valid data', async () => {
      const created = buildScheduleRow()
      mockPrisma.service_schedules.create.mockResolvedValue(created)

      const result = await service.create(clientId, baseDto, driverUser)

      expect(mockPrisma.service_schedules.create).toHaveBeenCalledWith({
        data: {
          client_id: clientId,
          day_of_week: 1,
          pickup_time: expect.any(Date),
          return_time: expect.any(Date),
          label: 'Escuela',
          is_active: true,
        },
      })
      expect(result.pickup_time).toBe('07:30')
      expect(result.return_time).toBe('16:00')
    })

    it('accepts null return_time (solo ida)', async () => {
      const dto = { ...baseDto, return_time: null }
      mockPrisma.service_schedules.create.mockResolvedValue(buildScheduleRow({ return_time: null }))

      const result = await service.create(clientId, dto, driverUser)

      expect(result.return_time).toBeNull()
      expect(mockPrisma.service_schedules.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ return_time: null }),
      })
    })

    it('throws 400 when day_of_week is out of range', async () => {
      await expect(
        service.create(clientId, { ...baseDto, day_of_week: 0 }, driverUser),
      ).rejects.toBeInstanceOf(AppError)
      await expect(
        service.create(clientId, { ...baseDto, day_of_week: 8 }, driverUser),
      ).rejects.toBeInstanceOf(AppError)
      expect(mockPrisma.service_schedules.create).not.toHaveBeenCalled()
    })

    it('throws 400 when pickup_time is invalid', async () => {
      await expect(
        service.create(clientId, { ...baseDto, pickup_time: '25:00' }, driverUser),
      ).rejects.toMatchObject({ statusCode: 400 })
      await expect(
        service.create(clientId, { ...baseDto, pickup_time: 'abc' }, driverUser),
      ).rejects.toMatchObject({ statusCode: 400 })
      expect(mockPrisma.service_schedules.create).not.toHaveBeenCalled()
    })

    it('throws 400 when return_time is invalid (not null)', async () => {
      await expect(
        service.create(clientId, { ...baseDto, return_time: '99:00' }, driverUser),
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('throws 400 when label exceeds 100 chars', async () => {
      await expect(
        service.create(clientId, { ...baseDto, label: 'a'.repeat(101) }, driverUser),
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('translates Prisma P2002 to 409', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('Unique violation', {
        code: 'P2002',
        clientVersion: 'test',
      })
      mockPrisma.service_schedules.create.mockRejectedValue(err)

      await expect(service.create(clientId, baseDto, driverUser)).rejects.toMatchObject({
        statusCode: 409,
        message: 'Ya existe un horario con ese día y hora para este cliente',
      })
    })

    it('throws 403 when user has read-only access', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('read-only')

      await expect(service.create(clientId, baseDto, driverUser)).rejects.toMatchObject({
        statusCode: 403,
      })
      expect(mockPrisma.service_schedules.create).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    beforeEach(() => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockPrisma.service_schedules.findFirst.mockResolvedValue(buildScheduleRow())
    })

    it('updates partial fields and returns the updated schedule', async () => {
      mockPrisma.service_schedules.update.mockResolvedValue(
        buildScheduleRow({ label: 'Casa', return_time: null }),
      )

      const result = await service.update(
        clientId,
        scheduleId,
        { label: 'Casa', return_time: null },
        driverUser,
      )

      expect(mockPrisma.service_schedules.update).toHaveBeenCalledWith({
        where: { id: scheduleId },
        data: expect.objectContaining({ label: 'Casa', return_time: null }),
      })
      expect(result.label).toBe('Casa')
      expect(result.return_time).toBeNull()
    })

    it('throws 404 when schedule does not belong to the client', async () => {
      mockPrisma.service_schedules.findFirst.mockResolvedValue(null)

      await expect(
        service.update(clientId, scheduleId, { label: 'x' }, driverUser),
      ).rejects.toMatchObject({ statusCode: 404 })
      expect(mockPrisma.service_schedules.update).not.toHaveBeenCalled()
    })

    it('validates day_of_week and time format on update', async () => {
      await expect(
        service.update(clientId, scheduleId, { day_of_week: 9 }, driverUser),
      ).rejects.toMatchObject({ statusCode: 400 })
      await expect(
        service.update(clientId, scheduleId, { pickup_time: 'nope' }, driverUser),
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('translates Prisma P2002 to 409 on update', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('Unique violation', {
        code: 'P2002',
        clientVersion: 'test',
      })
      mockPrisma.service_schedules.update.mockRejectedValue(err)

      await expect(
        service.update(clientId, scheduleId, { pickup_time: '08:00' }, driverUser),
      ).rejects.toMatchObject({ statusCode: 409 })
    })
  })

  describe('remove', () => {
    beforeEach(() => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
    })

    it('deletes the schedule when it belongs to the client', async () => {
      mockPrisma.service_schedules.findFirst.mockResolvedValue(buildScheduleRow())
      mockPrisma.service_schedules.delete.mockResolvedValue(buildScheduleRow())

      await service.remove(clientId, scheduleId, driverUser)

      expect(mockPrisma.service_schedules.delete).toHaveBeenCalledWith({
        where: { id: scheduleId },
      })
    })

    it('throws 404 when the schedule does not exist for this client', async () => {
      mockPrisma.service_schedules.findFirst.mockResolvedValue(null)

      await expect(service.remove(clientId, scheduleId, driverUser)).rejects.toMatchObject({
        statusCode: 404,
      })
      expect(mockPrisma.service_schedules.delete).not.toHaveBeenCalled()
    })

    it('throws 403 when user has read-only access', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('read-only')

      await expect(service.remove(clientId, scheduleId, driverUser)).rejects.toMatchObject({
        statusCode: 403,
      })
    })
  })

  describe('bulkReplace', () => {
    beforeEach(() => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
    })

    it('deletes existing and creates new ones in a transaction', async () => {
      const newRows = [
        buildScheduleRow({ id: BigInt(2), day_of_week: 2, pickup_time: new Date('1970-01-01T09:00:00.000Z'), return_time: null }),
        buildScheduleRow({ id: BigInt(3), day_of_week: 2, pickup_time: new Date('1970-01-01T14:05:00.000Z'), return_time: null }),
      ]

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          service_schedules: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
            findMany: jest.fn().mockResolvedValue(newRows),
          },
        }
        return cb(tx)
      })

      const result = await service.bulkReplace(
        clientId,
        {
          schedules: [
            { day_of_week: 2, pickup_time: '09:00', return_time: null, label: 'A' },
            { day_of_week: 2, pickup_time: '14:05', return_time: null, label: 'B' },
          ],
        },
        driverUser,
      )

      expect(result).toHaveLength(2)
      expect(result[0].pickup_time).toBe('09:00')
      expect(result[1].pickup_time).toBe('14:05')
    })

    it('deletes all when schedules array is empty', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          service_schedules: {
            deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
            createMany: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
          },
        }
        return cb(tx)
      })

      const result = await service.bulkReplace(clientId, { schedules: [] }, driverUser)

      expect(result).toEqual([])
    })

    it('validates every schedule before starting the transaction', async () => {
      await expect(
        service.bulkReplace(
          clientId,
          {
            schedules: [
              { day_of_week: 1, pickup_time: '07:30' },
              { day_of_week: 8, pickup_time: '09:00' },
            ],
          },
          driverUser,
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('schedules[1]'),
      })
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('rolls back when the transaction callback throws', async () => {
      mockPrisma.$transaction.mockImplementation(async () => {
        throw new AppError('Boom', 500)
      })

      await expect(
        service.bulkReplace(clientId, { schedules: [{ day_of_week: 1, pickup_time: '07:30' }] }, driverUser),
      ).rejects.toMatchObject({ statusCode: 500 })

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    })
  })
})
