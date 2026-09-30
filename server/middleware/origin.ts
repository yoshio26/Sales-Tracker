import type { NextFunction, Request, Response } from 'express'
import { config } from '../infrastructure/config.js'

export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (req.get('origin') !== config.APP_ORIGIN) {
    res.status(403).json({ error: { code: 'FORBIDDEN_ORIGIN', message: 'Request origin is not allowed.' } })
    return
  }
  next()
}