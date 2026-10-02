import { describe, expect, it, vi } from 'vitest'
import { createExpense, deleteExpense, getExpense, listExpenses, updateExpense } from './data-access.js'

function database() {
  const tx = {
    expense: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    product: { findFirst: vi.fn() },
  }
  const db = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    expense: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  }
  return { db, tx }
}

const range = { from: new Date('2026-10-01T00:00:00.000Z'), to: new Date('2026-11-01T00:00:00.000Z') }

describe('expense data access', () => {
  it('scopes lists and reads to the tenant and excludes deleted rows', async () => {
    const { db } = database()
    await listExpenses(db as never, 'user-a', { ...range, productId: 'product-a' })
    expect(db.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', deletedAt: null, productId: 'product-a', spentAt: { gte: range.from, lt: range.to } } }))

    db.expense.findFirst.mockResolvedValue(null)
    await expect(getExpense(db as never, 'user-a', 'foreign-expense')).resolves.toBeNull()
    expect(db.expense.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign-expense', userId: 'user-a', deletedAt: null } }))
  })

  it('creates an expense using the active product snapshot from the same tenant', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware' })
    tx.expense.create.mockResolvedValue({ id: 'expense-a', productId: 'product-a', productNameSnapshot: 'Widget', categorySnapshot: 'Hardware' })

    await expect(createExpense(db as never, 'user-a', {
      productId: 'product-a', amountCents: 1250, quantity: 2, note: 'note', spentAt: range.from,
    })).resolves.toEqual({ kind: 'created', expense: expect.objectContaining({ id: 'expense-a' }) })
    expect(tx.product.findFirst).toHaveBeenCalledWith({ where: { id: 'product-a', userId: 'user-a', active: true, deletedAt: null }, select: { id: true, name: true, category: true } })
    expect(tx.expense.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-a', productId: 'product-a', productNameSnapshot: 'Widget', categorySnapshot: 'Hardware' }) }))
  })

  it('rejects a product owned by another tenant during creation', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue(null)

    await expect(createExpense(db as never, 'user-a', {
      productId: 'foreign-product', amountCents: 1250, quantity: 1, spentAt: range.from,
    })).resolves.toEqual({ kind: 'product-not-found' })
    expect(tx.expense.create).not.toHaveBeenCalled()
  })

  it('preserves snapshot history when changing to another owned product', async () => {
    const { db, tx } = database()
    const updatedAt = new Date('2026-10-01T00:00:00.000Z')
    tx.expense.findFirst.mockResolvedValue({ updatedAt, productId: 'product-a' })
    tx.product.findFirst.mockResolvedValue({ id: 'product-b', name: 'New widget', category: 'Software' })
    tx.expense.updateMany.mockResolvedValue({ count: 1 })
    tx.expense.findUniqueOrThrow.mockResolvedValue({ id: 'expense-a', productId: 'product-b', productNameSnapshot: 'New widget', categorySnapshot: 'Software' })

    await expect(updateExpense(db as never, 'user-a', 'expense-a', {
      productId: 'product-b', amountCents: 2000, quantity: 1, spentAt: range.from, updatedAt,
    })).resolves.toEqual({ kind: 'updated', expense: expect.objectContaining({ productId: 'product-b', productNameSnapshot: 'New widget' }) })
    expect(tx.expense.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'expense-a', userId: 'user-a', deletedAt: null, updatedAt }, data: expect.objectContaining({ productId: 'product-b', productNameSnapshot: 'New widget', categorySnapshot: 'Software' }) }))
  })

  it('rejects stale updates before mutation and keeps soft-delete tenant-scoped', async () => {
    const stale = database()
    stale.tx.expense.findFirst.mockResolvedValue({ updatedAt: new Date('2026-10-01T00:00:01.000Z'), productId: 'product-a' })
    await expect(updateExpense(stale.db as never, 'user-a', 'expense-a', {
      amountCents: 2000, quantity: 1, spentAt: range.from, updatedAt: range.from,
    })).resolves.toEqual({ kind: 'stale' })
    expect(stale.tx.expense.updateMany).not.toHaveBeenCalled()

    const deleted = database()
    deleted.db.expense.updateMany.mockResolvedValue({ count: 0 })
    deleted.db.expense.findFirst.mockResolvedValue(null)
    await expect(deleteExpense(deleted.db as never, 'user-a', 'foreign-expense')).resolves.toEqual({ kind: 'not-found' })
    expect(deleted.db.expense.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign-expense', userId: 'user-a', deletedAt: null } }))
  })

  it('writes deletion and update timestamps together for an owned expense', async () => {
    const { db } = database()
    db.expense.updateMany.mockResolvedValue({ count: 1 })

    await expect(deleteExpense(db as never, 'user-a', 'expense-a')).resolves.toEqual({ kind: 'deleted' })
    const call = db.expense.updateMany.mock.calls[0][0]
    expect(call.data.deletedAt).toBeInstanceOf(Date)
    expect(call.data.updatedAt).toBe(call.data.deletedAt)
  })

  it('reports a stale update when the conditional write loses a race', async () => {
    const { db, tx } = database()
    const updatedAt = new Date('2026-10-01T00:00:00.000Z')
    tx.expense.findFirst.mockResolvedValue({ updatedAt, productId: 'product-a' })
    tx.expense.updateMany.mockResolvedValue({ count: 0 })

    await expect(updateExpense(db as never, 'user-a', 'expense-a', {
      amountCents: 2000, quantity: 1, spentAt: range.from, updatedAt,
    })).resolves.toEqual({ kind: 'stale' })
    expect(tx.expense.findUniqueOrThrow).not.toHaveBeenCalled()
  })

  it('distinguishes an existing soft-deleted expense from an unknown expense', async () => {
    const { db } = database()
    db.expense.updateMany.mockResolvedValue({ count: 0 })
    db.expense.findFirst.mockResolvedValue({ deletedAt: new Date('2026-10-01T00:00:00.000Z') })

    await expect(deleteExpense(db as never, 'user-a', 'expense-a')).resolves.toEqual({ kind: 'already-deleted' })
  })
})
