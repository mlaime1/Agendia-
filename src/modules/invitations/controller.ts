import { Response } from 'express'
import { AuthRequest } from '../../middlewares/verifyToken'
import * as invitationService from './service'

export async function create(req: AuthRequest, res: Response) {
  try {
    const data = await invitationService.create(req.user!.dbId, req.body)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    res.status(error.statusCode ?? 400).json({ success: false, message: error.message })
  }
}

export async function list(req: AuthRequest, res: Response) {
  try {
    const data = await invitationService.findByDriver(req.user!.dbId)
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

export async function validateCode(req: AuthRequest, res: Response) {
  try {
    const code = req.params.code as string
    const data = await invitationService.validateCode(code)
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message })
  }
}
