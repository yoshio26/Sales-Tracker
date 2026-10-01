import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  archiveProduct: vi.fn(),
  createProduct: vi.fn(),
  listProducts: vi.fn(),
  updateProduct: vi.fn(),
}))

vi.mock('./data-access.js', () => ({
  archiveProduct: mocks.archiveProduct,
  createProduct: mocks.createProduct,
  database: {},
  listProducts: mocks.listProducts,
  updateProduct: mocks.updateProduct,
}))

import { archiveProduct, createProduct, listProducts, normalizeProductName, updateProduct } from './service.js'

describe('product catalog service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('normalizes product names before persistence', async () => {
    mocks.createProduct.mockResolvedValue({ id: 'product-id', name: 'widget', category: 'hardware', active: true, archivedAt: null, updatedAt: new Date() })

    await createProduct('user-a', { name: '  WiDgEt  ', category: '  Hardware ' })

    expect(normalizeProductName('  WiDgEt  ')).toBe('widget')
    expect(mocks.createProduct).toHaveBeenCalledWith({}, 'user-a', { name: 'widget', category: 'hardware' })
  })

  it('does not expose another user’s products', async () => {
    mocks.listProducts.mockResolvedValue([])

    await expect(listProducts('user-b', 'active')).resolves.toEqual([])

    expect(mocks.listProducts).toHaveBeenCalledWith({}, 'user-b', 'active')
  })

  it('maps a normalized-name collision to a conflict outcome', async () => {
    mocks.createProduct.mockRejectedValue({ code: 'P2002' })

    await expect(createProduct('user-a', { name: 'Widget', category: 'hardware' })).resolves.toEqual({ kind: 'duplicate' })
  })

  it('maps stale and missing updates without leaking a foreign product', async () => {
    mocks.updateProduct.mockResolvedValueOnce({ kind: 'stale' }).mockResolvedValueOnce({ kind: 'not-found' })

    await expect(updateProduct('user-a', 'product-id', { name: 'widget', category: 'hardware', updatedAt: '2026-09-30T12:00:00.000Z' })).resolves.toEqual({ kind: 'stale' })
    await expect(updateProduct('user-b', 'guessed-id', { name: 'widget', category: 'hardware', updatedAt: '2026-09-30T12:00:00.000Z' })).resolves.toEqual({ kind: 'not-found' })
    expect(mocks.updateProduct).toHaveBeenLastCalledWith({}, 'user-b', 'guessed-id', expect.any(Object))
  })

  it('archives with the supplied concurrency timestamp and never deletes', async () => {
    const updatedAt = '2026-09-30T12:00:00.000Z'
    mocks.archiveProduct.mockResolvedValue({ kind: 'updated', product: { id: 'product-id', name: 'widget', category: 'hardware', active: false, archivedAt: new Date(), updatedAt: new Date() } })

    await expect(archiveProduct('user-a', 'product-id', updatedAt)).resolves.toMatchObject({ kind: 'updated', product: { active: false } })

    expect(mocks.archiveProduct).toHaveBeenCalledWith({}, 'user-a', 'product-id', new Date(updatedAt))
  })
})