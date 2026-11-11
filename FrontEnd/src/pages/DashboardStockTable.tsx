import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import styles from '../App.module.css'
import { useToast } from '../components/Toast/ToastProvider'
import { StockStatusChip } from '../components/StockStatus/StockStatusChip'
import { ProductImage } from '../components/ProductImage/ProductImage'

export type DashboardStockProduct = { imageUrl?: string | null; id: string; name: string; category: string; price: string; originalPrice: string | null; stockQuantity: number; updatedAt: string }
const stockResponseSchema = z.object({ products: z.array(z.object({ imageUrl: z.string().nullable().optional(), id: z.uuid(), name: z.string(), category: z.string(), price: z.string(), originalPrice: z.string().nullable(), stockQuantity: z.number().int().nonnegative(), updatedAt: z.string() })) })

type Props = {
  refreshKey?: number
  onEdit: (product: DashboardStockProduct) => void
  onDelete: (product: DashboardStockProduct) => void
  onAddStock: (product?: DashboardStockProduct) => void
  onAddToCart?: (product: DashboardStockProduct) => void
}

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

export function DashboardStockTable({ refreshKey = 0, onEdit, onDelete, onAddStock, onAddToCart }: Props) {
  const toast = useToast()
  const loadGeneration = useRef(0)
  const [products, setProducts] = useState<DashboardStockProduct[]>([])
  const [soldByProduct, setSoldByProduct] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [addedProductId, setAddedProductId] = useState<string | null>(null)

  async function load() {
    const generation = loadGeneration.current
    setLoading(true)
    setError('')
    try {
      const [stockResponse, purchasesResponse] = await Promise.all([
        fetch('/api/stock', { credentials: 'include' }),
        fetch('/api/stock/purchases', { credentials: 'include' }),
      ])
      if (!stockResponse.ok || !purchasesResponse.ok) throw new Error('Unable to load available stock.')
      const stock = stockResponseSchema.parse(await stockResponse.json())
      setPage(1)
      const purchases = purchaseResponseSchema.parse(await purchasesResponse.json()).purchases
      const sold = purchases.reduce<Record<string, number>>((totals, purchase) => {
        totals[purchase.productId] = (totals[purchase.productId] ?? 0) + purchase.quantity
        return totals
      }, {})
      setProducts(stock.products)
      setSoldByProduct(sold)
    } catch {
      setError('Unable to load available stock. Try again.')
      if (generation === loadGeneration.current) toast.error('Unable to load available stock. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    return () => { loadGeneration.current += 1 }
  }, [refreshKey])

  const categories = [...new Set(products.map((product) => product.category))].sort((first, second) => first.localeCompare(second))
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const filteredProducts = products.filter((product) => product.name.toLocaleLowerCase().includes(normalizedSearchQuery) && (!categoryFilter || product.category === categoryFilter))
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const visibleProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize)
  const firstRow = filteredProducts.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, filteredProducts.length)

  function addToCart(product: DashboardStockProduct) {
    onAddToCart?.(product)
    setAddedProductId(product.id)
    window.setTimeout(() => setAddedProductId((current) => current === product.id ? null : current), 700)
  }

  return <section className={styles.stockTableSection} aria-labelledby="available-stock-heading">
    <div><h2 id="available-stock-heading">Available stock</h2><p>Review inventory and manage each stock item from the dashboard.</p><div className={styles.stockFilters}><div className={styles.stockSearch}><label className={styles.searchLabel} htmlFor="dashboard-stock-search">Search Product</label><input id="dashboard-stock-search" type="search" value={searchQuery} placeholder="Type a product name" onChange={(event) => { setSearchQuery(event.target.value); setPage(1) }} /></div><div className={styles.stockSearch}><label className={styles.searchLabel} htmlFor="dashboard-category-filter">Filter Category</label><select id="dashboard-category-filter" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></div></div></div>
    {error && <p className={styles.error} role="alert">{error} <button className={styles.linkButton} type="button" onClick={() => void load()}>Retry</button></p>}
    {loading ? <p role="status" aria-live="polite">Loading available stock…</p> : products.length === 0 ? <div className={styles.stockEmptyState} role="status">
      <span className={styles.stockEmptyIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 8.5 12 4l8 4.5v9L12 21l-8-3.5v-9Z" /><path d="m4 8.5 8 4.5 8-4.5M12 13v8" /></svg></span>
      <h3>No stock yet</h3>
      <p>Add your first product to start tracking inventory.</p>
      <button type="button" onClick={onAddStock}>Add your first stock</button>
    </div> : filteredProducts.length === 0 ? <p className={styles.empty}>No products match the selected filters.</p> : <>
      <div className={styles.stockCards} aria-label="Available stock products">
        {visibleProducts.map((product) => <article className={styles.stockCard} key={product.id}>
          <ProductImage src={product.imageUrl} name={product.name} size={150} />
          <div className={styles.stockCardBody}>
            <div className={styles.stockCardHeading}>
              <div><h3>{product.name}</h3><span>{product.category}</span></div>
              <strong>₱{formatPrice(product.price)}</strong>
            </div>
            <div className={styles.stockCardMeta}><span>{product.stockQuantity} in stock</span><StockStatusChip quantity={product.stockQuantity} /><span>{soldByProduct[product.id] ?? 0} sold</span></div>
            <div className={`${styles.stockCardStockActions} ${product.stockQuantity === 0 ? styles.stockCardStockActionsOut : ''}`}>
              <button className={`${styles.stockCardCartButton} ${addedProductId === product.id ? styles.stockCardCartButtonAdded : ''}`} type="button" disabled={product.stockQuantity === 0} onClick={() => addToCart(product)}>{addedProductId === product.id ? 'Added ✓' : 'Add to cart'}</button>
              {product.stockQuantity === 0 && <button className={styles.stockCardRestockButton} type="button" onClick={() => onAddStock(product)}>Add stock</button>}
            </div>
            <div className={styles.stockCardActions}>
              <button className={styles.iconButton} type="button" title={`Edit ${product.name}`} aria-label={`Edit ${product.name}`} onClick={() => onEdit(product)}><EditIcon /></button>
              <button className={`${styles.iconButton} ${styles.iconDanger}`} type="button" title={`Delete ${product.name}`} aria-label={`Delete ${product.name}`} onClick={() => onDelete(product)}><DeleteIcon /></button>
            </div>
          </div>
        </article>)}
      </div>
      <div className={styles.dashboardTablePagination}>
        <div className={styles.stockTableToolbar}>
          <label htmlFor="dashboard-stock-page-size">Rows per page</label>
          <select id="dashboard-stock-page-size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span aria-live="polite">{firstRow}–{lastRow} of {products.length} records</span>
        </div>
        <nav className={`${styles.pagination} ${styles.dashboardStockPagination}`} aria-label="Dashboard available stock pagination">
          <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>‹</button>
          <span aria-live="polite">{page} of {totalPages}</span>
          <button type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>›</button>
        </nav>
      </div>
    </>}
  </section>
}
