import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createExpense: vi.fn(),
  deleteExpense: vi.fn(),
  getExpense: vi.fn(),
  listExpenses: vi.fn(),
  updateExpense: vi.fn(),
}))

vi.mock('./data-access.js', () => ({
  createExpense: mocks.createExpense,
  database: {},
  deleteExpense: mocks.deleteExpense,
  getExpense: mocks.getExpense,
  listExpenses: mocks.listExpenses,
  updateExpense: mocks.updateExpense,
}))

import { createExpense, deleteExpense, listExpenses, parseAmount, updateExpense } from './service.js'

const record = {
  id: 'expense-id',
  productId: 'product-id',
  productNameSnapshot: 'widget',
  categorySnapshot: 'hardware',
  amountCents: 1250,
  quantity: 2,
  note: 'restock',
  spentAt: new Date('2026-10-01T00:00:00.000Z'),
  deletedAt: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
}

describe('expense service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('converts validated decimal strings to positive integer cents', () => {
    expect(parseAmount('12')).toBe(1200)
    expect(parseAmount('12.5')).toBe(1250)
    expect(() => parseAmount('0')).toThrow()
    expect(() => parseAmount('12.345')).toThrow()
  })

  it('passes the authenticated tenant and server-owned expense values to persistence', async () => {
    mocks.createExpense.mockResolvedValue({ kind: 'created', expense: record })

    await expect(createExpense('user-a', { productId: 'product-id', amount: '12.50', quantity: 2, note: ' restock ', spentAt: '2026-10-01T00:00:00.000Z' })).resolves.toMatchObject({
      kind: 'created',
      expense: { amount: '12.50', productName: 'widget', category: 'hardware' },
    })
    expect(mocks.createExpense).toHaveBeenCalledWith({}, 'user-a', expect.objectContaining({ amountCents: 1250, productId: 'product-id' }))
  })

  it('preserves snapshots when an edit does not select a product', async () => {
    mocks.updateExpense.mockResolvedValue({ kind: 'updated', expense: record })

    await updateExpense('user-a', 'expense-id', { amount: '13.00', quantity: 1, note: '', spentAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' })

    expect(mocks.updateExpense).toHaveBeenCalledWith({}, 'user-a', 'expense-id', expect.objectContaining({ amountCents: 1300, productId: undefined }))
  })

  it('maps missing products and stale updates without exposing records', async () => {
    mocks.updateExpense.mockResolvedValueOnce({ kind: 'product-not-found' }).mockResolvedValueOnce({ kind: 'stale' })

    await expect(updateExpense('user-a', 'expense-id', { productId: 'archived-id', amount: '1.00', quantity: 1, spentAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' })).resolves.toEqual({ kind: 'product-not-found' })
    await expect(updateExpense('user-a', 'expense-id', { amount: '1.00', quantity: 1, spentAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' })).resolves.toEqual({ kind: 'stale' })
  })

  it('scopes lists and delegates soft deletion as an update operation', async () => {
    mocks.listExpenses.mockResolvedValue([])
    mocks.deleteExpense.mockResolvedValue({ kind: 'deleted' })

    await expect(listExpenses('user-b', {})).resolves.toEqual([])
    await expect(deleteExpense('user-b', 'expense-id')).resolves.toEqual({ kind: 'deleted' })
    expect(mocks.listExpenses).toHaveBeenCalledWith({}, 'user-b', expect.any(Object))
    expect(mocks.deleteExpense).toHaveBeenCalledWith({}, 'user-b', 'expense-id')
  })
})
