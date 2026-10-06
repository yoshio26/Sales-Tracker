import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  adjustStock: vi.fn(),
  createPurchase: vi.fn(),
  deletePurchase: vi.fn(),
  deleteStockData: vi.fn(),
  getReportData: vi.fn(),
  listPurchases: vi.fn(),
  listStock: vi.fn(),
}))

vi.mock('./data-access.js', () => ({ ...mocks, database: {} }))

import { createPurchase, deletePurchase, deleteStockData, exportPurchasesCsv, exportStockCsv, listPurchases, listStock, monthRange, parseCost, replenishStock } from './service.js'

const product = { id: 'product-id', name: 'widget', category: 'hardware', priceCents: 625, stockQuantity: 4, updatedAt: new Date('2026-10-02T00:00:00.000Z') }
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

    await expect(listStock('user-a')).resolves.toEqual([{ id: 'product-id', name: 'widget', category: 'hardware', price: '6.25', stockQuantity: 4, updatedAt: '2026-10-02T00:00:00.000Z' }])
    await expect(listPurchases('user-a')).resolves.toEqual([{ id: 'purchase-id', productId: 'product-id', productName: 'widget', category: 'hardware', quantity: 2, totalCost: '12.50', purchasedAt: '2026-10-02T00:00:00.000Z' }])
    expect(mocks.listStock).toHaveBeenCalledWith({}, 'user-a')
    expect(mocks.listPurchases).toHaveBeenCalledWith({}, 'user-a')
  })

  it('passes replenishment and purchase input without accepting a client owner', async () => {
    mocks.adjustStock.mockResolvedValue({ kind: 'adjusted', product })
    mocks.createPurchase.mockResolvedValue({ kind: 'created', purchase })

    await expect(replenishStock('user-a', 'product-id', 3)).resolves.toMatchObject({ kind: 'adjusted', product: { stockQuantity: 4 } })
    await expect(createPurchase('user-a', { productId: 'product-id', quantity: 2 })).resolves.toMatchObject({ kind: 'created', purchase: { totalCost: '12.50' } })
    expect(mocks.adjustStock).toHaveBeenCalledWith({}, 'user-a', 'product-id', 3, false)
    expect(mocks.createPurchase).toHaveBeenCalledWith({}, 'user-a', { productId: 'product-id', quantity: 2 })
  })

  it('preserves safe insufficient-stock and missing-product outcomes', async () => {
    mocks.createPurchase.mockResolvedValueOnce({ kind: 'insufficient-stock' }).mockResolvedValueOnce({ kind: 'product-not-found' })
    await expect(createPurchase('user-a', { productId: 'product-id', quantity: 99 })).resolves.toEqual({ kind: 'insufficient-stock' })
    await expect(createPurchase('user-a', { productId: 'other-id', quantity: 1 })).resolves.toEqual({ kind: 'product-not-found' })
  })

  it('keeps deletion operations tenant-scoped', async () => {
    mocks.deleteStockData.mockResolvedValue({ kind: 'deleted', count: 1 })
    mocks.deletePurchase.mockResolvedValue({ count: 1 })

    await expect(deleteStockData('user-a')).resolves.toEqual({ kind: 'deleted', count: 1 })
    await expect(deletePurchase('user-a', 'purchase-id')).resolves.toEqual({ kind: 'deleted' })
    expect(mocks.deleteStockData).toHaveBeenCalledWith({}, 'user-a')
    expect(mocks.deletePurchase).toHaveBeenCalledWith({}, 'user-a', 'purchase-id')
  })

  it('exports only purchases in the selected UTC month and escapes CSV values', async () => {
    mocks.getReportData.mockResolvedValue({ products: [], purchases: [
      { productId: 'product-id', productNameSnapshot: 'Widget, "Large"', quantity: 2, totalCostCents: 1250, purchasedAt: new Date('2026-10-02T00:00:00.000Z') },
      { productId: 'product-id', productNameSnapshot: 'Outside', quantity: 1, totalCostCents: 500, purchasedAt: new Date('2026-11-01T00:00:00.000Z') },
    ] })

    await expect(exportPurchasesCsv('user-a', monthRange('2026-10'))).resolves.toBe('Stock Name,Date Bought,Cost\r\n"Widget, ""Large""",2026-10-02T00:00:00.000Z,12.50\r\n')
  })

  it('keeps the purchase export to headers when the selected month is empty', async () => {
    mocks.getReportData.mockResolvedValue({ products: [], purchases: [{ productId: 'product-id', productNameSnapshot: 'Outside', quantity: 1, totalCostCents: 500, purchasedAt: new Date('2026-11-01T00:00:00.000Z') }] })

    await expect(exportPurchasesCsv('user-a', monthRange('2026-10'))).resolves.toBe('Stock Name,Date Bought,Cost\r\n')
  })

  it('exports active stock with all-time sold totals and zero for never-sold products', async () => {
    mocks.getReportData.mockResolvedValue({
      products: [
        { id: 'product-id', name: 'Widget', priceCents: 625, stockQuantity: 4 },
        { id: 'other-id', name: 'Never sold', priceCents: 1000, stockQuantity: 2 },
      ],
      purchases: [{ productId: 'product-id', productNameSnapshot: 'Widget', quantity: 3, totalCostCents: 1875, purchasedAt: new Date('2026-10-02T00:00:00.000Z') }],
    })

    await expect(exportStockCsv('user-a')).resolves.toBe('Stock Name,Remaining Stocks,Updated Price,Sold\r\nWidget,4,6.25,3\r\nNever sold,2,10.00,0\r\n')
  })
})