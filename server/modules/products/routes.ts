import { Router } from 'express'
import { z } from 'zod'
import { productUpload, withProductPhotos } from '../../infrastructure/images.js'
import { requireSameOrigin } from '../../middleware/origin.js'
import { requireSession } from '../../middleware/session.js'
import { archiveProduct, createProduct, createProducts, listProducts, permanentlyDeleteArchivedProduct, restoreArchivedProduct, updateProduct } from './service.js'

const idSchema = z.object({ id: z.uuid() })
const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  price: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0 && Number(value) * 100 <= 2147483647),
})
const originalPriceSchema = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0 && Number(value) * 100 <= 2147483647)
const stockQuantitySchema = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).pipe(z.number().int().nonnegative().max(1_000_000_000)).default(0)
const createProductSchema = productSchema.extend({ stockQuantity: stockQuantitySchema, originalPrice: originalPriceSchema.optional() })
const bulkCreateSchema = z.object({ products: z.array(createProductSchema).min(1).max(50) })
const updateSchema = productSchema.extend({ updatedAt: z.string().datetime({ offset: true }), removeImage: z.union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')]).optional() })
const listSchema = z.object({ status: z.enum(['active', 'archived']).default('active') })

function invalidInput(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Enter a valid product name, category, price, and timestamp.' } })
}

function sendOutcome(res: { status: (code: number) => { json: (body: unknown) => unknown }; json: (body: unknown) => unknown }, outcome: Awaited<ReturnType<typeof updateProduct | typeof archiveProduct>>) {
  if (outcome.kind === 'unchanged') return res.json({ product: outcome.product })
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

productsRouter.post('/', requireSession, requireSameOrigin, productUpload, async (req, res, next) => {
  try {
    const input = createProductSchema.parse(req.body)
    const outcome = await withProductPhotos(req.file, 1, async ([photo], warning) => ({ ...await createProduct(req.userId!, { ...input, ...photo }), warning }))
    if (outcome.kind === 'duplicate') return res.status(409).json({ error: { code: 'DUPLICATE_PRODUCT', message: 'A product with that name already exists.' } })
    res.status(201).json({ product: outcome.product, warning: outcome.warning })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

productsRouter.put('/:id', requireSession, requireSameOrigin, productUpload, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    const input = updateSchema.parse(req.body)
    const outcome = await withProductPhotos(req.file, 1, async ([photo], warning) => ({ ...await updateProduct(req.userId!, id, { ...input, ...photo, removeImage: req.file ? false : input.removeImage }), warning }))
    if (outcome.kind === 'updated' || outcome.kind === 'unchanged') return res.json({ product: outcome.product, warning: outcome.warning })
    sendOutcome(res, outcome)
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

productsRouter.delete('/:id/permanent', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    const outcome = await permanentlyDeleteArchivedProduct(req.userId!, id)
    if (outcome.kind === 'deleted') return res.json({ deleted: true })
    if (outcome.kind === 'active') return res.status(409).json({ error: { code: 'ACTIVE_PRODUCT', message: 'Archive the product before permanently deleting it.' } })
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Archived product not found.' } })
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

productsRouter.post('/:id/restore', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    const outcome = await restoreArchivedProduct(req.userId!, id)
    if (outcome.kind === 'restored') return res.json({ product: outcome.product })
    if (outcome.kind === 'duplicate') return res.status(409).json({ error: { code: 'DUPLICATE_PRODUCT', message: 'An active product with that name already exists.' } })
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Archived product not found.' } })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

productsRouter.post('/bulk', requireSession, requireSameOrigin, productUpload, async (req, res, next) => {
  try {
    let body = req.body
    if (req.is('multipart/form-data')) {
      try { body = { products: JSON.parse(req.body.products) } } catch { return invalidInput(res) }
    }
    const inputs = bulkCreateSchema.parse(body).products
    const outcome = await withProductPhotos(req.file, inputs.length, async (photos, warning) => ({ ...await createProducts(req.userId!, inputs.map((input, index) => ({ ...input, ...photos[index] }))), warning }))
    if (outcome.kind === 'duplicate') return res.status(409).json({ error: { code: 'DUPLICATE_PRODUCT', message: 'A product with that name already exists.' } })
    res.status(201).json({ products: outcome.products, warning: outcome.warning })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})