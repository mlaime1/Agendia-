import { Response } from 'express'
import { AuthRequest } from '../../middlewares/verifyToken'
import * as service from './service'

export const getAll = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const clients = await service.getAll(req.user)
    res.json({ success: true, data: clients })
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

export const getById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const client = await service.getById(id, req.user)
    res.json({ success: true, data: client })
  } catch (error: any) {
    res.status(error?.statusCode ?? 404).json({ success: false, message: error.message })
  }
}

export const create = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const client = await service.create(req.body, req.user)
    res.status(201).json({ success: true, data: client })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const client = await service.update(id, req.body, req.user)
    res.json({ success: true, data: client })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}

export const updateBillingConfig = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    const client = await service.updateBillingConfig(id, req.body, req.user)
    res.json({ success: true, data: client })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' })
    await service.remove(id, req.user)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ success: false, message: error.message })
  }
}
