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
  return db.product.findMany({ where: { userId, active: true, deletedAt: null }, select: productSelection, orderBy: [{ category: 'asc' }, { name: 'asc' }] })
}

export async function adjustStock(db: PrismaClient, userId: string, productId: string, quantity: number, deductEarnings = false) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, userId, active: true, deletedAt: null }, select: { id: true, name: true, category: true, priceCents: true } })
    if (!product) return { kind: 'not-found' as const }
    if (deductEarnings && (!product.priceCents || product.priceCents <= 0)) return { kind: 'product-price-missing' as const }
    if (deductEarnings && !Number.isSafeInteger(product.priceCents * quantity)) return { kind: 'deduction-too-large' as const }
    const changed = await tx.product.updateMany({ where: { id: productId, userId, active: true, deletedAt: null }, data: { stockQuantity: { increment: quantity } } })
    if (changed.count === 1) {
      if (deductEarnings) {
        await tx.expense.create({ data: { userId, productId, productNameSnapshot: product.name, categorySnapshot: product.category, amountCents: product.priceCents!, quantity, note: 'Restock deduction', spentAt: new Date() } })
      }
      return { kind: 'adjusted' as const, product: await tx.product.findFirstOrThrow({ where: { id: productId, userId, active: true, deletedAt: null }, select: productSelection }) }
    }
    return { kind: 'not-found' as const }
  })
}

export async function createPurchase(db: PrismaClient, userId: string, input: { productId: string; quantity: number }) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: input.productId, userId, active: true, deletedAt: null }, select: { id: true, name: true, category: true, priceCents: true } })
    if (!product) return { kind: 'product-not-found' as const }
    if ((product.priceCents ?? 0) <= 0) return { kind: 'product-price-missing' as const }
    const totalCostCents = product.priceCents * input.quantity
    if (!Number.isSafeInteger(totalCostCents) || totalCostCents > 2_147_483_647) return { kind: 'purchase-total-too-large' as const }

    const changed = await tx.product.updateMany({ where: { id: product.id, userId, active: true, deletedAt: null, stockQuantity: { gte: input.quantity } }, data: { stockQuantity: { decrement: input.quantity } } })
    if (changed.count !== 1) return { kind: 'insufficient-stock' as const }

    const purchase = await tx.stockPurchase.create({ data: { userId, productId: product.id, productNameSnapshot: product.name, categorySnapshot: product.category, quantity: input.quantity, totalCostCents }, select: purchaseSelection })
    return { kind: 'created' as const, purchase }
  })
}

export function listPurchases(db: Database, userId: string) {
  return db.stockPurchase.findMany({ where: { userId, deletedAt: null }, select: purchaseSelection, orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }] })
}

const RETENTION_MS = 10 * 24 * 60 * 60 * 1000

export async function purgeExpiredDeletedStockData(db: Database, userId?: string, now = new Date()) {
  const expiresBefore = new Date(now.getTime() - RETENTION_MS)
  const where = { ...(userId ? { userId } : {}), deletedAt: { not: null, lt: expiresBefore } }
  const expenses = await db.expense.deleteMany({ where })
  const purchases = await db.stockPurchase.deleteMany({ where })
  const products = await db.product.deleteMany({ where: { ...where, expenses: { none: {} }, stockPurchases: { none: {} } } })
  return { expenses: expenses.count, purchases: purchases.count, products: products.count }
}

export async function deleteStockData(db: PrismaClient, userId: string) {
  return db.$transaction(async (tx) => {
    await purgeExpiredDeletedStockData(tx, userId)
    const deletedAt = new Date()
    const products = await tx.product.updateMany({ where: { userId, deletedAt: null }, data: { active: false, deletedAt, updatedAt: deletedAt } })
    await tx.expense.updateMany({ where: { userId, deletedAt: null }, data: { deletedAt, updatedAt: deletedAt } })
    await tx.stockPurchase.updateMany({ where: { userId, deletedAt: null }, data: { deletedAt } })
    return { kind: 'deleted' as const, count: products.count }
  })
}

export function deletePurchase(db: Database, userId: string, purchaseId: string) {
  return db.stockPurchase.deleteMany({ where: { id: purchaseId, userId, deletedAt: null } })
}