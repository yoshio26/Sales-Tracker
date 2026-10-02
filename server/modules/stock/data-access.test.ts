import { describe, expect, it, vi } from 'vitest'
import { createPurchase, listPurchases, listStock } from './data-access.js'

function database() {
  const tx = {
    product: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    stockPurchase: { create: vi.fn() },
  }
  const db = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    product: { findMany: vi.fn() },
    stockPurchase: { findMany: vi.fn() },
  }
  return { db, tx }
}

describe('stock data access', () => {
  it('lists only active stock and tenant-owned purchase history', async () => {
    const { db } = database()

    await listStock(db as never, 'user-a')
    await listPurchases(db as never, 'user-a')

    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', active: true } }))
    expect(db.stockPurchase.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a' }, orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }] }))
  })

  it('decrements stock and creates one snapshot purchase in the same transaction', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware' })
    tx.product.updateMany.mockResolvedValue({ count: 1 })
    tx.stockPurchase.create.mockResolvedValue({ id: 'purchase-a' })

    await expect(createPurchase(db as never, 'user-a', { productId: 'product-a', quantity: 2, totalCostCents: 1250 })).resolves.toEqual({ kind: 'created', purchase: { id: 'purchase-a' } })
    expect(db.$transaction).toHaveBeenCalledOnce()
    expect(tx.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'product-a', userId: 'user-a', active: true } }))
    expect(tx.product.updateMany).toHaveBeenCalledWith({ where: { id: 'product-a', userId: 'user-a', active: true, stockQuantity: { gte: 2 } }, data: { stockQuantity: { decrement: 2 } } })
    expect(tx.stockPurchase.create).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: 'user-a', productId: 'product-a', productNameSnapshot: 'Widget', categorySnapshot: 'Hardware', quantity: 2, totalCostCents: 1250 } }))
  })

  it('does not create history when the conditional stock decrement loses the race', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware' })
    tx.product.updateMany.mockResolvedValue({ count: 0 })

    await expect(createPurchase(db as never, 'user-a', { productId: 'product-a', quantity: 2, totalCostCents: 1250 })).resolves.toEqual({ kind: 'insufficient-stock' })
    expect(tx.stockPurchase.create).not.toHaveBeenCalled()
  })

  it('does not mutate a foreign or archived product', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue(null)

    await expect(createPurchase(db as never, 'user-a', { productId: 'foreign-product', quantity: 1, totalCostCents: 100 })).resolves.toEqual({ kind: 'product-not-found' })
    expect(tx.product.updateMany).not.toHaveBeenCalled()
    expect(tx.stockPurchase.create).not.toHaveBeenCalled()
  })
})