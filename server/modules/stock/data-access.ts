import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../../infrastructure/prisma.js'

export type Database = PrismaClient | Prisma.TransactionClient
export const database = prisma

const productSelection = {
  id: true,
  name: true,
  category: true,
  priceCents: true,
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

export async function createPurchase(db: PrismaClient, userId: string, input: { productId: string; quantity: number }) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: input.productId, userId, active: true }, select: { id: true, name: true, category: true, priceCents: true } })
    if (!product) return { kind: 'product-not-found' as const }
    if ((product.priceCents ?? 0) <= 0) return { kind: 'product-price-missing' as const }
    const totalCostCents = product.priceCents * input.quantity
    if (!Number.isSafeInteger(totalCostCents) || totalCostCents > 2_147_483_647) return { kind: 'purchase-total-too-large' as const }

    const changed = await tx.product.updateMany({ where: { id: product.id, userId, active: true, stockQuantity: { gte: input.quantity } }, data: { stockQuantity: { decrement: input.quantity } } })
    if (changed.count !== 1) return { kind: 'insufficient-stock' as const }

    const purchase = await tx.stockPurchase.create({ data: { userId, productId: product.id, productNameSnapshot: product.name, categorySnapshot: product.category, quantity: input.quantity, totalCostCents }, select: purchaseSelection })
    return { kind: 'created' as const, purchase }
  })
}

export function listPurchases(db: Database, userId: string) {
  return db.stockPurchase.findMany({ where: { userId }, select: purchaseSelection, orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }] })
}

export async function deleteStockData(db: PrismaClient, userId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const [expenseReferences, purchaseReferences] = await Promise.all([
        tx.expense.count({ where: { userId } }),
        tx.stockPurchase.count({ where: { userId } }),
      ])
      if (expenseReferences > 0 || purchaseReferences > 0) return { kind: 'referenced' as const }

      const deleted = await tx.product.deleteMany({ where: { userId } })
      return { kind: 'deleted' as const, count: deleted.count }
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003') return { kind: 'referenced' as const }
    throw error
  }
}

export function deletePurchase(db: Database, userId: string, purchaseId: string) {
  return db.stockPurchase.deleteMany({ where: { id: purchaseId, userId } })
}