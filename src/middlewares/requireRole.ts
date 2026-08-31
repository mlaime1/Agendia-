import { NextFunction, Response } from 'express'
import { $Enums } from '@prisma/client'
import { AuthRequest } from './verifyToken'

type Role = $Enums.Role

export function requireRole(role: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' })
    }

    if (req.user.role !== role) {
      return res.status(403).json({ success: false, message: 'Sin permisos' })
    }

    next()
  }
}
