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

export const purchaseSelection = {
  id: true,
  productId: true,
  productNameSnapshot: true,
  categorySnapshot: true,
  quantity: true,
  totalCostCents: true,
  purchasedAt: true,
} satisfies Prisma.StockPurchaseSelect

const reportProductSelection = {
  id: true,
  name: true,
  priceCents: true,
  stockQuantity: true,
} satisfies Prisma.ProductSelect

const reportPurchaseSelection = {
  productId: true,
  productNameSnapshot: true,
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

export function getReportData(db: Database, userId: string) {
  return Promise.all([
    db.product.findMany({ where: { userId, active: true, deletedAt: null }, select: reportProductSelection, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    db.stockPurchase.findMany({ where: { userId, deletedAt: null }, select: reportPurchaseSelection, orderBy: [{ purchasedAt: 'asc' }, { productNameSnapshot: 'asc' }] }),
  ]).then(([products, purchases]) => ({ products, purchases }))
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

export async function createPurchases(db: PrismaClient, userId: string, inputs: Array<{ productId: string; quantity: number }>) {
  try {
    return await db.$transaction(async (tx) => {
      const products = await Promise.all(inputs.map((input) => tx.product.findFirst({ where: { id: input.productId, userId, active: true, deletedAt: null }, select: { id: true, name: true, category: true, priceCents: true, stockQuantity: true } })))
      if (products.some((product) => !product)) return { kind: 'product-not-found' as const }
      const validProducts = products as Array<NonNullable<(typeof products)[number]>>
      if (validProducts.some((product) => (product.priceCents ?? 0) <= 0)) return { kind: 'product-price-missing' as const }
      if (validProducts.some((product, index) => product.stockQuantity < inputs[index]!.quantity)) return { kind: 'insufficient-stock' as const }
      const totals = validProducts.map((product, index) => product.priceCents! * inputs[index]!.quantity)
      if (totals.some((total) => !Number.isSafeInteger(total) || total > 2_147_483_647) || totals.reduce((sum, total) => sum + total, 0) > 2_147_483_647) return { kind: 'purchase-total-too-large' as const }
      const purchases = []
      for (const [index, product] of validProducts.entries()) {
        const input = inputs[index]!
        const changed = await tx.product.updateMany({ where: { id: product.id, userId, active: true, deletedAt: null, stockQuantity: { gte: input.quantity } }, data: { stockQuantity: { decrement: input.quantity } } })
        if (changed.count !== 1) throw new Error('insufficient-stock')
        purchases.push(await tx.stockPurchase.create({ data: { userId, productId: product.id, productNameSnapshot: product.name, categorySnapshot: product.category, quantity: input.quantity, totalCostCents: product.priceCents! * input.quantity }, select: purchaseSelection }))
      }
      return { kind: 'created' as const, purchases }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'insufficient-stock') return { kind: 'insufficient-stock' as const }
    throw error
  }
}

export async function setStockQuantity(db: PrismaClient, userId: string, productId: string, quantity: number, deductEarnings = false) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, userId, active: true, deletedAt: null }, select: { id: true, name: true, category: true, priceCents: true, stockQuantity: true } })
    if (!product) return { kind: 'not-found' as const }
    const increase = quantity - product.stockQuantity
    if (deductEarnings && increase > 0 && (!product.priceCents || product.priceCents <= 0)) return { kind: 'product-price-missing' as const }
    if (deductEarnings && increase > 0 && (!Number.isSafeInteger(product.priceCents! * increase) || product.priceCents! * increase > 2_147_483_647)) return { kind: 'deduction-too-large' as const }
    const changed = await tx.product.updateMany({ where: { id: productId, userId, active: true, deletedAt: null, stockQuantity: product.stockQuantity }, data: { stockQuantity: quantity } })
    if (changed.count !== 1) return { kind: 'conflict' as const }
    if (deductEarnings && increase > 0) {
      await tx.expense.create({ data: { userId, productId, productNameSnapshot: product.name, categorySnapshot: product.category, amountCents: product.priceCents!, quantity: increase, note: 'Quantity increase deduction', spentAt: new Date() } })
    }
    return { kind: 'updated' as const, product: await tx.product.findFirstOrThrow({ where: { id: productId, userId, active: true, deletedAt: null }, select: productSelection }) }
  })
}