import { Response } from 'express'
import { AuthRequest } from '../../middlewares/verifyToken'
import * as service from './service'

export const getAll = async (req: AuthRequest, res: Response) => {
  try {
    const clients = await service.getAll()
    res.json({ success: true, data: clients })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const client = await service.getById(id)
    res.json({ success: true, data: client })
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message })
  }
}

export const create = async (req: AuthRequest, res: Response) => {
  try {
    const client = await service.create(req.body, req.user?.dbId)
    res.status(201).json({ success: true, data: client })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const client = await service.update(id, req.body)
    res.json({ success: true, data: client })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const updateBillingConfig = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const client = await service.updateBillingConfig(id, req.body)
    res.json({ success: true, data: client })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    await service.remove(id)
    res.json({ success: true, data: null })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}