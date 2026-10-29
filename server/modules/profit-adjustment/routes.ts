/// <reference path="../../types/express.d.ts" />

import { Router } from 'express'
import { z } from 'zod'
import { requireSameOrigin } from '../../middleware/origin.js'
import { requireSession } from '../../middleware/session.js'
import { deleteAdjustment, getAdjustment, saveAdjustment } from './service.js'

const amountSchema = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0 && Number(value) * 100 <= 2147483647)
const saveSchema = z.object({ amount: amountSchema, operation: z.enum(['add', 'deduct']), note: z.string().trim().max(2000).optional(), updatedAt: z.string().datetime({ offset: true }).optional() })

function invalidInput(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid profit adjustment.' } })
}

export const profitAdjustmentRouter = Router()

profitAdjustmentRouter.get('/', requireSession, async (req, res, next) => {
  try {
    res.json({ adjustment: await getAdjustment(req.userId!) })
  } catch (error) {
    next(error)
  }
})

profitAdjustmentRouter.put('/', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const outcome = await saveAdjustment(req.userId!, saveSchema.parse(req.body))
    if (outcome.kind === 'stale') return res.status(409).json({ error: { code: 'STALE_PROFIT_ADJUSTMENT', message: 'This adjustment changed. Refresh and try again.' } })
    if (outcome.kind === 'not-found') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profit adjustment not found.' } })
    res.json({ adjustment: outcome.adjustment })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof Error && error.message === 'Invalid amount') return invalidInput(res)
    next(error)
  }
})

profitAdjustmentRouter.delete('/', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const outcome = await deleteAdjustment(req.userId!)
    if (outcome.kind === 'not-found') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profit adjustment not found.' } })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})
