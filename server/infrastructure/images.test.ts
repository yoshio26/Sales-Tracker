import { Writable } from 'node:stream'
import express from 'express'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  config: { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret' },
  upload: vi.fn(), destroy: vi.fn(), configure: vi.fn(), products: vi.fn(), purchases: vi.fn(), log: vi.fn(),
}))
vi.mock('./config.js', () => ({ config: mocks.config }))
vi.mock('./prisma.js', () => ({ prisma: { product: { count: mocks.products }, stockPurchase: { count: mocks.purchases } } }))
vi.mock('./logger.js', () => ({ logError: mocks.log }))
vi.mock('cloudinary', () => ({ v2: { config: mocks.configure, uploader: { upload_stream: mocks.upload, destroy: mocks.destroy } } }))

import { cleanupImages, ImageError, PHOTO_WARNING, productUpload, uploadImage, validateImage, withProductPhotos } from './images.js'

async function file(format: 'png' | 'jpeg' | 'webp' = 'png') {
  const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff00aa' } }).toFormat(format).toBuffer()
  return { buffer, mimetype: `image/${format}`, size: buffer.length } as Express.Multer.File
}

describe('product image boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.config.CLOUDINARY_API_SECRET = 'test-secret'
    mocks.products.mockResolvedValue(0)
    mocks.purchases.mockResolvedValue(0)
    mocks.destroy.mockResolvedValue({ result: 'ok' })
    let sequence = 0
    mocks.upload.mockImplementation((_options, callback) => new Writable({ write(_chunk, _encoding, done) { done() }, final(done) {
      sequence++
      callback(null, { secure_url: `https://res.cloudinary.com/test/image/upload/${sequence}.png`, public_id: `asimon/products/${sequence}` })
      done()
    } }))
  })
  afterEach(() => vi.restoreAllMocks())

  it.each(['jpeg', 'png', 'webp'] as const)('decodes valid %s bytes', async (format) => {
    await expect(validateImage(await file(format))).resolves.toBeUndefined()
  })
  it('rejects spoofed MIME, corrupt bytes and truncated files before upload', async () => {
    const png = await file()
    for (const candidate of [{ ...png, mimetype: 'image/jpeg' }, { ...png, buffer: Buffer.from('not an image') }, { ...png, buffer: png.buffer.subarray(0, 40) }]) {
      await expect(validateImage(candidate)).rejects.toMatchObject({ status: 400, code: 'INVALID_IMAGE' })
    }
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('allows startup/JSON saves but returns explicit 503 for uploads without configuration', async () => {
    mocks.config.CLOUDINARY_API_SECRET = ''
    await expect(validateImage()).resolves.toBeUndefined()
    await expect(validateImage(await file())).rejects.toMatchObject({ status: 503, code: 'PHOTO_UNAVAILABLE' })
  })
  it('enforces the actual byte-size limit even when called without multipart middleware', async () => {
    await expect(validateImage({ buffer: Buffer.alloc(3 * 1024 * 1024 + 1), mimetype: 'image/png' } as Express.Multer.File)).rejects.toMatchObject({ status: 413 })
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('uses the server-owned folder and optimized image settings', async () => {
    await expect(uploadImage(await file())).resolves.toMatchObject({ imagePublicId: 'asimon/products/1' })
    expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({ folder: 'asimon/products', resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] }), expect.any(Function))
    expect(mocks.upload.mock.calls[0][0]).not.toHaveProperty('public_id')
  })
  it('keeps details save and returns a warning when a configured upload fails', async () => {
    mocks.upload.mockImplementation(() => { throw new Error('offline') })
    const save = vi.fn(async (photos, warning) => ({ photos, warning }))
    await expect(withProductPhotos(await file(), 1, save)).resolves.toEqual({ photos: [undefined], warning: PHOTO_WARNING })
    expect(save).toHaveBeenCalledOnce()
    expect(mocks.log).toHaveBeenCalledWith('image_upload_failed', expect.any(Error))
  })
  it('gives each bulk product an independently owned image and cleans only after save', async () => {
    await withProductPhotos(await file(), 2, async (photos) => {
      expect(photos.map((photo) => photo?.imagePublicId)).toEqual(['asimon/products/1', 'asimon/products/2'])
      expect(mocks.products).not.toHaveBeenCalled()
      mocks.products.mockResolvedValue(1)
    })
    expect(mocks.destroy).not.toHaveBeenCalled()
  })
  it.each(['stale', 'duplicate', 'not-found'])('cleans fresh uploads after a %s save outcome', async (kind) => {
    await withProductPhotos(await file(), 1, async () => ({ kind }))
    expect(mocks.destroy).toHaveBeenCalledWith('asimon/products/1', { resource_type: 'image' })
  })
  it('cleans every fresh bulk upload after transactional persistence rejects', async () => {
    await expect(withProductPhotos(await file(), 2, async () => { throw new Error('rollback') })).rejects.toThrow('rollback')
    expect(mocks.destroy).toHaveBeenCalledTimes(2)
  })
  it.each([[1, 0], [0, 1], [1, 1]])('retains global product/purchase references (%i/%i), including hidden records', async (products, purchases) => {
    mocks.products.mockResolvedValue(products)
    mocks.purchases.mockResolvedValue(purchases)
    await cleanupImages(['shared'])
    expect(mocks.products).toHaveBeenCalledWith({ where: { imagePublicId: 'shared' } })
    expect(mocks.purchases).toHaveBeenCalledWith({ where: { imagePublicId: 'shared' } })
    expect(mocks.destroy).not.toHaveBeenCalled()
  })
  it('deduplicates unused assets and isolates both reference-check and destroy failures', async () => {
    await cleanupImages([null, undefined, 'unused', 'unused'])
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    mocks.products.mockRejectedValueOnce(new Error('database offline'))
    await expect(cleanupImages(['unknown'])).resolves.toBeUndefined()
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    mocks.destroy.mockRejectedValueOnce(new Error('remote offline'))
    await expect(cleanupImages(['unused-again'])).resolves.toBeUndefined()
    expect(mocks.log).toHaveBeenCalledTimes(2)
  })

  it('enforces multipart file type, 3 MB limit, and one-file bound before saving', async () => {
    const app = express()
    const save = vi.fn()
    app.post('/', productUpload, (req, res) => { save(); res.json({ size: req.file?.size }) })
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const imageError = error as ImageError
      res.status(imageError.status ?? 500).json({ message: imageError.message })
    })
    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address() as { port: number }
    try {
      for (const [type, bytes, count, status] of [['image/gif', 10, 1, 400], ['image/png', 3 * 1024 * 1024 + 1, 1, 413], ['image/png', 10, 2, 400]] as const) {
        const body = new FormData()
        for (let index = 0; index < count; index++) body.append('image', new Blob([new Uint8Array(bytes)], { type }), 'photo')
        const response = await fetch(`http://127.0.0.1:${address.port}/`, { method: 'POST', body })
        expect(response.status).toBe(status)
      }
      expect(save).not.toHaveBeenCalled()
      const body = new FormData()
      const png = await file()
      body.append('image', new Blob([new Uint8Array(png.buffer)], { type: 'image/png' }), 'photo.png')
      expect((await fetch(`http://127.0.0.1:${address.port}/`, { method: 'POST', body })).status).toBe(200)
      expect(save).toHaveBeenCalledOnce()
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
  })
})