import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../../infrastructure/prisma.js'

export type Database = PrismaClient | Prisma.TransactionClient
export const database = prisma

const expenseSelection = {
  id: true,
  productId: true,
  productNameSnapshot: true,
  categorySnapshot: true,
  amountCents: true,
  quantity: true,
  note: true,
  spentAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ExpenseSelect

export type ExpenseRecord = Prisma.ExpenseGetPayload<{ select: typeof expenseSelection }>

type ExpenseFilters = { from?: Date; to?: Date; productId?: string }

export function listExpenses(db: Database, userId: string, filters: ExpenseFilters) {
  return db.expense.findMany({
    where: { userId, deletedAt: null, productId: filters.productId, spentAt: { gte: filters.from, lt: filters.to } },
    select: expenseSelection,
    orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }],
  })
}

export function getExpense(db: Database, userId: string, id: string) {
  return db.expense.findFirst({ where: { id, userId, deletedAt: null }, select: expenseSelection })
}

export async function createExpense(db: PrismaClient, userId: string, input: { productId: string; amountCents: number; quantity: number; note?: string; spentAt: Date }) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: input.productId, userId, active: true, deletedAt: null }, select: { id: true, name: true, category: true } })
    if (!product) return { kind: 'product-not-found' as const }
    const expense = await tx.expense.create({
      data: { userId, productId: product.id, productNameSnapshot: product.name, categorySnapshot: product.category, amountCents: input.amountCents, quantity: input.quantity, note: input.note, spentAt: input.spentAt },
      select: expenseSelection,
    })
    return { kind: 'created' as const, expense }
  })
}

export async function updateExpense(db: PrismaClient, userId: string, id: string, input: { productId?: string; amountCents: number; quantity: number; note?: string; spentAt: Date; updatedAt: Date }) {
  return db.$transaction(async (tx) => {
    const current = await tx.expense.findFirst({ where: { id, userId, deletedAt: null }, select: { updatedAt: true, productId: true } })
    if (!current) return { kind: 'not-found' as const }
    if (current.updatedAt.getTime() !== input.updatedAt.getTime()) return { kind: 'stale' as const }

    let snapshot: { productId: string; productNameSnapshot: string; categorySnapshot: string } | undefined
    if (input.productId && input.productId !== current.productId) {
      const product = await tx.product.findFirst({ where: { id: input.productId, userId, active: true, deletedAt: null }, select: { id: true, name: true, category: true } })
      if (!product) return { kind: 'product-not-found' as const }
      snapshot = { productId: product.id, productNameSnapshot: product.name, categorySnapshot: product.category }
    }

    const updatedAt = new Date(Math.max(Date.now(), input.updatedAt.getTime() + 1))
    const changed = await tx.expense.updateMany({
      where: { id, userId, deletedAt: null, updatedAt: input.updatedAt },
      data: { amountCents: input.amountCents, quantity: input.quantity, note: input.note, spentAt: input.spentAt, updatedAt, ...snapshot },
    })
    if (changed.count !== 1) return { kind: 'stale' as const }
    return { kind: 'updated' as const, expense: await tx.expense.findUniqueOrThrow({ where: { id }, select: expenseSelection }) }
  })
}

export async function deleteExpense(db: PrismaClient, userId: string, id: string) {
  const deletedAt = new Date()
  const changed = await db.expense.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt, updatedAt: deletedAt } })
  if (changed.count === 1) return { kind: 'deleted' as const }
  const existing = await db.expense.findFirst({ where: { id, userId }, select: { deletedAt: true } })
  return existing ? { kind: 'already-deleted' as const } : { kind: 'not-found' as const }
}