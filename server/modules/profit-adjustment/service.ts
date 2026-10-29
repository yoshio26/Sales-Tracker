import type { ProfitAdjustment } from '@prisma/client'
import { database, deleteAdjustment as deleteAdjustmentRecord, getAdjustment as getAdjustmentRecord, saveAdjustment as saveAdjustmentRecord } from './data-access.js'

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

export async function getAdjustment(userId: string) {
  const adjustment = await getAdjustmentRecord(database, userId)
  return adjustment ? toResponse(adjustment) : null
}

export async function saveAdjustment(userId: string, input: { amount: string; operation: 'add' | 'deduct'; note?: string; updatedAt?: string }) {
  const amountCents = parseAmount(input.amount) * (input.operation === 'deduct' ? -1 : 1)
  const outcome = await saveAdjustmentRecord(database, userId, { amountCents, note: input.note, updatedAt: input.updatedAt ? new Date(input.updatedAt) : undefined })
  return outcome.kind === 'saved' ? { kind: outcome.kind, adjustment: toResponse(outcome.adjustment) } : outcome
}

export async function deleteAdjustment(userId: string) {
  return deleteAdjustmentRecord(database, userId)
}
