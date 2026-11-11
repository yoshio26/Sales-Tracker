import { Writable } from 'node:stream'
import express from 'express'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  config: { APP_ORIGIN: 'http://localhost:5173', CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test', CLOUDINARY_API_SECRET: 'test' },
  createProduct: vi.fn(), createProducts: vi.fn(), updateProduct: vi.fn(), upload: vi.fn(), destroy: vi.fn(), count: vi.fn(),
}))
vi.mock('../../infrastructure/config.js', () => ({ config: mocks.config }))
vi.mock('../../infrastructure/prisma.js', () => ({ prisma: { product: { count: mocks.count }, stockPurchase: { count: mocks.count } } }))
vi.mock('../../infrastructure/logger.js', () => ({ logError: vi.fn() }))
vi.mock('cloudinary', () => ({ v2: { config: vi.fn(), uploader: { upload_stream: mocks.upload, destroy: mocks.destroy } } }))
vi.mock('./service.js', () => ({ ...mocks, listProducts: vi.fn(), archiveProduct: vi.fn(), permanentlyDeleteArchivedProduct: vi.fn(), restoreArchivedProduct: vi.fn() }))
import { productsRouter } from './routes.js'
import { ImageError, PHOTO_WARNING } from '../../infrastructure/images.js'

describe('authenticated multipart product saves', () => {
  let server: ReturnType<express.Express['listen']>
  let base: string
  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.config.CLOUDINARY_API_SECRET = 'test'
    mocks.count.mockResolvedValue(0)
    mocks.destroy.mockResolvedValue({ result: 'ok' })
    let sequence = 0
    mocks.upload.mockImplementation((_options, callback) => new Writable({ write(_chunk, _encoding, done) { done() }, final(done) {
      sequence++
      callback(null, { secure_url: `https://res.cloudinary.com/test/${sequence}.png`, public_id: `test/${sequence}` })
      done()
    } }))
    mocks.createProduct.mockImplementation(async (_user, input) => ({ kind: 'created', product: { name: input.name, imageUrl: input.imageUrl ?? null } }))
    mocks.createProducts.mockImplementation(async (_user, inputs) => ({ kind: 'created', products: inputs.map((input: { name: string; imageUrl?: string }) => ({ name: input.name, imageUrl: input.imageUrl ?? null })) }))
    mocks.updateProduct.mockImplementation(async (_user, _id, input) => ({ kind: 'updated', product: { name: input.name, imageUrl: input.imageUrl ?? 'https://res.cloudinary.com/test/old.png' } }))
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => { if (req.get('x-test-session') === 'yes') req.userId = 'user-a'; next() })
    app.use('/products', productsRouter)
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const photoError = error as ImageError
      res.status(photoError.status ?? 500).json({ error: { code: photoError.code, message: photoError.message } })
    })
    server = app.listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/products`
  })
  afterEach(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) })

  async function body({ bulk = false, type = 'image/png', bytes, includeImage = true }: { bulk?: boolean; type?: string; bytes?: Uint8Array; includeImage?: boolean } = {}) {
    const data = new FormData()
    const details = { name: 'Widget', category: 'Tools', price: '10.00', stockQuantity: 2 }
    if (bulk) data.append('products', JSON.stringify([details, { ...details, name: 'Cable' }]))
    else for (const [key, value] of Object.entries(details)) data.append(key, String(value))
    data.append('updatedAt', '2026-11-11T00:00:00.000Z')
    if (includeImage) {
      const png = bytes ?? new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer())
      data.append('image', new Blob([png as BlobPart], { type }), 'photo.png')
    }
    return data
  }
  const headers = { origin: 'http://localhost:5173', 'x-test-session': 'yes' }
  const id = '123e4567-e89b-12d3-a456-426614174000'

  it('creates a photo product and saves a shared bulk photo with independently owned IDs', async () => {
    expect((await fetch(base, { method: 'POST', headers, body: await body() })).status).toBe(201)
    expect(mocks.createProduct).toHaveBeenCalledWith('user-a', expect.objectContaining({ imagePublicId: 'test/1', stockQuantity: 2 }))
    const result = await fetch(`${base}/bulk`, { method: 'POST', headers, body: await body({ bulk: true }) })
    expect(result.status).toBe(201)
    expect(mocks.createProducts.mock.calls[0][1].map((input: { imagePublicId: string }) => input.imagePublicId)).toEqual(['test/2', 'test/3'])
    expect(JSON.stringify(await result.json())).not.toContain('imagePublicId')
  })
  it.each(['POST', 'PUT'])('saves details with an old/no photo and warning after failed upload (%s)', async (method) => {
    mocks.upload.mockImplementation(() => { throw new Error('offline') })
    const result = await fetch(method === 'POST' ? base : `${base}/${id}`, { method, headers, body: await body() })
    expect(result.status).toBe(method === 'POST' ? 201 : 200)
    const response = await result.json()
    expect(response.warning).toBe(PHOTO_WARNING)
    expect(response.product.imageUrl).toBe(method === 'POST' ? null : 'https://res.cloudinary.com/test/old.png')
    expect((method === 'POST' ? mocks.createProduct.mock.calls[0][1] : mocks.updateProduct.mock.calls[0][2])).not.toHaveProperty('imagePublicId')
  })
  it.each([[new Uint8Array([1, 2, 3]), 'image/png', 400], [new Uint8Array(3 * 1024 * 1024 + 1), 'image/png', 413], [new Uint8Array([1]), 'image/gif', 400]] as const)('rejects invalid/oversized files without product mutations', async (bytes, type, status) => {
    const response = await fetch(base, { method: 'POST', headers, body: await body({ bytes, type }) })
    expect(response.status).toBe(status)
    expect(mocks.createProduct).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('returns 503 without configured credentials while JSON saves remain compatible', async () => {
    mocks.config.CLOUDINARY_API_SECRET = ''
    expect((await fetch(base, { method: 'POST', headers, body: await body() })).status).toBe(503)
    expect(mocks.createProduct).not.toHaveBeenCalled()
    const result = await fetch(base, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Widget', category: 'Tools', price: '10.00' }) })
    expect(result.status).toBe(201)
  })
  it('ignores client-supplied URLs and public IDs and supports JSON image removal', async () => {
    await fetch(base, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Widget', category: 'Tools', price: '10.00', imageUrl: 'https://evil.test/image', imagePublicId: 'other-tenant' }) })
    expect(mocks.createProduct.mock.calls[0][1]).not.toHaveProperty('imageUrl')
    await fetch(`${base}/${id}`, { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Widget', category: 'Tools', price: '10.00', updatedAt: '2026-11-11T00:00:00.000Z', removeImage: true }) })
    expect(mocks.updateProduct.mock.calls[0][2]).toMatchObject({ removeImage: true })
  })
  it.each([null, true, false, '', 'not-a-number'])('rejects invalid stock quantity %s instead of coercing it', async (stockQuantity) => {
    const response = await fetch(base, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Widget', category: 'Tools', price: '10.00', stockQuantity }) })
    expect(response.status).toBe(400)
    expect(mocks.createProduct).not.toHaveBeenCalled()
  })
  it('rejects missing session/foreign origin before upload or saving', async () => {
    expect((await fetch(base, { method: 'POST', headers: { origin: headers.origin }, body: await body() })).status).toBe(401)
    expect((await fetch(base, { method: 'POST', headers: { ...headers, origin: 'https://evil.test' }, body: await body() })).status).toBe(403)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.createProduct).not.toHaveBeenCalled()
  })
  it.each(['stale', 'duplicate'])('cleans an uploaded replacement after %s without returning product data', async (kind) => {
    mocks.updateProduct.mockResolvedValue({ kind })
    const response = await fetch(`${base}/${id}`, { method: 'PUT', headers, body: await body() })
    expect(response.status).toBe(409)
    expect(await response.json()).not.toHaveProperty('product')
    expect(mocks.destroy).toHaveBeenCalledWith('test/1', { resource_type: 'image' })
  })
})