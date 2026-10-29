/// <reference path="../../types/express.d.ts" />

import { Router } from 'express'
import { z } from 'zod'
import { requireSameOrigin } from '../../middleware/origin.js'
import { requireSession } from '../../middleware/session.js'
import { createAdjustment, deleteAdjustment, listAdjustments } from './service.js'

const amountSchema = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0 && Number(value) * 100 <= 2147483647)
const idSchema = z.object({ id: z.uuid() })
const createSchema = z.object({ amount: amountSchema, operation: z.enum(['add', 'deduct']), note: z.string().trim().max(2000).optional() })

function invalidInput(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid profit adjustment.' } })
}

export const profitAdjustmentRouter = Router()

profitAdjustmentRouter.get('/', requireSession, async (req, res, next) => {
  try {
    res.json({ adjustments: await listAdjustments(req.userId!) })
  } catch (error) {
    next(error)
  }
})

profitAdjustmentRouter.post('/', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    res.status(201).json({ adjustment: await createAdjustment(req.userId!, createSchema.parse(req.body)) })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof Error && error.message === 'Invalid amount') return invalidInput(res)
    next(error)
  }
})

profitAdjustmentRouter.delete('/:id', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    const outcome = await deleteAdjustment(req.userId!, id)
    if (outcome.kind === 'not-found') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profit adjustment not found.' } })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})
