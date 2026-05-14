import { Request, Response } from 'express'
import * as authService from './service'
import { AuthRequest } from '../../middlewares/verifyToken'

export async function register(req: Request, res: Response) {
  try {
    const data = await authService.register(req.body)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = await authService.login(req.body)
    res.status(200).json({ success: true, data })
  } catch (error: any) {
    res.status(401).json({ success: false, message: error.message })
  }
}

export async function logout(req: AuthRequest, res: Response) {
  try {
    const token = req.headers.authorization!.split(' ')[1]
    await authService.logout(token)
    res.status(200).json({ success: true, data: null })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refresh_token } = req.body
    if (!refresh_token) {
      return res.status(400).json({ success: false, message: 'refresh_token requerido' })
    }
    const data = await authService.refreshSession(refresh_token)
    res.status(200).json({ success: true, data })
  } catch (error: any) {
    res.status(401).json({ success: false, message: error.message })
  }
}