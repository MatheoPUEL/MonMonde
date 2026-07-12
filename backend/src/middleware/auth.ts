import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

interface JwtPayload {
  userId: string
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; email: string; avatarUrl: string | null }
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
