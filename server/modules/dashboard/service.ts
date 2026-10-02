import { dashboardDatabase, getByCategory, getByProduct, getPurchaseSummary, getStockSummary, getTimeSeries, getTotal } from './data-access.js'

export type ReportingRange = { from: Date; to: Date }
export type DashboardFilters = Partial<ReportingRange>
export type DashboardPoint = { label: string; amount: string }
export type DashboardTrendPoint = { bucket: string; amount: string }

export type DashboardResponse = {
  currentMonth: { from: string; to: string; total: string; trend: DashboardTrendPoint[]; byProduct: DashboardPoint[]; byCategory: DashboardPoint[] }
  allTime: { total: string; trend: DashboardTrendPoint[]; byProduct: DashboardPoint[]; byCategory: DashboardPoint[] }
  stock: { totalUnits: number; productsInStock: number; productsOutOfStock: number }
  purchases: { count: number; quantity: number; totalCost: string }
  totalEarnings: string
  profit: string
}

export function currentUtcMonth(now = new Date()): ReportingRange {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { from, to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) }
}

function centsToMoney(value: bigint | number): string {
  const cents = typeof value === 'bigint' ? value : BigInt(value)
  const sign = cents < 0n ? '-' : ''
  const absolute = cents < 0n ? -cents : cents
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`
}

function mapTotals(rows: { label: string; totalCents: bigint | number }[]): DashboardPoint[] {
  return rows.map((row) => ({ label: row.label, amount: centsToMoney(row.totalCents) }))
}

function integerValue(value: bigint | number): number {
  return typeof value === 'bigint' ? Number(value) : value
}

async function reportForRange(userId: string, range: ReportingRange | undefined, granularity: 'day' | 'month') {
  const [totalRows, trendRows, productRows, categoryRows] = await Promise.all([
    getTotal(dashboardDatabase, userId, range),
    getTimeSeries(dashboardDatabase, userId, range, granularity),
    getByProduct(dashboardDatabase, userId, range),
    getByCategory(dashboardDatabase, userId, range),
  ])
  return {
    totalCents: totalRows[0]?.totalCents ?? 0,
    total: centsToMoney(totalRows[0]?.totalCents ?? 0),
    trend: trendRows.map((row) => ({ bucket: row.bucketUtc.toISOString(), amount: centsToMoney(row.totalCents) })),
    byProduct: mapTotals(productRows),
    byCategory: mapTotals(categoryRows),
  }
}

export async function getDashboard(userId: string, now = new Date(), filters: DashboardFilters = {}): Promise<DashboardResponse> {
  const month = filters.from && filters.to ? { from: filters.from, to: filters.to } : currentUtcMonth(now)
  const [currentMonth, allTimeReport, stockRows, purchaseRows] = await Promise.all([
    reportForRange(userId, month, 'day'),
    reportForRange(userId, undefined, 'month'),
    getStockSummary(dashboardDatabase, userId),
    getPurchaseSummary(dashboardDatabase, userId),
  ])
  const stock = stockRows[0] ?? { totalUnits: 0, productsInStock: 0, productsOutOfStock: 0 }
  const purchases = purchaseRows[0] ?? { purchaseCount: 0, totalQuantity: 0, totalCostCents: 0 }
  const totalEarningsCents = typeof purchases.totalCostCents === 'bigint' ? purchases.totalCostCents : BigInt(purchases.totalCostCents)
  const expenseTotalCents = typeof allTimeReport.totalCents === 'bigint' ? allTimeReport.totalCents : BigInt(allTimeReport.totalCents)
  return {
    currentMonth: { from: month.from.toISOString(), to: month.to.toISOString(), ...currentMonth },
    allTime: { total: allTimeReport.total, trend: allTimeReport.trend, byProduct: allTimeReport.byProduct, byCategory: allTimeReport.byCategory },
    stock: { totalUnits: integerValue(stock.totalUnits), productsInStock: integerValue(stock.productsInStock), productsOutOfStock: integerValue(stock.productsOutOfStock) },
    purchases: { count: integerValue(purchases.purchaseCount), quantity: integerValue(purchases.totalQuantity), totalCost: centsToMoney(purchases.totalCostCents) },
    totalEarnings: centsToMoney(totalEarningsCents),
    profit: centsToMoney(totalEarningsCents - expenseTotalCents),
  }
}
