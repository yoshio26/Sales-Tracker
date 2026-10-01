import { Router } from 'express'
import { z } from 'zod'
import { requireSession } from '../../middleware/session.js'
import { getDashboard } from './service.js'

const rangeSchema = z.object({ from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() })

function invalidInput(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid reporting date range.' } })
}

export const dashboardRouter = Router()

dashboardRouter.get('/', requireSession, async (req, res, next) => {
  try {
    const range = rangeSchema.parse(req.query)
    if ((range.from && !range.to) || (!range.from && range.to) || range.from && range.to && new Date(range.from) >= new Date(range.to)) return invalidInput(res)
    res.json(await getDashboard(req.userId!, new Date(), range.from && range.to ? { from: new Date(range.from), to: new Date(range.to) } : {}))
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})