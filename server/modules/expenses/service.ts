import type { Expense } from '@prisma/client'
import { createExpense as createExpenseRecord, database, deleteExpense as deleteExpenseRecord, getExpense as getExpenseRecord, listExpenses as listExpenseRecords, updateExpense as updateExpenseRecord } from './data-access.js'

export type ExpenseResponse = {
  id: string
  productId: string
  productName: string
  category: string
  amount: string
  quantity: number
  note: string | null
  spentAt: string
  createdAt: string
  updatedAt: string
}

function amountToString(amountCents: number): string {
  return (amountCents / 100).toFixed(2)
}

function toResponse(expense: Pick<Expense, 'id' | 'productId' | 'productNameSnapshot' | 'categorySnapshot' | 'amountCents' | 'quantity' | 'note' | 'spentAt' | 'createdAt' | 'updatedAt'>): ExpenseResponse {
  return { id: expense.id, productId: expense.productId, productName: expense.productNameSnapshot, category: expense.categorySnapshot, amount: amountToString(expense.amountCents), quantity: expense.quantity, note: expense.note, spentAt: expense.spentAt.toISOString(), createdAt: expense.createdAt.toISOString(), updatedAt: expense.updatedAt.toISOString() }
}

export function parseAmount(value: string): number {
  const normalized = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Invalid amount')
  const [whole, fraction = ''] = normalized.split('.')
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`)
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 2147483647) throw new Error('Invalid amount')
  return cents
}

export async function listExpenses(userId: string, filters: { from?: string; to?: string; productId?: string }) {
  return (await listExpenseRecords(database, userId, { from: filters.from ? new Date(filters.from) : undefined, to: filters.to ? new Date(filters.to) : undefined, productId: filters.productId })).map(toResponse)
}

export async function getExpense(userId: string, id: string) {
  const expense = await getExpenseRecord(database, userId, id)
  return expense ? toResponse(expense) : null
}

export async function createExpense(userId: string, input: { productId: string; amount: string; quantity: number; note?: string; spentAt: string }) {
  const outcome = await createExpenseRecord(database, userId, { productId: input.productId, amountCents: parseAmount(input.amount), quantity: input.quantity, note: input.note, spentAt: new Date(input.spentAt) })
  return outcome.kind === 'created' ? { kind: outcome.kind, expense: toResponse(outcome.expense) } : outcome
}

export async function updateExpense(userId: string, id: string, input: { productId?: string; amount: string; quantity: number; note?: string; spentAt: string; updatedAt: string }) {
  const outcome = await updateExpenseRecord(database, userId, id, { productId: input.productId, amountCents: parseAmount(input.amount), quantity: input.quantity, note: input.note, spentAt: new Date(input.spentAt), updatedAt: new Date(input.updatedAt) })
  return outcome.kind === 'updated' ? { kind: outcome.kind, expense: toResponse(outcome.expense) } : outcome
}

export async function deleteExpense(userId: string, id: string) {
  return deleteExpenseRecord(database, userId, id)
}