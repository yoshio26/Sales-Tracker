import type { NextFunction, Request, Response } from 'express'
import { resolveSession } from '../modules/auth/service.js'
import { SESSION_COOKIE } from '../modules/auth/routes.js'

export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    req.userId = undefined
    const session = await resolveSession(req.cookies[SESSION_COOKIE])
    if (session) req.userId = session.userId
    next()
  } catch (error) {
    next(error)
  }
}

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!req.userId) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } })
    return
  }
  next()
}
