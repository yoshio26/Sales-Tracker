import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../../infrastructure/prisma.js'

export type Database = PrismaClient | Prisma.TransactionClient
export const database = prisma
export type ProductStatus = 'active' | 'archived'

export function listProducts(db: Database, userId: string, status: ProductStatus) {
  return db.product.findMany({
    where: status === 'active' ? { userId, active: true, deletedAt: null } : { userId, active: false },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
}

export function createProduct(db: Database, userId: string, input: { name: string; category: string; priceCents: number; stockQuantity?: number }) {
  return db.product.create({ data: { userId, ...input } })
}

export async function updateProduct(db: PrismaClient, userId: string, id: string, input: { name: string; category: string; priceCents: number; updatedAt: Date }) {
  return db.$transaction(async (tx) => {
    const updatedAt = new Date(Math.max(Date.now(), input.updatedAt.getTime() + 1))
    const changed = await tx.product.updateMany({
      where: { id, userId, active: true, deletedAt: null, updatedAt: input.updatedAt },
      data: { name: input.name, category: input.category, priceCents: input.priceCents, updatedAt },
    })
    if (changed.count === 1) return { kind: 'updated' as const, product: await tx.product.findUniqueOrThrow({ where: { id } }) }

    const current = await tx.product.findFirst({ where: { id, userId, deletedAt: null }, select: { active: true } })
    if (!current) return { kind: 'not-found' as const }
    return { kind: current.active ? 'stale' as const : 'archived' as const }
  })
}

export async function archiveProduct(db: PrismaClient, userId: string, id: string, updatedAt: Date) {
  return db.$transaction(async (tx) => {
    const archivedAt = new Date()
    const nextUpdatedAt = new Date(Math.max(Date.now(), updatedAt.getTime() + 1))
    const changed = await tx.product.updateMany({
      where: { id, userId, active: true, deletedAt: null, updatedAt },
      data: { active: false, archivedAt, updatedAt: nextUpdatedAt },
    })
    if (changed.count === 1) return { kind: 'updated' as const, product: await tx.product.findUniqueOrThrow({ where: { id } }) }

    const current = await tx.product.findFirst({ where: { id, userId, deletedAt: null }, select: { active: true } })
    if (!current) return { kind: 'not-found' as const }
    return { kind: current.active ? 'stale' as const : 'archived' as const }
  })
}

export async function permanentlyDeleteArchivedProduct(db: PrismaClient, userId: string, id: string) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id, userId, active: false }, select: { id: true } })
    if (!product) {
      const current = await tx.product.findFirst({ where: { id, userId }, select: { active: true } })
      return current ? { kind: 'active' as const } : { kind: 'not-found' as const }
    }

    await tx.expense.deleteMany({ where: { userId, productId: product.id } })
    await tx.stockPurchase.deleteMany({ where: { userId, productId: product.id } })
    await tx.product.delete({ where: { id: product.id } })
    return { kind: 'deleted' as const }
  })
}

export async function restoreArchivedProduct(db: PrismaClient, userId: string, id: string) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id, userId, active: false }, select: { id: true } })
    if (!product) return { kind: 'not-found' as const }

    try {
      const restoredAt = new Date()
      const restored = await tx.product.update({ where: { id: product.id }, data: { active: true, archivedAt: null, deletedAt: null, updatedAt: restoredAt } })
      await tx.expense.updateMany({ where: { userId, productId: product.id, deletedAt: { not: null } }, data: { deletedAt: null, updatedAt: restoredAt } })
      await tx.stockPurchase.updateMany({ where: { userId, productId: product.id, deletedAt: { not: null } }, data: { deletedAt: null } })
      return { kind: 'restored' as const, product: restored }
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return { kind: 'duplicate' as const }
      throw error
    }
  })
}