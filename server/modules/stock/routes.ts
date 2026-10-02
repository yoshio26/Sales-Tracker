/// <reference path="../../types/express.d.ts" />

import { Router } from 'express'
import { z } from 'zod'
import { requireSameOrigin } from '../../middleware/origin.js'
import { requireSession } from '../../middleware/session.js'
import { createPurchase, deletePurchase, deleteStockData, listPurchases, listStock, replenishStock } from './service.js'

const quantitySchema = z.number().int().positive().max(2147483647)
const replenishSchema = z.object({ productId: z.uuid(), quantity: quantitySchema })
const purchaseSchema = z.object({ productId: z.uuid(), quantity: quantitySchema })

function invalidInput(res: { status: (code: number) => { json: (body: unknown) => unknown } }, message = 'Enter a valid product and quantity.') {
  return res.status(400).json({ error: { code: 'INVALID_INPUT', message } })
}

export const stockRouter = Router()

stockRouter.get('/', requireSession, async (req, res, next) => {
  try { res.json({ products: await listStock(req.userId!) }) } catch (error) { next(error) }
})

stockRouter.get('/purchases', requireSession, async (req, res, next) => {
  try { res.json({ purchases: await listPurchases(req.userId!) }) } catch (error) { next(error) }
})

stockRouter.delete('/', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const outcome = await deleteStockData(req.userId!)
    res.json({ deleted: outcome.count })
  } catch (error) { next(error) }
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
    if (outcome.kind === 'product-price-missing') return res.status(409).json({ error: { code: 'PRODUCT_PRICE_MISSING', message: 'Set a price for this product in Stocks before buying it.' } })
    if (outcome.kind === 'purchase-total-too-large') return res.status(409).json({ error: { code: 'PURCHASE_TOTAL_TOO_LARGE', message: 'The purchase total is too large.' } })
    if (outcome.kind === 'insufficient-stock') return res.status(409).json({ error: { code: 'INSUFFICIENT_STOCK', message: 'Purchase quantity exceeds available stock.' } })
    res.status(201).json({ purchase: outcome.purchase })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

stockRouter.delete('/purchases/:id', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.uuid() }).parse(req.params)
    const outcome = await deletePurchase(req.userId!, id)
    if (outcome.kind === 'not-found') return res.status(404).json({ error: { code: 'PURCHASE_NOT_FOUND', message: 'Purchase history entry not found.' } })
    res.status(204).send()
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res, 'Enter a valid purchase history entry ID.')
    next(error)
  }
})