import { Router } from 'express'
import { z } from 'zod'
import { requireSameOrigin } from '../../middleware/origin.js'
import { requireSession } from '../../middleware/session.js'
import { archiveProduct, createProduct, listProducts, updateProduct } from './service.js'

const idSchema = z.object({ id: z.uuid() })
const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
})
const updateSchema = productSchema.extend({ updatedAt: z.string().datetime({ offset: true }) })
const listSchema = z.object({ status: z.enum(['active', 'archived']).default('active') })

function invalidInput(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid product name, category, and timestamp.' } })
}

function sendOutcome(res: { status: (code: number) => { json: (body: unknown) => unknown }; json: (body: unknown) => unknown }, outcome: Awaited<ReturnType<typeof updateProduct | typeof archiveProduct>>) {
  if (outcome.kind === 'updated') return res.json({ product: outcome.product })
  if (outcome.kind === 'not-found') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found.' } })
  if (outcome.kind === 'duplicate') return res.status(409).json({ error: { code: 'DUPLICATE_PRODUCT', message: 'A product with that name already exists.' } })
  return res.status(409).json({ error: { code: 'STALE_PRODUCT', message: 'This product changed. Refresh and try again.' } })
}

export const productsRouter = Router()

productsRouter.get('/', requireSession, async (req, res, next) => {
  try {
    const { status } = listSchema.parse(req.query)
    res.json({ products: await listProducts(req.userId!, status) })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

productsRouter.post('/', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const input = productSchema.parse(req.body)
    const outcome = await createProduct(req.userId!, input)
    if (outcome.kind === 'duplicate') return res.status(409).json({ error: { code: 'DUPLICATE_PRODUCT', message: 'A product with that name already exists.' } })
    res.status(201).json({ product: outcome.product })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

productsRouter.put('/:id', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    sendOutcome(res, await updateProduct(req.userId!, id, updateSchema.parse(req.body)))
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

productsRouter.delete('/:id', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    sendOutcome(res, await archiveProduct(req.userId!, id, z.object({ updatedAt: z.string().datetime({ offset: true }) }).parse(req.body).updatedAt))
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})