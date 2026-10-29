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

export function getAdjustment(db: Database, userId: string) {
  return db.profitAdjustment.findFirst({ where: { userId, deletedAt: null }, select: adjustmentSelection, orderBy: { updatedAt: 'desc' } })
}

export async function saveAdjustment(db: PrismaClient, userId: string, input: { amountCents: number; note?: string; updatedAt?: Date }) {
  return db.$transaction(async (tx) => {
    const current = await tx.profitAdjustment.findFirst({ where: { userId, deletedAt: null }, select: { id: true, updatedAt: true } })
    if (input.updatedAt && (!current || current.updatedAt.getTime() !== input.updatedAt.getTime())) return { kind: current ? 'stale' as const : 'not-found' as const }
    if (current) {
      const updatedAt = new Date(Math.max(Date.now(), input.updatedAt?.getTime() ?? 0, current.updatedAt.getTime() + 1))
      const changed = await tx.profitAdjustment.updateMany({ where: { id: current.id, userId, deletedAt: null, updatedAt: current.updatedAt }, data: { amountCents: input.amountCents, note: input.note, updatedAt } })
      if (changed.count !== 1) return { kind: 'stale' as const }
      return { kind: 'saved' as const, adjustment: await tx.profitAdjustment.findUniqueOrThrow({ where: { id: current.id }, select: adjustmentSelection }) }
    }
    return { kind: 'saved' as const, adjustment: await tx.profitAdjustment.create({ data: { userId, amountCents: input.amountCents, note: input.note }, select: adjustmentSelection }) }
  })
}

export async function deleteAdjustment(db: PrismaClient, userId: string) {
  const deletedAt = new Date()
  const changed = await db.profitAdjustment.updateMany({ where: { userId, deletedAt: null }, data: { deletedAt, updatedAt: deletedAt } })
  return changed.count === 1 ? { kind: 'deleted' as const } : { kind: 'not-found' as const }
}
