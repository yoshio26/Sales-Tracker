import type { Product } from '@prisma/client'
import { notifyStock } from '../notifications/service.js'
import {
  archiveProduct as archiveProductRecord,
  createProduct as createProductRecord,
  createProducts as createProductsRecord,
  database,
  listProducts as listProductRecords,
  permanentlyDeleteArchivedProduct as permanentlyDeleteArchivedProductRecord,
  restoreArchivedProduct as restoreArchivedProductRecord,
  type ProductStatus,
  updateProduct as updateProductRecord,
} from './data-access.js'

export type ProductResponse = {
  id: string
  name: string
  category: string
  price: string
  originalPrice: string | null
  stockQuantity: number
  active: boolean
  archivedAt: string | null
  deletedAt: string | null
  updatedAt: string
}

export function normalizeProductName(value: string): string {
  return value.trim().toLowerCase()
}

function toResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: ((product.priceCents ?? 0) / 100).toFixed(2),
    originalPrice: product.originalPriceCents == null ? null : (product.originalPriceCents / 100).toFixed(2),
    stockQuantity: product.stockQuantity,
    active: product.active,
    archivedAt: product.archivedAt?.toISOString() ?? null,
    deletedAt: product.deletedAt?.toISOString() ?? null,
    updatedAt: product.updatedAt.toISOString(),
  }
}

export async function listProducts(userId: string, status: ProductStatus): Promise<ProductResponse[]> {
  return (await listProductRecords(database, userId, status)).map(toResponse)
}

export function parsePrice(value: string): number {
  const normalized = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Invalid price')
  const [whole, fraction = ''] = normalized.split('.')
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`)
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 2147483647) throw new Error('Invalid price')
  return cents
}

function notificationItem(product: ProductResponse) {
  return {
    name: product.name,
    category: product.category,
    quantity: product.stockQuantity,
    price: product.price,
    ...(product.originalPrice && product.stockQuantity > 0 ? { costDeducted: (Number(product.originalPrice) * product.stockQuantity).toFixed(2) } : {}),
  }
}

export async function createProduct(userId: string, input: { name: string; category: string; price?: string; originalPrice?: string; stockQuantity?: number }) {
  try {
    const createInput = {
      name: normalizeProductName(input.name),
      category: input.category.trim().toLowerCase(),
      priceCents: input.price === undefined ? 0 : parsePrice(input.price),
      ...(input.originalPrice === undefined ? {} : { originalPriceCents: parsePrice(input.originalPrice), deductionCents: parsePrice(input.originalPrice) }),
    }
    const product = toResponse(await createProductRecord(database, userId, { ...createInput, ...(input.stockQuantity === undefined ? {} : { stockQuantity: input.stockQuantity }) }))
    void notifyStock(userId, 'added', [notificationItem(product)])
    return { kind: 'created' as const, product }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return { kind: 'duplicate' as const }
    throw error
  }
}

export async function updateProduct(userId: string, id: string, input: { name: string; category: string; price?: string; updatedAt: string }) {
  try {
    const outcome = await updateProductRecord(database, userId, id, {
      name: normalizeProductName(input.name),
      category: input.category.trim().toLowerCase(),
      priceCents: input.price === undefined ? 0 : parsePrice(input.price),
      updatedAt: new Date(input.updatedAt),
    })
    if (outcome.kind !== 'updated') return outcome
    const product = toResponse(outcome.product)
    if (outcome.kind === 'updated') {
      void notifyStock(userId, 'changed', [{ name: product.name, category: product.category, changes: [
        ...(outcome.previous.name !== product.name ? [{ label: 'Name', before: outcome.previous.name, after: product.name }] : []),
        ...(outcome.previous.category !== product.category ? [{ label: 'Category', before: outcome.previous.category, after: product.category }] : []),
        ...(outcome.previous.priceCents !== outcome.product.priceCents ? [{ label: 'Price', before: (outcome.previous.priceCents / 100).toFixed(2), after: product.price }] : []),
      ] }])
    }
    return { ...outcome, product }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return { kind: 'duplicate' as const }
    throw error
  }
}

export async function archiveProduct(userId: string, id: string, updatedAt: string) {
  const outcome = await archiveProductRecord(database, userId, id, new Date(updatedAt))
  if (outcome.kind !== 'updated') return outcome
  const product = toResponse(outcome.product)
  void notifyStock(userId, 'deleted', [{ name: product.name, category: product.category, quantity: product.stockQuantity }])
  return { ...outcome, product }
}

export async function permanentlyDeleteArchivedProduct(userId: string, id: string) {
  const outcome = await permanentlyDeleteArchivedProductRecord(database, userId, id)
  if (outcome.kind === 'deleted') void notifyStock(userId, 'deleted', [{ name: outcome.product.name, category: outcome.product.category, quantity: outcome.product.stockQuantity }])
  return outcome
}

export async function restoreArchivedProduct(userId: string, id: string) {
  const outcome = await restoreArchivedProductRecord(database, userId, id)
  return outcome.kind === 'restored' ? { ...outcome, product: toResponse(outcome.product) } : outcome
}

export async function createProducts(userId: string, inputs: Array<{ name: string; category: string; price?: string; originalPrice?: string; stockQuantity?: number }>) {
  try {
    const normalized = inputs.map((input) => ({
      name: normalizeProductName(input.name),
      category: input.category.trim().toLowerCase(),
      priceCents: input.price === undefined ? 0 : parsePrice(input.price),
      ...(input.originalPrice === undefined ? {} : { originalPriceCents: parsePrice(input.originalPrice), deductionCents: parsePrice(input.originalPrice) }),
      ...(input.stockQuantity === undefined ? {} : { stockQuantity: input.stockQuantity }),
    }))
    const products = (await createProductsRecord(database, userId, normalized)).map(toResponse)
    void notifyStock(userId, 'added', products.map(notificationItem), true)
    return { kind: 'created' as const, products }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return { kind: 'duplicate' as const }
    throw error
  }
}