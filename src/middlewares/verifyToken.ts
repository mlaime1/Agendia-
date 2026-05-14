import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'
import { prisma } from '../config/prisma'  // ← ajustá el path

export interface AuthRequest extends Request {
  user?: {
    authId: string
    role: 'driver' | 'admin' | 'client'
    dbId: bigint
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

  // Buscar en users con Prisma
  const dbUser = await prisma.users.findUnique({
    where: { auth_id: user.id },
    select: { id: true, role: true }
  })

  if (dbUser) {
    req.user = {
      authId: user.id,
      role: dbUser.role as 'driver' | 'admin',
      dbId: dbUser.id
    }
    return next()
  }

  // Buscar en clients con Prisma
  const dbClient = await prisma.clients.findUnique({
    where: { auth_id: user.id },
    select: { id: true }
  })

  if (dbClient) {
    req.user = {
      authId: user.id,
      role: 'client',
      dbId: dbClient.id
    }
    return next()
  }

  return res.status(401).json({ success: false, message: 'Usuario no encontrado' })
}