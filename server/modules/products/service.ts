import type { Product } from '@prisma/client'
import {
  archiveProduct as archiveProductRecord,
  createProduct as createProductRecord,
  database,
  listProducts as listProductRecords,
  type ProductStatus,
  updateProduct as updateProductRecord,
} from './data-access.js'

export type ProductResponse = {
  id: string
  name: string
  category: string
  active: boolean
  archivedAt: string | null
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
    active: product.active,
    archivedAt: product.archivedAt?.toISOString() ?? null,
    updatedAt: product.updatedAt.toISOString(),
  }
}

export async function listProducts(userId: string, status: ProductStatus): Promise<ProductResponse[]> {
  return (await listProductRecords(database, userId, status)).map(toResponse)
}

export async function createProduct(userId: string, input: { name: string; category: string }) {
  try {
    return { kind: 'created' as const, product: toResponse(await createProductRecord(database, userId, {
      name: normalizeProductName(input.name),
      category: input.category.trim().toLowerCase(),
    })) }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return { kind: 'duplicate' as const }
    throw error
  }
}

export async function updateProduct(userId: string, id: string, input: { name: string; category: string; updatedAt: string }) {
  try {
    const outcome = await updateProductRecord(database, userId, id, {
      name: normalizeProductName(input.name),
      category: input.category.trim().toLowerCase(),
      updatedAt: new Date(input.updatedAt),
    })
    return outcome.kind === 'updated' ? { ...outcome, product: toResponse(outcome.product) } : outcome
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return { kind: 'duplicate' as const }
    throw error
  }
}

export async function archiveProduct(userId: string, id: string, updatedAt: string) {
  const outcome = await archiveProductRecord(database, userId, id, new Date(updatedAt))
  return outcome.kind === 'updated' ? { ...outcome, product: toResponse(outcome.product) } : outcome
}