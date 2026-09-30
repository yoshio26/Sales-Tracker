import { Router } from 'express'
import { z } from 'zod'
import { config } from '../../infrastructure/config.js'
import { logout, requestCode, verifyCode } from './service.js'

const emailSchema = z.object({ email: z.string().trim().email().max(320) })
const verifySchema = emailSchema.extend({ code: z.string().regex(/^\d{6}$/) })
const SESSION_COOKIE = 'sales_tracker_session'

export const authRouter = Router()

authRouter.post('/request-code', async (req, res, next) => {
  try {
    const { email } = emailSchema.parse(req.body)
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    res.json(await requestCode(email, ip))
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid email address.' } })
    next(error)
  }
})

authRouter.post('/verify-code', async (req, res, next) => {
  try {
    const { email, code } = verifySchema.parse(req.body)
    const result = await verifyCode(email, code)
    if (!result.ok) return res.status(401).json({ error: { code: 'INVALID_CODE', message: 'The code could not be verified.' } })
    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.COOKIE_SECURE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    })
    res.json({ message: 'Signed in.' })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid email and six-digit code.' } })
    next(error)
  }
})

authRouter.post('/logout', async (req, res, next) => {
  try {
    await logout(req.cookies[SESSION_COOKIE])
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.COOKIE_SECURE, path: '/' })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

authRouter.get('/session', (req, res) => {
  res.json({ authenticated: Boolean(req.userId) })
})

export { SESSION_COOKIE }
