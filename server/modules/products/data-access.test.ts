import { describe, expect, it, vi } from 'vitest'
import { archiveProduct, createProduct, listProducts, permanentlyDeleteArchivedProduct, restoreArchivedProduct, updateProduct } from './data-access.js'

function database() {
  const tx = {
    expense: { deleteMany: vi.fn(), updateMany: vi.fn() },
    product: {
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    stockPurchase: { deleteMany: vi.fn(), updateMany: vi.fn() },
  }
  const db = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    product: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  }
  return { db, tx }
}

describe('product data access', () => {
  it('creates a product for the requested tenant', async () => {
    const { db } = database()
    db.product.create.mockResolvedValue({ id: 'product-id', userId: 'user-a', name: 'Widget', category: 'Hardware' })

    await expect(createProduct(db as never, 'user-a', { name: 'Widget', category: 'Hardware', priceCents: 1000 })).resolves.toEqual(expect.objectContaining({ id: 'product-id', userId: 'user-a' }))
    expect(db.product.create).toHaveBeenCalledWith({ data: { userId: 'user-a', name: 'Widget', category: 'Hardware', priceCents: 1000 } })
  })

  it('scopes active and archived lists to the requested tenant', async () => {
    const { db } = database()

    await listProducts(db as never, 'user-a', 'active')
    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', active: true, deletedAt: null } }))

    await listProducts(db as never, 'user-a', 'archived')
    expect(db.product.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: 'user-a', active: false } }))
  })

  it('does not update a product owned by another tenant', async () => {
    const { db, tx } = database()
    tx.product.updateMany.mockResolvedValue({ count: 0 })
    tx.product.findFirst.mockResolvedValue(null)

    await expect(updateProduct(db as never, 'user-a', 'foreign-product', {
      name: 'changed', category: 'hardware', priceCents: 1000, updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    })).resolves.toEqual({ kind: 'not-found' })
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'foreign-product', userId: 'user-a', active: true }) }))
  })

  it('returns stale and archived outcomes without exposing product data', async () => {
    const stale = database()
    stale.tx.product.updateMany.mockResolvedValue({ count: 0 })
    stale.tx.product.findFirst.mockResolvedValue({ active: true })
    await expect(updateProduct(stale.db as never, 'user-a', 'product-id', {
      name: 'changed', category: 'hardware', priceCents: 1000, updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    })).resolves.toEqual({ kind: 'stale' })

    const archived = database()
    archived.tx.product.updateMany.mockResolvedValue({ count: 0 })
    archived.tx.product.findFirst.mockResolvedValue({ active: false })
    await expect(archiveProduct(archived.db as never, 'user-a', 'product-id', new Date('2026-10-01T00:00:00.000Z'))).resolves.toEqual({ kind: 'archived' })
  })

  it('archives only an active product in the same tenant', async () => {
    const { db, tx } = database()
    tx.product.updateMany.mockResolvedValue({ count: 1 })
    tx.product.findUniqueOrThrow.mockResolvedValue({ id: 'product-id', active: false })

    await expect(archiveProduct(db as never, 'user-a', 'product-id', new Date('2026-10-01T00:00:00.000Z'))).resolves.toEqual({ kind: 'updated', product: { id: 'product-id', active: false } })
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'product-id', userId: 'user-a', active: true }) }))
  })

  it('permanently deletes an archived product and its dependent history in one transaction', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValueOnce({ id: 'product-id' })
    tx.product.delete.mockResolvedValue({ id: 'product-id' })

    await expect(permanentlyDeleteArchivedProduct(db as never, 'user-a', 'product-id')).resolves.toEqual({ kind: 'deleted' })
    expect(tx.expense.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-a', productId: 'product-id' } })
    expect(tx.stockPurchase.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-a', productId: 'product-id' } })
    expect(tx.product.delete).toHaveBeenCalledWith({ where: { id: 'product-id' } })
  })

  it('restores a retained product and its soft-deleted history atomically', async () => {
    const { db, tx } = database()
    tx.product.findFirst.mockResolvedValue({ id: 'product-id' })
    tx.product.update.mockResolvedValue({ id: 'product-id', active: true, archivedAt: null, deletedAt: null })
    tx.expense.updateMany.mockResolvedValue({ count: 1 })
    tx.stockPurchase.updateMany.mockResolvedValue({ count: 1 })

    await expect(restoreArchivedProduct(db as never, 'user-a', 'product-id')).resolves.toEqual({ kind: 'restored', product: expect.objectContaining({ id: 'product-id', active: true }) })
    expect(tx.expense.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', productId: 'product-id', deletedAt: { not: null } } }))
    expect(tx.stockPurchase.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', productId: 'product-id', deletedAt: { not: null } } }))
  })
})
