import { describe, expect, it, vi } from 'vitest'
import { adjustStock, createPurchase, createPurchases, deletePurchase, deleteStockData, getReportData, listPurchases, listStock, purgeExpiredDeletedStockData, setStockQuantity } from './data-access.js'
const images = vi.hoisted(() => ({ cleanupImages: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../infrastructure/images.js', () => images)

function database() {
  const tx = {
    product: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    stockPurchase: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    expense: { create: vi.fn(), count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  }
  const db = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    product: { ...tx.product, findMany: vi.fn() },
    stockPurchase: { ...tx.stockPurchase, findMany: vi.fn() },
    expense: tx.expense,
  }
  return { db, tx }
}

describe('stock data access', () => {
  it.each([false, true])('captures immutable photo snapshots in single/checkout flow (checkout=%s)', async (checkout) => {
    const { db, tx } = database()
    const product = { id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 625, stockQuantity: 5, imageUrl: 'https://res.cloudinary.com/test/old.png', imagePublicId: 'old-photo' }
    tx.product.findFirst.mockResolvedValue(product)
    tx.product.updateMany.mockResolvedValue({ count: 1 })
    tx.stockPurchase.create.mockImplementation(async ({ data }) => ({ ...data, id: 'purchase-a' }))
    const input = { productId: 'product-a', quantity: 2 }
    if (checkout) await createPurchases(db as never, 'user-a', [input])
    else await createPurchase(db as never, 'user-a', input)
    product.imageUrl = 'https://res.cloudinary.com/test/replaced.png'
    product.imagePublicId = 'replacement'
    expect(tx.stockPurchase.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ imageUrl: 'https://res.cloudinary.com/test/old.png', imagePublicId: 'old-photo' }), select: expect.objectContaining({ imageUrl: true }) }))
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ imagePublicId: 'old-photo' }) }))
  })

  it('collects purchase and product candidates before purge and cleans after commit', async () => {
    images.cleanupImages.mockClear()
    const { db, tx } = database()
    tx.stockPurchase.findMany.mockResolvedValue([{ imagePublicId: 'history-photo' }])
    tx.product.findMany.mockResolvedValue([{ imagePublicId: 'product-photo' }])
    tx.expense.deleteMany.mockResolvedValue({ count: 0 })
    tx.stockPurchase.deleteMany.mockResolvedValue({ count: 1 })
    tx.product.deleteMany.mockResolvedValue({ count: 1 })
    let committed = false
    db.$transaction.mockImplementation(async (callback) => {
      const result = await callback(tx)
      expect(images.cleanupImages).not.toHaveBeenCalled()
      committed = true
      return result
    })
    images.cleanupImages.mockImplementationOnce(async () => { expect(committed).toBe(true) })
    await purgeExpiredDeletedStockData(db as never)
    expect(images.cleanupImages).toHaveBeenCalledWith(['history-photo', 'product-photo'])
    expect(tx.stockPurchase.findMany.mock.invocationCallOrder[0]).toBeLessThan(tx.stockPurchase.deleteMany.mock.invocationCallOrder[0])
  })

  it('cleans the deleted tenant purchase snapshot after commit and never on rollback', async () => {
    images.cleanupImages.mockClear()
    const { db, tx } = database()
    tx.stockPurchase.findFirst.mockResolvedValue({ imagePublicId: 'history-photo' })
    tx.stockPurchase.deleteMany.mockResolvedValue({ count: 1 })
    await deletePurchase(db as never, 'user-a', 'purchase-a')
    expect(images.cleanupImages).toHaveBeenCalledWith(['history-photo'])
    images.cleanupImages.mockClear()
    tx.stockPurchase.deleteMany.mockRejectedValue(new Error('rollback'))
    await expect(deletePurchase(db as never, 'user-a', 'purchase-a')).rejects.toThrow('rollback')
    expect(images.cleanupImages).not.toHaveBeenCalled()
  })
  it('lists only active stock and tenant-owned purchase history', async () => {
    const { db } = database()

    await listStock(db as never, 'user-a')
    await listPurchases(db as never, 'user-a')

    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', active: true, deletedAt: null } }))
    expect(db.stockPurchase.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', deletedAt: null }, orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }] }))
  })

  it('loads only active products and non-deleted tenant purchases for reports', async () => {
    const { db } = database()

    await getReportData(db as never, 'user-a')

    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', active: true, deletedAt: null } }))
    expect(db.stockPurchase.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', deletedAt: null } }))
  })

  it('decrements stock and creates one snapshot purchase in the same transaction', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 625 })
    tx.product.updateMany.mockResolvedValue({ count: 1 })
    tx.stockPurchase.create.mockResolvedValue({ id: 'purchase-a' })

    await expect(createPurchase(db as never, 'user-a', { productId: 'product-a', quantity: 2 })).resolves.toEqual({ kind: 'created', purchase: { id: 'purchase-a' } })
    expect(db.$transaction).toHaveBeenCalledOnce()
    expect(tx.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'product-a', userId: 'user-a', active: true, deletedAt: null } }))
    expect(tx.product.updateMany).toHaveBeenCalledWith({ where: { id: 'product-a', userId: 'user-a', active: true, deletedAt: null, imagePublicId: null, stockQuantity: { gte: 2 } }, data: { stockQuantity: { decrement: 2 } } })
    expect(tx.stockPurchase.create).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: 'user-a', productId: 'product-a', productNameSnapshot: 'Widget', categorySnapshot: 'Hardware', quantity: 2, totalCostCents: 1250 } }))
  })

  it('does not create history when the conditional stock decrement loses the race', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 625 })
    tx.product.updateMany.mockResolvedValue({ count: 0 })

    await expect(createPurchase(db as never, 'user-a', { productId: 'product-a', quantity: 2 })).resolves.toEqual({ kind: 'insufficient-stock' })
    expect(tx.stockPurchase.create).not.toHaveBeenCalled()
  })

  it('deducts the supplied original cost for each replenished unit when requested', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 10_000 })
    tx.product.updateMany.mockResolvedValue({ count: 1 })
    tx.product.findFirstOrThrow.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 10_000, stockQuantity: 4, updatedAt: new Date() })

    await expect(adjustStock(db as never, 'user-a', 'product-a', 4, true, 2_500)).resolves.toMatchObject({ kind: 'adjusted' })
    expect(tx.expense.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amountCents: 10_000, quantity: 4, note: 'Restock deduction' }) })
  })

  it('deducts only the increase when setting a higher exact quantity', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 1_000, stockQuantity: 4 })
    tx.product.updateMany.mockResolvedValue({ count: 1 })
    tx.product.findFirstOrThrow.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 1_000, stockQuantity: 7, updatedAt: new Date() })

    await expect(setStockQuantity(db as never, 'user-a', 'product-a', 7, true, 750)).resolves.toMatchObject({ kind: 'updated' })
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ stockQuantity: 4 }), data: { stockQuantity: 7, originalPriceCents: 750 } }))
    expect(tx.expense.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amountCents: 2_250, quantity: 3, note: 'Quantity increase deduction' }) })
  })

  it('does not create a deduction when replenishment is explicitly not deducted', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 10_000 })
    tx.product.updateMany.mockResolvedValue({ count: 1 })
    tx.product.findFirstOrThrow.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 10_000, stockQuantity: 4, updatedAt: new Date() })

    await expect(adjustStock(db as never, 'user-a', 'product-a', 4, false)).resolves.toMatchObject({ kind: 'adjusted' })
    expect(tx.expense.create).not.toHaveBeenCalled()
  })

  it('rejects missing and oversized stored prices before changing stock', async () => {
    const missingPrice = database()
    missingPrice.tx.product.findFirst.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 0 })
    await expect(createPurchase(missingPrice.db as never, 'user-a', { productId: 'product-a', quantity: 1 })).resolves.toEqual({ kind: 'product-price-missing' })
    expect(missingPrice.tx.product.updateMany).not.toHaveBeenCalled()

    const oversized = database()
    oversized.tx.product.findFirst.mockResolvedValue({ id: 'product-a', name: 'Widget', category: 'Hardware', priceCents: 2_147_483_647 })
    await expect(createPurchase(oversized.db as never, 'user-a', { productId: 'product-a', quantity: 2 })).resolves.toEqual({ kind: 'purchase-total-too-large' })
    expect(oversized.tx.product.updateMany).not.toHaveBeenCalled()
  })

  it('does not mutate a foreign or archived product', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue(null)

    await expect(createPurchase(db as never, 'user-a', { productId: 'foreign-product', quantity: 1 })).resolves.toEqual({ kind: 'product-not-found' })
    expect(tx.product.updateMany).not.toHaveBeenCalled()
    expect(tx.stockPurchase.create).not.toHaveBeenCalled()
  })

  it('soft-deletes referenced and unreferenced tenant stock data atomically', async () => {
    const { db, tx } = database()
    tx.product.updateMany.mockResolvedValue({ count: 2 })
    tx.expense.deleteMany.mockResolvedValue({ count: 0 })
    tx.stockPurchase.deleteMany.mockResolvedValue({ count: 0 })
    tx.product.deleteMany.mockResolvedValue({ count: 0 })

    await expect(deleteStockData(db as never, 'user-a')).resolves.toEqual({ kind: 'deleted', count: 2 })
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', deletedAt: null }, data: expect.objectContaining({ active: false, deletedAt: expect.any(Date) }) }))
    expect(tx.expense.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', deletedAt: null }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }))
    expect(tx.stockPurchase.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', deletedAt: null }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }))
  })

  it('rolls back the deletion transaction when a dependent update fails', async () => {
    const { db, tx } = database()
    tx.expense.deleteMany.mockResolvedValue({ count: 0 })
    tx.stockPurchase.deleteMany.mockResolvedValue({ count: 0 })
    tx.product.deleteMany.mockResolvedValue({ count: 0 })
    tx.product.updateMany.mockResolvedValue({ count: 2 })
    tx.expense.updateMany.mockRejectedValue(new Error('database failure'))

    await expect(deleteStockData(db as never, 'user-a')).rejects.toThrow('database failure')
    expect(tx.stockPurchase.updateMany).not.toHaveBeenCalled()
  })

  it('purges only expired deleted records for the requested tenant', async () => {
    const { db } = database()
    db.product.deleteMany.mockResolvedValue({ count: 1 })
    db.expense.deleteMany.mockResolvedValue({ count: 2 })
    db.stockPurchase.deleteMany.mockResolvedValue({ count: 3 })

    await expect(purgeExpiredDeletedStockData(db as never, 'user-a', new Date('2026-10-20T00:00:00.000Z'))).resolves.toEqual({ products: 1, expenses: 2, purchases: 3 })
    expect(db.product.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-a', deletedAt: { not: null, lt: new Date('2026-10-10T00:00:00.000Z') }, expenses: { none: {} }, stockPurchases: { none: {} } } })
  })

  it('purges expired deleted records across tenants for scheduled cleanup', async () => {
    const { db } = database()
    db.product.deleteMany.mockResolvedValue({ count: 1 })
    db.expense.deleteMany.mockResolvedValue({ count: 2 })
    db.stockPurchase.deleteMany.mockResolvedValue({ count: 3 })

    await purgeExpiredDeletedStockData(db as never, undefined, new Date('2026-10-20T00:00:00.000Z'))

    expect(db.expense.deleteMany).toHaveBeenCalledWith({ where: { deletedAt: { not: null, lt: new Date('2026-10-10T00:00:00.000Z') } } })
    expect(db.stockPurchase.deleteMany).toHaveBeenCalledWith({ where: { deletedAt: { not: null, lt: new Date('2026-10-10T00:00:00.000Z') } } })
    expect(db.product.deleteMany).toHaveBeenCalledWith({ where: { deletedAt: { not: null, lt: new Date('2026-10-10T00:00:00.000Z') }, expenses: { none: {} }, stockPurchases: { none: {} } } })
  })

  it('deletes purchase history only for the authenticated tenant', async () => {
    const { db } = database()
    db.stockPurchase.deleteMany.mockResolvedValue({ count: 1 })

    await deletePurchase(db as never, 'user-a', 'purchase-a')
    expect(db.stockPurchase.deleteMany).toHaveBeenCalledWith({ where: { id: 'purchase-a', userId: 'user-a', deletedAt: null } })
  })
})