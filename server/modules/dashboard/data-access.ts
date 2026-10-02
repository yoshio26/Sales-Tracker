import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '../../infrastructure/prisma.js'

export type DashboardDatabase = PrismaClient | Prisma.TransactionClient

export const dashboardDatabase = prisma

export type MoneyTotalRow = { totalCents: bigint | number }
export type ProductTotalRow = { label: string; totalCents: bigint | number }
export type CategoryTotalRow = { label: string; totalCents: bigint | number }
export type TimeSeriesRow = { bucketUtc: Date; totalCents: bigint | number }
export type StockSummaryRow = { totalUnits: bigint | number; productsInStock: bigint | number; productsOutOfStock: bigint | number }
export type PurchaseSummaryRow = { purchaseCount: bigint | number; totalQuantity: bigint | number; totalCostCents: bigint | number }

export function getStockSummary(db: DashboardDatabase, userId: string) {
  return db.$queryRaw<StockSummaryRow[]>(Prisma.sql`
    SELECT COALESCE(SUM(stock_quantity), 0)::bigint AS "totalUnits",
           COUNT(*) FILTER (WHERE stock_quantity > 0)::bigint AS "productsInStock",
           COUNT(*) FILTER (WHERE stock_quantity = 0)::bigint AS "productsOutOfStock"
    FROM products
    WHERE user_id = ${userId}::uuid AND active = true AND deleted_at IS NULL
  `)
}

export function getPurchaseSummary(db: DashboardDatabase, userId: string) {
  return db.$queryRaw<PurchaseSummaryRow[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "purchaseCount",
           COALESCE(SUM(quantity), 0)::bigint AS "totalQuantity",
           COALESCE(SUM(total_cost_cents), 0)::bigint AS "totalCostCents"
    FROM stock_purchases
    WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
  `)
}

export function getTotal(db: DashboardDatabase, userId: string, range?: { from: Date; to: Date }) {
  return db.$queryRaw<MoneyTotalRow[]>(Prisma.sql`
    SELECT COALESCE(SUM(amount_cents), 0)::bigint AS "totalCents"
    FROM expenses
    WHERE user_id = ${userId}::uuid
      AND deleted_at IS NULL
      ${range ? Prisma.sql`AND spent_at >= ${range.from} AND spent_at < ${range.to}` : Prisma.empty}
  `)
}

export function getByProduct(db: DashboardDatabase, userId: string, range?: { from: Date; to: Date }) {
  return db.$queryRaw<ProductTotalRow[]>(Prisma.sql`
    SELECT product_name_snapshot AS label, COALESCE(SUM(amount_cents), 0)::bigint AS "totalCents"
    FROM expenses
    WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
      ${range ? Prisma.sql`AND spent_at >= ${range.from} AND spent_at < ${range.to}` : Prisma.empty}
    GROUP BY product_name_snapshot
    ORDER BY "totalCents" DESC, label ASC
  `)
}

export function getByCategory(db: DashboardDatabase, userId: string, range?: { from: Date; to: Date }) {
  return db.$queryRaw<CategoryTotalRow[]>(Prisma.sql`
    SELECT category_snapshot AS label, COALESCE(SUM(amount_cents), 0)::bigint AS "totalCents"
    FROM expenses
    WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
      ${range ? Prisma.sql`AND spent_at >= ${range.from} AND spent_at < ${range.to}` : Prisma.empty}
    GROUP BY category_snapshot
    ORDER BY "totalCents" DESC, label ASC
  `)
}

export function getTimeSeries(db: DashboardDatabase, userId: string, range: { from: Date; to: Date } | undefined, granularity: 'day' | 'month') {
  const bucket = granularity === 'day' ? 'day' : 'month'
  return db.$queryRaw<TimeSeriesRow[]>(Prisma.sql`
    SELECT date_trunc(${bucket}, spent_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS "bucketUtc",
           COALESCE(SUM(amount_cents), 0)::bigint AS "totalCents"
    FROM expenses
    WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
      ${range ? Prisma.sql`AND spent_at >= ${range.from} AND spent_at < ${range.to}` : Prisma.empty}
    GROUP BY "bucketUtc"
    ORDER BY "bucketUtc" ASC
  `)
}