import { describe, expect, it, vi } from 'vitest'
import { archiveProduct, createProduct, listProducts, updateProduct } from './data-access.js'

function database() {
  const tx = {
    product: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
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

    await expect(createProduct(db as never, 'user-a', { name: 'Widget', category: 'Hardware' })).resolves.toEqual(expect.objectContaining({ id: 'product-id', userId: 'user-a' }))
    expect(db.product.create).toHaveBeenCalledWith({ data: { userId: 'user-a', name: 'Widget', category: 'Hardware' } })
  })

  it('scopes active and archived lists to the requested tenant', async () => {
    const { db } = database()

    await listProducts(db as never, 'user-a', 'active')
    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a', active: true } }))

    await listProducts(db as never, 'user-a', 'archived')
    expect(db.product.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: 'user-a', active: false } }))
  })

  it('does not update a product owned by another tenant', async () => {
    const { db, tx } = database()
    tx.product.updateMany.mockResolvedValue({ count: 0 })
    tx.product.findFirst.mockResolvedValue(null)

    await expect(updateProduct(db as never, 'user-a', 'foreign-product', {
      name: 'changed', category: 'hardware', updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    })).resolves.toEqual({ kind: 'not-found' })
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'foreign-product', userId: 'user-a', active: true }) }))
  })

  it('returns stale and archived outcomes without exposing product data', async () => {
    const stale = database()
    stale.tx.product.updateMany.mockResolvedValue({ count: 0 })
    stale.tx.product.findFirst.mockResolvedValue({ active: true })
    await expect(updateProduct(stale.db as never, 'user-a', 'product-id', {
      name: 'changed', category: 'hardware', updatedAt: new Date('2026-10-01T00:00:00.000Z'),
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
})
