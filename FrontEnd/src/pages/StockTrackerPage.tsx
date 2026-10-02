import { useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { z } from 'zod'
import styles from '../App.module.css'

export type StockProduct = { id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }
type PurchaseRecord = { id: string; productId: string; productName: string; category: string; quantity: number; totalCost: string; purchasedAt: string }

const stockResponseSchema = z.object({ products: z.array(z.object({ id: z.string().uuid(), name: z.string(), category: z.string(), price: z.string(), stockQuantity: z.number().int().nonnegative(), updatedAt: z.string() })) })
const purchaseResponseSchema = z.object({ purchases: z.array(z.object({ id: z.string().uuid(), productId: z.string().uuid(), productName: z.string(), category: z.string(), quantity: z.number().int().positive(), totalCost: z.string(), purchasedAt: z.string() })) })
const productIdSchema = z.string().uuid('Select a product.')
const quantitySchema = z.coerce.number().int('Quantity must be a whole number.').positive('Quantity must be greater than zero.')

function formatPrice(price: string): string {
  return Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Props = { mode: 'buy' | 'stock'; onChanged: () => void; refreshKey?: number; onEdit?: (product: StockProduct) => void; onDelete?: (product: StockProduct) => void }

export function StockTrackerPage({ mode, onChanged, refreshKey = 0, onEdit, onDelete }: Props) {
  const [products, setProducts] = useState<StockProduct[]>([])
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [productId, setProductId] = useState('')
  const [productMenuOpen, setProductMenuOpen] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [restockCost, setRestockCost] = useState('')
  const [deductRestock, setDeductRestock] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [purchasePage, setPurchasePage] = useState(1)
  const [purchasePageSize, setPurchasePageSize] = useState(10)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/stock', { credentials: 'include' })
      if (!response.ok) throw new Error('Unable to load stock.')
      setProducts(stockResponseSchema.parse(await response.json()).products)
    } catch { setError('Unable to load stock. Try again.') } finally { setLoading(false) }
  }

  async function loadPurchases() {
    setPurchaseLoading(true)
    try {
      const response = await fetch('/api/stock/purchases', { credentials: 'include' })
      if (!response.ok) throw new Error('Unable to load bought history.')
      setPurchases(purchaseResponseSchema.parse(await response.json()).purchases)
      setPurchasePage(1)
    } catch { setError('Unable to load bought history. Try again.') } finally { setPurchaseLoading(false) }
  }

  useEffect(() => {
    void load()
    if (mode === 'buy') void loadPurchases()
  }, [refreshKey, mode])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFieldError('')
    setError('')
    setNotice('')
    if (mode === 'stock' && deductRestock && !restockCost.trim()) { setFieldError('Enter the restock cost to deduct from total earnings.'); return }
    const product = productIdSchema.safeParse(productId)
    const parsedQuantity = quantitySchema.safeParse(quantity)
    if (!product.success || !parsedQuantity.success) {
      if (!product.success) setFieldError(product.error.issues[0]?.message ?? 'Select a product.')
      else if (!parsedQuantity.success) setFieldError(parsedQuantity.error.issues[0]?.message ?? 'Enter a valid quantity.')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(mode === 'buy' ? '/api/stock/purchases' : '/api/stock/replenish', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'buy' ? { productId: product.data, quantity: parsedQuantity.data } : { productId: product.data, quantity: parsedQuantity.data, deductEarnings: deductRestock, ...(deductRestock ? { cost: restockCost } : {}) }) })
      const body = await response.json().catch(() => undefined) as { error?: { code?: string; message?: string } } | undefined
      if (!response.ok) { setError(body?.error?.code === 'INSUFFICIENT_STOCK' ? 'There is not enough available stock for that purchase. Your entries were preserved.' : body?.error?.message ?? 'Unable to save stock changes.'); return }
      setQuantity('1')
      setRestockCost('')
      setDeductRestock(false)
      setNotice(mode === 'buy' ? 'Purchase recorded and stock updated.' : 'Stock replenished.')
      await load()
      if (mode === 'buy') await loadPurchases()
      onChanged()
    } catch { setError('Unable to contact the stock service. Try again.') } finally { setLoading(false) }
  }

  const selectedProduct = products.find((product) => product.id === productId)
  const calculatedTotal = selectedProduct && mode === 'buy' ? (Number(selectedProduct.price) * Number(quantity || 0)).toFixed(2) : null
  const purchaseTotalPages = Math.max(1, Math.ceil(purchases.length / purchasePageSize))
  const visiblePurchases = purchases.slice((purchasePage - 1) * purchasePageSize, purchasePage * purchasePageSize)

  function chooseProduct(product: StockProduct) {
    setProductId(product.id)
    setProductMenuOpen(false)
    setFieldError('')
  }

  function handleProductKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      setProductMenuOpen(false)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setProductMenuOpen((open) => !open)
    }
  }

  return <section className={styles.stockView} aria-labelledby="stock-heading">
    <div><h2 id="stock-heading">{mode === 'buy' ? 'Bought' : 'Stocks'}</h2><p>{mode === 'buy' ? 'Record a purchase from available stock.' : 'Available stocks stay visible, including products at zero.'}</p></div>
    {error && <p className={styles.error} role="alert">{error} <button className={styles.linkButton} type="button" onClick={() => void load()}>Retry</button></p>}
    <form className={styles.productForm} onSubmit={submit} noValidate>
      <label id="stock-product-label">Product</label>
      <div className={styles.productPicker}>
        <button
          id="stock-product"
          className={styles.productPickerButton}
          type="button"
          role="combobox"
          aria-labelledby="stock-product-label"
          aria-expanded={productMenuOpen}
          aria-controls="stock-product-options"
          aria-haspopup="listbox"
          onClick={() => setProductMenuOpen((open) => !open)}
          onKeyDown={handleProductKeyDown}
        >
          <span>{selectedProduct?.name ?? 'Select an active product'}</span>
          {selectedProduct && <span className={styles.pickerMeta}>Stock: {selectedProduct.stockQuantity} · Price: ₱{formatPrice(selectedProduct.price)}</span>}
          <span className={styles.pickerChevron} aria-hidden="true">⌄</span>
        </button>
        {productMenuOpen && <ul id="stock-product-options" className={styles.productPickerMenu} role="listbox" aria-labelledby="stock-product-label">
          {products.map((product) => <li key={product.id} role="option" aria-selected={product.id === productId}>
            <button className={styles.productPickerOption} type="button" onClick={() => chooseProduct(product)}>
              <span>{product.name}</span>
              <span className={styles.pickerMeta}>Stock: {product.stockQuantity} · Price: ₱{formatPrice(product.price)}</span>
            </button>
          </li>)}
        </ul>}
      </div>
      <label htmlFor="stock-quantity">Quantity</label><input id="stock-quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      {mode === 'stock' && <>
        <label htmlFor="restock-cost">Restock cost (optional)</label>
        <input id="restock-cost" type="text" inputMode="decimal" placeholder="0.00" value={restockCost} onChange={(event) => setRestockCost(event.target.value)} />
        <label className={styles.checkboxLabel}><input type="checkbox" checked={deductRestock} onChange={(event) => setDeductRestock(event.target.checked)} /> Deduct from total earnings?</label>
      </>}
      {mode === 'buy' && <p>Unit price: ₱{selectedProduct?.price ?? '0.00'} · Total: ₱{calculatedTotal ?? '0.00'}</p>}
      {fieldError && <p className={styles.error} role="alert">{fieldError}</p>}
      <button disabled={loading} type="submit">{loading ? 'Saving…' : mode === 'buy' ? 'Bought' : 'Add stock'}</button>
    </form>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {mode === 'buy' ? <>
      <div className={styles.historyToolbar}>
        <label htmlFor="buy-history-page-size">Bought per page</label>
        <select id="buy-history-page-size" value={purchasePageSize} onChange={(event) => { setPurchasePageSize(Number(event.target.value)); setPurchasePage(1) }}>
          {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <span aria-live="polite">{purchases.length} bought records</span>
      </div>
      {purchaseLoading ? <p role="status">Loading bought history…</p> : purchases.length === 0 ? <p className={styles.empty}>No bought products recorded yet.</p> : <>
        <div className={styles.historyScrollArea}>
          <ul className={styles.productList} aria-label="Bought product history">{visiblePurchases.map((purchase) => <li className={styles.productItem} key={purchase.id}><div><strong>{purchase.productName} × {purchase.quantity}</strong><span>{purchase.category} · {new Date(purchase.purchasedAt).toLocaleString()}</span></div><strong>₱{purchase.totalCost}</strong></li>)}</ul>
        </div>
        <nav className={styles.pagination} aria-label="Bought product pagination">
          <button type="button" disabled={purchasePage === 1} onClick={() => setPurchasePage((current) => current - 1)}>Previous</button>
          <span>Page {purchasePage} of {purchaseTotalPages}</span>
          <button type="button" disabled={purchasePage === purchaseTotalPages} onClick={() => setPurchasePage((current) => current + 1)}>Next</button>
        </nav>
      </>}
    </> : loading && products.length === 0 ? <p role="status">Loading stock…</p> : products.length === 0 ? <p className={styles.empty}>No active products are available. Add a product first.</p> : <ul className={styles.productList} aria-label="Available stock">{products.map((product) => <li className={styles.productItem} key={product.id}><div><strong>{product.name}</strong><span>{product.category}</span></div><div className={styles.stockProductDetails}><div className={styles.stockMeta}><span>Stock: {product.stockQuantity}</span><span>Price: ₱{formatPrice(product.price)}</span></div>{onEdit && onDelete && <div className={styles.itemActions}><button className={styles.secondary} type="button" onClick={() => onEdit(product)}>Edit</button><button className={styles.danger} type="button" onClick={() => onDelete(product)}>Delete</button></div>}</div></li>)}</ul>}
  </section>
}