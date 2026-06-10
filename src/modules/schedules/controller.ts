import { Response } from 'express'
import { AuthRequest } from '../../middlewares/verifyToken'
import * as service from './service'

const paramToString = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export const getByClient = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = BigInt(paramToString(req.params.id))
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' })
    }
    const schedules = await service.getByClient(clientId, req.user)
    res.json({ success: true, data: schedules })
  } catch (error: any) {
    const status = error?.statusCode ?? 500
    res.status(status).json({ success: false, message: error.message })
  }
}

export const create = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = BigInt(paramToString(req.params.id))
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' })
    }
    const schedule = await service.create(clientId, req.body, req.user)
    res.status(201).json({ success: true, data: schedule })
  } catch (error: any) {
    const status = error?.statusCode ?? 400
    res.status(status).json({ success: false, message: error.message })
  }
}

export const bulkReplace = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = BigInt(paramToString(req.params.id))
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' })
    }
    const schedules = await service.bulkReplace(clientId, req.body, req.user)
    res.json({ success: true, data: schedules })
  } catch (error: any) {
    const status = error?.statusCode ?? 400
    res.status(status).json({ success: false, message: error.message })
  }
}

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = BigInt(paramToString(req.params.id))
    const scheduleId = BigInt(paramToString(req.params.schedId))
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' })
    }
    const schedule = await service.update(clientId, scheduleId, req.body, req.user)
    res.json({ success: true, data: schedule })
  } catch (error: any) {
    const status = error?.statusCode ?? 400
    res.status(status).json({ success: false, message: error.message })
  }
}

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = BigInt(paramToString(req.params.id))
    const scheduleId = BigInt(paramToString(req.params.schedId))
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' })
    }
    await service.remove(clientId, scheduleId, req.user)
    res.json({ success: true, data: null })
  } catch (error: any) {
    const status = error?.statusCode ?? 400
    res.status(status).json({ success: false, message: error.message })
  }
}
