import { dashboardDatabase, getByCategory, getByProduct, getTimeSeries, getTotal } from './data-access.js'

export type ReportingRange = { from: Date; to: Date }
export type DashboardFilters = Partial<ReportingRange>
export type DashboardPoint = { label: string; amount: string }
export type DashboardTrendPoint = { bucket: string; amount: string }

export type DashboardResponse = {
  currentMonth: { from: string; to: string; total: string; trend: DashboardTrendPoint[]; byProduct: DashboardPoint[]; byCategory: DashboardPoint[] }
  allTime: { total: string; trend: DashboardTrendPoint[]; byProduct: DashboardPoint[]; byCategory: DashboardPoint[] }
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

async function reportForRange(userId: string, range: ReportingRange | undefined, granularity: 'day' | 'month') {
  const [totalRows, trendRows, productRows, categoryRows] = await Promise.all([
    getTotal(dashboardDatabase, userId, range),
    getTimeSeries(dashboardDatabase, userId, range, granularity),
    getByProduct(dashboardDatabase, userId, range),
    getByCategory(dashboardDatabase, userId, range),
  ])
  return {
    total: centsToMoney(totalRows[0]?.totalCents ?? 0),
    trend: trendRows.map((row) => ({ bucket: row.bucketUtc.toISOString(), amount: centsToMoney(row.totalCents) })),
    byProduct: mapTotals(productRows),
    byCategory: mapTotals(categoryRows),
  }
}

export async function getDashboard(userId: string, now = new Date(), filters: DashboardFilters = {}): Promise<DashboardResponse> {
  const month = filters.from && filters.to ? { from: filters.from, to: filters.to } : currentUtcMonth(now)
  const [currentMonth, allTime] = await Promise.all([
    reportForRange(userId, month, 'day'),
    reportForRange(userId, undefined, 'month'),
  ])
  return { currentMonth: { from: month.from.toISOString(), to: month.to.toISOString(), ...currentMonth }, allTime }
}
