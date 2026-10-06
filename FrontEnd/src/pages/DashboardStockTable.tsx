import { useEffect, useState } from 'react'
import { z } from 'zod'
import styles from '../App.module.css'

export type DashboardStockProduct = { id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }

type Props = {
  refreshKey?: number
  onEdit: (product: DashboardStockProduct) => void
  onDelete: (product: DashboardStockProduct) => void
}

const stockResponseSchema = z.object({ products: z.array(z.object({ id: z.uuid(), name: z.string(), category: z.string(), price: z.string(), stockQuantity: z.number().int().nonnegative(), updatedAt: z.string() })) })
const purchaseResponseSchema = z.object({ purchases: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().positive() })) })

function formatPrice(price: string): string {
  return Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 3.3 3.3-.8L18.9 6.6a2.1 2.1 0 0 0-3-3L4 16.5Z" /><path d="m14.5 5.5 4 4" /></svg>
}

function DeleteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg>
}

export function DashboardStockTable({ refreshKey = 0, onEdit, onDelete }: Props) {
  const [products, setProducts] = useState<DashboardStockProduct[]>([])
  const [soldByProduct, setSoldByProduct] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [stockResponse, purchasesResponse] = await Promise.all([
        fetch('/api/stock', { credentials: 'include' }),
        fetch('/api/stock/purchases', { credentials: 'include' }),
      ])
      if (!stockResponse.ok || !purchasesResponse.ok) throw new Error('Unable to load available stock.')
      const stock = stockResponseSchema.parse(await stockResponse.json())
      const purchases = purchaseResponseSchema.parse(await purchasesResponse.json()).purchases
      const sold = purchases.reduce<Record<string, number>>((totals, purchase) => {
        totals[purchase.productId] = (totals[purchase.productId] ?? 0) + purchase.quantity
        return totals
      }, {})
      setProducts(stock.products)
      setSoldByProduct(sold)
    } catch {
      setError('Unable to load available stock. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [refreshKey])

  return <section className={styles.stockTableSection} aria-labelledby="available-stock-heading">
    <div><h2 id="available-stock-heading">Available stock</h2><p>Review inventory and manage each stock item from the dashboard.</p></div>
    {error && <p className={styles.error} role="alert">{error} <button className={styles.linkButton} type="button" onClick={() => void load()}>Retry</button></p>}
    {loading ? <p role="status" aria-live="polite">Loading available stock…</p> : products.length === 0 ? <p className={styles.empty}>No active stock is available.</p> : <div className={styles.stockTableScroll}>
      <table className={styles.stockTable}>
        <caption className={styles.visuallyHidden}>Available stock and sales summary</caption>
        <thead><tr><th scope="col">Stock Name</th><th scope="col">Stocks</th><th scope="col">Sold</th><th scope="col">Updated Price</th><th scope="col">Edit</th></tr></thead>
        <tbody>{products.map((product) => <tr key={product.id}>
          <th scope="row"><span className={styles.stockTableName}>{product.name}</span><span className={styles.stockTableCategory}>{product.category}</span></th>
          <td data-label="Stocks">{product.stockQuantity}</td>
          <td data-label="Sold">{soldByProduct[product.id] ?? 0}</td>
          <td data-label="Updated Price">₱{formatPrice(product.price)}</td>
          <td data-label="Edit"><div className={styles.stockTableActions}>
            <button className={styles.iconButton} type="button" title={`Edit ${product.name}`} aria-label={`Edit ${product.name}`} onClick={() => onEdit(product)}><EditIcon /></button>
            <button className={`${styles.iconButton} ${styles.iconDanger}`} type="button" title={`Delete ${product.name}`} aria-label={`Delete ${product.name}`} onClick={() => onDelete(product)}><DeleteIcon /></button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>
}
