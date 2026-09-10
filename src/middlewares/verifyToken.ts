import { Request, Response, NextFunction } from 'express'
import { $Enums } from '@prisma/client'
import { supabase } from '../lib/supabase'
import { prisma } from '../config/prisma'  // ← ajustá el path

export interface AuthRequest extends Request {
  user?: {
    authId: string
    role: $Enums.Role
    dbId: bigint
    passengerId?: bigint
    phone?: string
  }
}

export async function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token requerido' })
  }

  const token = authHeader.split(' ')[1]

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' })
  }

  const phone = user.phone ?? user.user_metadata?.phone ?? undefined

  // Buscar en users con Prisma
  const dbUser = await prisma.users.findUnique({
    where: { auth_id: user.id },
    select: { id: true, role: true }
  })

  if (dbUser) {
    req.user = {
      authId: user.id,
      role: dbUser.role,
      dbId: dbUser.id,
      phone,
    }
    return next()
  }

  // Buscar en passenger con Prisma
  const dbClient = await prisma.passenger.findUnique({
    where: { auth_id: user.id },
    select: { id: true }
  })

  if (dbClient) {
    req.user = {
      authId: user.id,
      role: 'CLIENT',
      dbId: dbClient.id,
      passengerId: dbClient.id,
      phone,
    }
    return next()
  }

  return res.status(401).json({ success: false, message: 'Usuario no encontrado' })
}