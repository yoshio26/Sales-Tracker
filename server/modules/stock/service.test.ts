import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  adjustStock: vi.fn(),
  createPurchase: vi.fn(),
  listPurchases: vi.fn(),
  listStock: vi.fn(),
}))

vi.mock('./data-access.js', () => ({ ...mocks, database: {} }))

import { createPurchase, listPurchases, listStock, parseCost, replenishStock } from './service.js'

const product = { id: 'product-id', name: 'widget', category: 'hardware', stockQuantity: 4, updatedAt: new Date('2026-10-02T00:00:00.000Z') }
const purchase = { id: 'purchase-id', productId: 'product-id', productNameSnapshot: 'widget', categorySnapshot: 'hardware', quantity: 2, totalCostCents: 1250, purchasedAt: new Date('2026-10-02T00:00:00.000Z') }

describe('stock service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses positive decimal purchase costs into integer cents', () => {
    expect(parseCost('12.5')).toBe(1250)
    expect(() => parseCost('0')).toThrow()
    expect(() => parseCost('12.345')).toThrow()
  })

  it('maps tenant-scoped stock and purchase records', async () => {
    mocks.listStock.mockResolvedValue([product])
    mocks.listPurchases.mockResolvedValue([purchase])

    await expect(listStock('user-a')).resolves.toEqual([{ id: 'product-id', name: 'widget', category: 'hardware', stockQuantity: 4, updatedAt: '2026-10-02T00:00:00.000Z' }])
    await expect(listPurchases('user-a')).resolves.toEqual([{ id: 'purchase-id', productId: 'product-id', productName: 'widget', category: 'hardware', quantity: 2, totalCost: '12.50', purchasedAt: '2026-10-02T00:00:00.000Z' }])
    expect(mocks.listStock).toHaveBeenCalledWith({}, 'user-a')
    expect(mocks.listPurchases).toHaveBeenCalledWith({}, 'user-a')
  })

  it('passes replenishment and purchase input without accepting a client owner', async () => {
    mocks.adjustStock.mockResolvedValue({ kind: 'adjusted', product })
    mocks.createPurchase.mockResolvedValue({ kind: 'created', purchase })

    await expect(replenishStock('user-a', 'product-id', 3)).resolves.toMatchObject({ kind: 'adjusted', product: { stockQuantity: 4 } })
    await expect(createPurchase('user-a', { productId: 'product-id', quantity: 2, totalCost: '12.50' })).resolves.toMatchObject({ kind: 'created', purchase: { totalCost: '12.50' } })
    expect(mocks.adjustStock).toHaveBeenCalledWith({}, 'user-a', 'product-id', 3)
    expect(mocks.createPurchase).toHaveBeenCalledWith({}, 'user-a', { productId: 'product-id', quantity: 2, totalCostCents: 1250 })
  })

  it('preserves safe insufficient-stock and missing-product outcomes', async () => {
    mocks.createPurchase.mockResolvedValueOnce({ kind: 'insufficient-stock' }).mockResolvedValueOnce({ kind: 'product-not-found' })
    await expect(createPurchase('user-a', { productId: 'product-id', quantity: 99, totalCost: '1.00' })).resolves.toEqual({ kind: 'insufficient-stock' })
    await expect(createPurchase('user-a', { productId: 'other-id', quantity: 1, totalCost: '1.00' })).resolves.toEqual({ kind: 'product-not-found' })
  })
})