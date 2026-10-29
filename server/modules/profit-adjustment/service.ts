import type { ProfitAdjustment } from '@prisma/client'
import { createAdjustment as createAdjustmentRecord, database, deleteAdjustment as deleteAdjustmentRecord, listAdjustments as listAdjustmentRecords } from './data-access.js'

export type ProfitAdjustmentResponse = { id: string; amount: string; note: string | null; createdAt: string; updatedAt: string }

function amountToString(amountCents: number): string {
  return (amountCents / 100).toFixed(2)
}

function toResponse(adjustment: Pick<ProfitAdjustment, 'id' | 'amountCents' | 'note' | 'createdAt' | 'updatedAt'>): ProfitAdjustmentResponse {
  return { id: adjustment.id, amount: amountToString(adjustment.amountCents), note: adjustment.note, createdAt: adjustment.createdAt.toISOString(), updatedAt: adjustment.updatedAt.toISOString() }
}

export function parseAmount(value: string): number {
  const normalized = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Invalid amount')
  const [whole, fraction = ''] = normalized.split('.')
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`)
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 2147483647) throw new Error('Invalid amount')
  return cents
}

export async function listAdjustments(userId: string) {
  return (await listAdjustmentRecords(database, userId)).map(toResponse)
}

export async function createAdjustment(userId: string, input: { amount: string; operation: 'add' | 'deduct'; note?: string }) {
  const amountCents = parseAmount(input.amount) * (input.operation === 'deduct' ? -1 : 1)
  return toResponse(await createAdjustmentRecord(database, userId, { amountCents, note: input.note }))
}

export async function deleteAdjustment(userId: string, id: string) {
  return deleteAdjustmentRecord(database, userId, id)
}
