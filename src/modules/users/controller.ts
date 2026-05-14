import { Response } from 'express'
import { AuthRequest } from '../../middlewares/verifyToken'
import * as usersService from './service'

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const data = await usersService.getMe(req.user!.dbId)
    res.status(200).json({ success: true, data })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export async function updateMe(req: AuthRequest, res: Response) {
  try {
    const data = await usersService.updateMe(req.user!.dbId, req.body)
    res.status(200).json({ success: true, data })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export async function getAll(req: AuthRequest, res: Response) {
  try {
    const data = await usersService.getAll()
    res.status(200).json({ success: true, data })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}