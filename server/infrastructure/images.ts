import multer from 'multer'
import sharp from 'sharp'
import { v2 as cloudinary } from 'cloudinary'
import type { RequestHandler } from 'express'
import { config } from './config.js'
import { prisma } from './prisma.js'
import { logError } from './logger.js'

export type ImageFields = { imageUrl: string | null; imagePublicId: string | null }
export class ImageError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
const types = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' } as const
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 8, fieldSize: 64 * 1024, parts: 9 }, fileFilter: (_req, file, done) => {
  if (!(file.mimetype in types)) return done(new ImageError(400, 'INVALID_IMAGE', 'Choose a JPEG, PNG, or WebP photo.'))
  done(null, true)
} }).single('image')
export const productUpload: RequestHandler = (req, res, next) => parser(req, res, (error: unknown) => {
  if (error instanceof multer.MulterError) return next(new ImageError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'INVALID_IMAGE', error.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 3 MB or smaller.' : 'Invalid photo upload.'))
  if (error && !(error instanceof ImageError)) return next(new ImageError(400, 'INVALID_IMAGE', 'Invalid multipart photo upload.'))
  return next(error)
})

export async function validateImage(file?: Express.Multer.File): Promise<void> {
  if (!file) return
  if (file.buffer.length > 3 * 1024 * 1024) throw new ImageError(413, 'INVALID_IMAGE', 'Photo must be 3 MB or smaller.')
  try {
    const image = sharp(file.buffer, { limitInputPixels: 40_000_000, animated: false })
    const metadata = await image.metadata()
    if (metadata.format !== types[file.mimetype as keyof typeof types]) throw new Error('type mismatch')
    await image.stats() // Decode actual pixels, not just the supplied MIME type/header.
  } catch { throw new ImageError(400, 'INVALID_IMAGE', 'Photo bytes must be a valid JPEG, PNG, or WebP matching its type.') }
  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
    throw new ImageError(503, 'PHOTO_UNAVAILABLE', 'Photo uploads are unavailable: Cloudinary is not configured.')
  }
}

export async function uploadImage(file: Express.Multer.File): Promise<ImageFields> {
  cloudinary.config({ cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET })
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'asimon/products', resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }], timeout: 30_000 }, (error, result) => {
      if (error || !result) return reject(error ?? new Error('Missing upload result'))
      resolve({ imageUrl: result.secure_url, imagePublicId: result.public_id })
    })
    stream.on('error', reject)
    stream.end(file.buffer)
  })
}

// Global reference checks deliberately include archived/deleted rows and all tenants.
export async function cleanupImages(candidates: Array<string | null | undefined>): Promise<void> {
  for (const publicId of new Set(candidates.filter((id): id is string => Boolean(id)))) {
    try {
      const [products, purchases] = await Promise.all([
        prisma.product.count({ where: { imagePublicId: publicId } }),
        prisma.stockPurchase.count({ where: { imagePublicId: publicId } }),
      ])
      if (products || purchases) continue
      cloudinary.config({ cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET })
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
    } catch (error) { logError('image_cleanup_failed', error) }
  }
}

export const PHOTO_WARNING = 'Product details saved, but the photo could not be uploaded. Please try again.'

export async function withProductPhotos<T>(file: Express.Multer.File | undefined, count: number, save: (photos: Array<ImageFields | undefined>, warning?: string) => Promise<T>): Promise<T> {
  await validateImage(file)
  const photos: Array<ImageFields | undefined> = []
  let warning: string | undefined
  try {
    for (let index = 0; index < count; index++) {
      try { photos.push(file ? await uploadImage(file) : undefined) }
      catch (error) { logError('image_upload_failed', error); warning = PHOTO_WARNING; photos.push(undefined) }
    }
    return await save(photos, warning)
  } finally { await cleanupImages(photos.map((photo) => photo?.imagePublicId)) }
}