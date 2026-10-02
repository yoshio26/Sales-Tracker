import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../../infrastructure/prisma.js'

export type Database = PrismaClient | Prisma.TransactionClient
export const database = prisma

const productSelection = {
  id: true,
  name: true,
  category: true,
  stockQuantity: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect

const purchaseSelection = {
  id: true,
  productId: true,
  productNameSnapshot: true,
  categorySnapshot: true,
  quantity: true,
  totalCostCents: true,
  purchasedAt: true,
} satisfies Prisma.StockPurchaseSelect

export function listStock(db: Database, userId: string) {
  return db.product.findMany({ where: { userId, active: true }, select: productSelection, orderBy: [{ category: 'asc' }, { name: 'asc' }] })
}

export async function adjustStock(db: PrismaClient, userId: string, productId: string, quantity: number) {
  return db.$transaction(async (tx) => {
    const changed = await tx.product.updateMany({ where: { id: productId, userId, active: true }, data: { stockQuantity: { increment: quantity } } })
    if (changed.count === 1) return { kind: 'adjusted' as const, product: await tx.product.findFirstOrThrow({ where: { id: productId, userId }, select: productSelection }) }
    return { kind: 'not-found' as const }
  })
}

export async function createPurchase(db: PrismaClient, userId: string, input: { productId: string; quantity: number; totalCostCents: number }) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: input.productId, userId, active: true }, select: { id: true, name: true, category: true } })
    if (!product) return { kind: 'product-not-found' as const }

    const changed = await tx.product.updateMany({ where: { id: product.id, userId, active: true, stockQuantity: { gte: input.quantity } }, data: { stockQuantity: { decrement: input.quantity } } })
    if (changed.count !== 1) return { kind: 'insufficient-stock' as const }

    const purchase = await tx.stockPurchase.create({ data: { userId, productId: product.id, productNameSnapshot: product.name, categorySnapshot: product.category, quantity: input.quantity, totalCostCents: input.totalCostCents }, select: purchaseSelection })
    return { kind: 'created' as const, purchase }
  })
}

export function listPurchases(db: Database, userId: string) {
  return db.stockPurchase.findMany({ where: { userId }, select: purchaseSelection, orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }] })
}