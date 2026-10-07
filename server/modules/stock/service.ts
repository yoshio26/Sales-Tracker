import type { Product, StockPurchase } from '@prisma/client'
import { adjustStock as adjustStockRecord, createPurchase as createPurchaseRecord, createPurchases as createPurchasesRecord, database, deletePurchase as deletePurchaseRecord, deleteStockData as deleteStockDataRecord, getReportData, listPurchases as listPurchaseRecords, listStock as listStockRecords, setStockQuantity as setStockQuantityRecord } from './data-access.js'

export type StockProductResponse = { id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }
export type PurchaseResponse = { id: string; productId: string; productName: string; category: string; quantity: number; totalCost: string; purchasedAt: string }
export type ReportRange = { from: Date; to: Date }

function centsToMoney(cents: number): string {
  return (cents / 100).toFixed(2)
}

function toProductResponse(product: Pick<Product, 'id' | 'name' | 'category' | 'priceCents' | 'stockQuantity' | 'updatedAt'>): StockProductResponse {
  return { id: product.id, name: product.name, category: product.category, price: ((product.priceCents ?? 0) / 100).toFixed(2), stockQuantity: product.stockQuantity, updatedAt: product.updatedAt.toISOString() }
}

function toPurchaseResponse(purchase: Pick<StockPurchase, 'id' | 'productId' | 'productNameSnapshot' | 'categorySnapshot' | 'quantity' | 'totalCostCents' | 'purchasedAt'>): PurchaseResponse {
  return { id: purchase.id, productId: purchase.productId, productName: purchase.productNameSnapshot, category: purchase.categorySnapshot, quantity: purchase.quantity, totalCost: centsToMoney(purchase.totalCostCents), purchasedAt: purchase.purchasedAt.toISOString() }
}

export function parseCost(value: string): number {
  const normalized = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Invalid cost')
  const [whole, fraction = ''] = normalized.split('.')
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`)
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 2147483647) throw new Error('Invalid cost')
  return cents
}

export async function listStock(userId: string) {
  return (await listStockRecords(database, userId)).map(toProductResponse)
}

export async function replenishStock(userId: string, productId: string, quantity: number, deductEarnings = false) {
  const outcome = await adjustStockRecord(database, userId, productId, quantity, deductEarnings)
  return outcome.kind === 'adjusted' ? { kind: outcome.kind, product: toProductResponse(outcome.product) } : outcome
}

export async function createPurchase(userId: string, input: { productId: string; quantity: number }) {
  const outcome = await createPurchaseRecord(database, userId, input)
  return outcome.kind === 'created' ? { kind: outcome.kind, purchase: toPurchaseResponse(outcome.purchase) } : outcome
}

export async function listPurchases(userId: string) {
  return (await listPurchaseRecords(database, userId)).map(toPurchaseResponse)
}

export function deleteStockData(userId: string) {
  return deleteStockDataRecord(database, userId)
}

export async function deletePurchase(userId: string, purchaseId: string) {
  const deleted = await deletePurchaseRecord(database, userId, purchaseId)
  return deleted.count === 1 ? { kind: 'deleted' as const } : { kind: 'not-found' as const }
}

export function monthRange(month: string): ReportRange {
  const [year, monthNumber] = month.split('-').map(Number)
  const from = new Date(Date.UTC(year, monthNumber - 1, 1))
  return { from, to: new Date(Date.UTC(year, monthNumber, 1)) }
}

function csvValue(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n') + '\r\n'
}

export async function exportPurchasesCsv(userId: string, range: ReportRange): Promise<string> {
  const { purchases } = await getReportData(database, userId)
  const rows = purchases
    .filter((purchase) => purchase.purchasedAt >= range.from && purchase.purchasedAt < range.to)
    .map((purchase) => [purchase.productNameSnapshot, purchase.purchasedAt.toISOString(), centsToMoney(purchase.totalCostCents)])
  return toCsv(['Stock Name', 'Date Bought', 'Cost'], rows)
}

export async function exportStockCsv(userId: string): Promise<string> {
  const { products, purchases } = await getReportData(database, userId)
  const soldByProduct = purchases.reduce<Record<string, number>>((totals, purchase) => {
    totals[purchase.productId] = (totals[purchase.productId] ?? 0) + purchase.quantity
    return totals
  }, {})
  const rows = products.map((product) => [product.name, product.stockQuantity, centsToMoney(product.priceCents), soldByProduct[product.id] ?? 0])
  return toCsv(['Stock Name', 'Remaining Stocks', 'Updated Price', 'Sold'], rows)
}

export async function createPurchases(userId: string, inputs: Array<{ productId: string; quantity: number }>) {
  const outcome = await createPurchasesRecord(database, userId, inputs)
  return outcome.kind === 'created' ? { kind: outcome.kind, purchases: outcome.purchases.map(toPurchaseResponse) } : outcome
}

export async function setStockQuantity(userId: string, productId: string, quantity: number, deductEarnings = false) {
  const outcome = await setStockQuantityRecord(database, userId, productId, quantity, deductEarnings)
  return outcome.kind === 'updated' ? { kind: outcome.kind, product: toProductResponse(outcome.product) } : outcome
}