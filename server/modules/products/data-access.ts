import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../../infrastructure/prisma.js'

export type Database = PrismaClient | Prisma.TransactionClient
export const database = prisma
export type ProductStatus = 'active' | 'archived'

export function listProducts(db: Database, userId: string, status: ProductStatus) {
  return db.product.findMany({
    where: { userId, active: status === 'active' },
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
      where: { id, userId, active: true, updatedAt: input.updatedAt },
      data: { name: input.name, category: input.category, priceCents: input.priceCents, updatedAt },
    })
    if (changed.count === 1) return { kind: 'updated' as const, product: await tx.product.findUniqueOrThrow({ where: { id } }) }

    const current = await tx.product.findFirst({ where: { id, userId }, select: { active: true } })
    if (!current) return { kind: 'not-found' as const }
    return { kind: current.active ? 'stale' as const : 'archived' as const }
  })
}

export async function archiveProduct(db: PrismaClient, userId: string, id: string, updatedAt: Date) {
  return db.$transaction(async (tx) => {
    const archivedAt = new Date()
    const nextUpdatedAt = new Date(Math.max(Date.now(), updatedAt.getTime() + 1))
    const changed = await tx.product.updateMany({
      where: { id, userId, active: true, updatedAt },
      data: { active: false, archivedAt, updatedAt: nextUpdatedAt },
    })
    if (changed.count === 1) return { kind: 'updated' as const, product: await tx.product.findUniqueOrThrow({ where: { id } }) }

    const current = await tx.product.findFirst({ where: { id, userId }, select: { active: true } })
    if (!current) return { kind: 'not-found' as const }
    return { kind: current.active ? 'stale' as const : 'archived' as const }
  })
}