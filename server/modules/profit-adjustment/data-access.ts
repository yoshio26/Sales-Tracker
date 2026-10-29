import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../../infrastructure/prisma.js'

export type Database = PrismaClient | Prisma.TransactionClient
export const database = prisma

const adjustmentSelection = {
  id: true,
  amountCents: true,
  note: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProfitAdjustmentSelect

export type ProfitAdjustmentRecord = Prisma.ProfitAdjustmentGetPayload<{ select: typeof adjustmentSelection }>

export function listAdjustments(db: Database, userId: string) {
  return db.profitAdjustment.findMany({ where: { userId, deletedAt: null }, select: adjustmentSelection, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
}

export function createAdjustment(db: PrismaClient, userId: string, input: { amountCents: number; note?: string }) {
  return db.profitAdjustment.create({ data: { userId, amountCents: input.amountCents, note: input.note }, select: adjustmentSelection })
}

export async function deleteAdjustment(db: PrismaClient, userId: string, id: string) {
  const deletedAt = new Date()
  const changed = await db.profitAdjustment.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt, updatedAt: deletedAt } })
  return changed.count === 1 ? { kind: 'deleted' as const } : { kind: 'not-found' as const }
}
