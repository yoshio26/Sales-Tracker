/// <reference path="../../types/express.d.ts" />

import { Router } from 'express'
import { z } from 'zod'
import { requireSameOrigin } from '../../middleware/origin.js'
import { requireSession } from '../../middleware/session.js'
import { createPurchase, listPurchases, listStock, replenishStock } from './service.js'

const quantitySchema = z.number().int().positive().max(2147483647)
const replenishSchema = z.object({ productId: z.uuid(), quantity: quantitySchema })
const purchaseSchema = z.object({ productId: z.uuid(), quantity: quantitySchema, totalCost: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0 && Number(value) * 100 <= 2147483647) })

function invalidInput(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid product, quantity, and total cost.' } })
}

export const stockRouter = Router()

stockRouter.get('/', requireSession, async (req, res, next) => {
  try { res.json({ products: await listStock(req.userId!) }) } catch (error) { next(error) }
})

stockRouter.get('/purchases', requireSession, async (req, res, next) => {
  try { res.json({ purchases: await listPurchases(req.userId!) }) } catch (error) { next(error) }
})

stockRouter.post('/replenish', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const input = replenishSchema.parse(req.body)
    const outcome = await replenishStock(req.userId!, input.productId, input.quantity)
    if (outcome.kind === 'not-found') return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Active product not found.' } })
    res.json({ product: outcome.product })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

stockRouter.post('/purchases', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const outcome = await createPurchase(req.userId!, purchaseSchema.parse(req.body))
    if (outcome.kind === 'product-not-found') return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Active product not found.' } })
    if (outcome.kind === 'insufficient-stock') return res.status(409).json({ error: { code: 'INSUFFICIENT_STOCK', message: 'Purchase quantity exceeds available stock.' } })
    res.status(201).json({ purchase: outcome.purchase })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof Error && error.message === 'Invalid cost') return invalidInput(res)
    next(error)
  }
})