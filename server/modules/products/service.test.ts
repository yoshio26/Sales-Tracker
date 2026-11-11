import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  archiveProduct: vi.fn(),
  createProduct: vi.fn(),
  listProducts: vi.fn(),
  restoreArchivedProduct: vi.fn(),
  updateProduct: vi.fn(),
  cleanupImages: vi.fn().mockResolvedValue(undefined),
  permanentlyDeleteArchivedProduct: vi.fn(),
}))

vi.mock('./data-access.js', () => ({
  permanentlyDeleteArchivedProduct: mocks.permanentlyDeleteArchivedProduct,
  archiveProduct: mocks.archiveProduct,
  createProduct: mocks.createProduct,
  database: {},
  listProducts: mocks.listProducts,
  restoreArchivedProduct: mocks.restoreArchivedProduct,
  updateProduct: mocks.updateProduct,
}))
vi.mock('../../infrastructure/images.js', () => ({ cleanupImages: mocks.cleanupImages }))
vi.mock('../notifications/service.js', () => ({ notifyStock: vi.fn().mockResolvedValue(undefined) }))

import { archiveProduct, createProduct, listProducts, normalizeProductName, permanentlyDeleteArchivedProduct, restoreArchivedProduct, updateProduct } from './service.js'

describe('product catalog service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('removes a photo, checks the previous reference after saving, and keeps IDs internal', async () => {
    const previous = { name: 'widget', category: 'hardware', priceCents: 1000, imageUrl: 'https://res.cloudinary.com/test/old.png', imagePublicId: 'old' }
    const product = { ...previous, id: 'p', userId: 'user-a', imageUrl: null, imagePublicId: null, active: true, updatedAt: new Date() }
    mocks.updateProduct.mockResolvedValue({ kind: 'updated', previous, product })
    const result = await updateProduct('user-a', 'p', { name: 'widget', category: 'hardware', price: '10.00', updatedAt: product.updatedAt.toISOString(), removeImage: true })
    expect(mocks.updateProduct).toHaveBeenCalledWith({}, 'user-a', 'p', expect.objectContaining({ imageUrl: null, imagePublicId: null }))
    expect(mocks.cleanupImages).toHaveBeenCalledWith(['old'])
    expect(result).toMatchObject({ kind: 'updated', product: { imageUrl: null } })
    if ('product' in result) expect(result.product).not.toHaveProperty('imagePublicId')
  })

  it('preserves the current photo when details are saved without an uploaded replacement', async () => {
    const product = { id: 'p', name: 'widget', category: 'hardware', priceCents: 1000, imageUrl: 'https://res.cloudinary.com/test/old.png', imagePublicId: 'old', active: true, updatedAt: new Date() }
    mocks.updateProduct.mockResolvedValue({ kind: 'unchanged', product })
    const result = await updateProduct('user-a', 'p', { name: 'widget', category: 'hardware', price: '10.00', updatedAt: product.updatedAt.toISOString() })
    expect(mocks.updateProduct.mock.calls[0][3]).not.toHaveProperty('imageUrl')
    expect(result).toMatchObject({ product: { imageUrl: product.imageUrl } })
    if ('product' in result) expect(result.product).not.toHaveProperty('imagePublicId')
    expect(mocks.cleanupImages).not.toHaveBeenCalled()
  })

  it('cleans all permanent-delete candidates only after persistence succeeds', async () => {
    mocks.permanentlyDeleteArchivedProduct.mockResolvedValue({ kind: 'deleted', product: { name: 'widget', category: 'hardware' }, imageCandidates: ['current', 'historic'] })
    await permanentlyDeleteArchivedProduct('user-a', 'p')
    expect(mocks.cleanupImages).toHaveBeenCalledWith(['current', 'historic'])
    mocks.cleanupImages.mockClear()
    mocks.permanentlyDeleteArchivedProduct.mockRejectedValue(new Error('rollback'))
    await expect(permanentlyDeleteArchivedProduct('user-a', 'p')).rejects.toThrow('rollback')
    expect(mocks.cleanupImages).not.toHaveBeenCalled()
  })

  it('normalizes product names before persistence', async () => {
    mocks.createProduct.mockResolvedValue({ id: 'product-id', name: 'widget', category: 'hardware', active: true, archivedAt: null, updatedAt: new Date() })

    await createProduct('user-a', { name: '  WiDgEt  ', category: '  Hardware ' })

    expect(normalizeProductName('  WiDgEt  ')).toBe('widget')
    expect(mocks.createProduct).toHaveBeenCalledWith({}, 'user-a', { name: 'widget', category: 'hardware', priceCents: 0 })
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

  it('serializes a restored product response', async () => {
    const updatedAt = new Date('2026-09-30T12:00:00.000Z')
    mocks.restoreArchivedProduct.mockResolvedValue({ kind: 'restored', product: { id: 'product-id', name: 'widget', category: 'hardware', priceCents: 1250, stockQuantity: 3, active: true, archivedAt: null, deletedAt: null, updatedAt } })

    await expect(restoreArchivedProduct('user-a', 'product-id')).resolves.toEqual({ kind: 'restored', product: { imageUrl: null, id: 'product-id', name: 'widget', category: 'hardware', price: '12.50', originalPrice: null, stockQuantity: 3, active: true, archivedAt: null, deletedAt: null, updatedAt: updatedAt.toISOString() } })
    expect(mocks.restoreArchivedProduct).toHaveBeenCalledWith({}, 'user-a', 'product-id')
  })
})