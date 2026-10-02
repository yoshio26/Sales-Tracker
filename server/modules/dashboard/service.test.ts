import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getByCategory: vi.fn(),
  getByProduct: vi.fn(),
  getPurchaseSummary: vi.fn(),
  getStockSummary: vi.fn(),
  getTimeSeries: vi.fn(),
  getTotal: vi.fn(),
}))

vi.mock('./data-access.js', () => ({ ...mocks, dashboardDatabase: {} }))

import { currentUtcMonth, getDashboard } from './service.js'

describe('dashboard service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getTotal.mockResolvedValue([{ totalCents: 0n }])
    mocks.getByProduct.mockResolvedValue([])
    mocks.getByCategory.mockResolvedValue([])
    mocks.getPurchaseSummary.mockResolvedValue([{ purchaseCount: 0n, totalQuantity: 0n, totalCostCents: 0n }])
    mocks.getStockSummary.mockResolvedValue([{ totalUnits: 0n, productsInStock: 0n, productsOutOfStock: 0n }])
    mocks.getTimeSeries.mockResolvedValue([])
  })

  it('creates a half-open UTC month range', () => {
    expect(currentUtcMonth(new Date('2026-10-31T23:59:59.000Z'))).toEqual({
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-11-01T00:00:00.000Z'),
    })
  })

  it('returns zero totals and empty aggregates for an empty ledger', async () => {
    const dashboard = await getDashboard('user-a', new Date('2026-10-01T12:00:00.000Z'))
    expect(dashboard).toMatchObject({
      currentMonth: { total: '0.00', trend: [], byProduct: [], byCategory: [] },
      allTime: { total: '0.00', trend: [], byProduct: [], byCategory: [] },
      stock: { totalUnits: 0, productsInStock: 0, productsOutOfStock: 0 },
      purchases: { count: 0, quantity: 0, totalCost: '0.00' },
    })
    expect(dashboard).not.toHaveProperty('currentMonth.totalCents')
    expect(mocks.getTotal).toHaveBeenCalledWith({}, 'user-a', expect.objectContaining({ from: new Date('2026-10-01T00:00:00.000Z') }))
    expect(mocks.getByProduct).toHaveBeenCalledWith({}, 'user-a', expect.objectContaining({ to: new Date('2026-11-01T00:00:00.000Z') }))
    expect(mocks.getTimeSeries).toHaveBeenCalledWith({}, 'user-a', expect.objectContaining({ from: new Date('2026-10-01T00:00:00.000Z') }), 'day')
    expect(mocks.getTimeSeries).toHaveBeenCalledWith({}, 'user-a', undefined, 'month')
  })

  it('maps snapshot aggregate values as decimal strings', async () => {
    mocks.getTotal.mockResolvedValueOnce([{ totalCents: 1250n }]).mockResolvedValueOnce([{ totalCents: 987n }])
    mocks.getByProduct.mockResolvedValueOnce([{ label: 'Archived Widget', totalCents: 1250n }])
    mocks.getByCategory.mockResolvedValueOnce([]).mockResolvedValueOnce([{ label: 'Old category', totalCents: 987n }])
    mocks.getStockSummary.mockResolvedValue([{ totalUnits: 5n, productsInStock: 1n, productsOutOfStock: 2n }])
    mocks.getPurchaseSummary.mockResolvedValue([{ purchaseCount: 2n, totalQuantity: 3n, totalCostCents: 4567n }])
    mocks.getTimeSeries.mockResolvedValueOnce([{ bucketUtc: new Date('2026-10-02T00:00:00.000Z'), totalCents: 1250n }])

    await expect(getDashboard('user-a', new Date('2026-10-03T12:00:00.000Z'))).resolves.toMatchObject({
      currentMonth: { total: '12.50', byProduct: [{ label: 'Archived Widget', amount: '12.50' }], trend: [{ bucket: '2026-10-02T00:00:00.000Z', amount: '12.50' }] },
      allTime: { total: '9.87', byCategory: [{ label: 'Old category', amount: '9.87' }] },
      stock: { totalUnits: 5, productsInStock: 1, productsOutOfStock: 2 },
      purchases: { count: 2, quantity: 3, totalCost: '45.67' },
    })
  })
})