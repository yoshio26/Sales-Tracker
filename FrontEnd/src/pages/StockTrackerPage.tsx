import { useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { z } from 'zod'
import styles from '../App.module.css'

export type StockProduct = { id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }
type PurchaseRecord = { id: string; productId: string; productName: string; category: string; quantity: number; totalCost: string; purchasedAt: string }
type CartItem = { product: StockProduct; quantity: number }

const stockResponseSchema = z.object({ products: z.array(z.object({ id: z.string().uuid(), name: z.string(), category: z.string(), price: z.string(), stockQuantity: z.number().int().nonnegative(), updatedAt: z.string() })) })
const purchaseResponseSchema = z.object({ purchases: z.array(z.object({ id: z.string().uuid(), productId: z.string().uuid(), productName: z.string(), category: z.string(), quantity: z.number().int().positive(), totalCost: z.string(), purchasedAt: z.string() })) })
const productIdSchema = z.string().uuid('Select a product.')
const quantitySchema = z.coerce.number().int('Quantity must be a whole number.').positive('Quantity must be greater than zero.')
const exactQuantitySchema = z.coerce.number().int('Quantity must be a whole number.').nonnegative('Quantity cannot be negative.')

function formatPrice(price: string): string {
  return Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Props = { mode: 'buy' | 'stock'; onChanged: () => void; refreshKey?: number; prefillProduct?: StockProduct | null; prefillRequest?: number; onQuantityEditCancel?: () => void; onEdit?: (product: StockProduct) => void; onDelete?: (product: StockProduct) => void; onReviewStock?: () => void }

export function StockTrackerPage({ mode, onChanged, refreshKey = 0, prefillProduct = null, prefillRequest = 0, onQuantityEditCancel, onEdit, onDelete, onReviewStock }: Props) {
  const [products, setProducts] = useState<StockProduct[]>([])
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [productId, setProductId] = useState('')
  const [productMenuOpen, setProductMenuOpen] = useState(false)
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [deductRestock, setDeductRestock] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [purchasePage, setPurchasePage] = useState(1)
  const [purchasePageSize, setPurchasePageSize] = useState(10)
  const [stockPage, setStockPage] = useState(1)
  const [stockPageSize, setStockPageSize] = useState(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [insufficientStockOpen, setInsufficientStockOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [quantityEditMode, setQuantityEditMode] = useState(false)
  const [quantityDeductionOpen, setQuantityDeductionOpen] = useState(false)
  const [pendingQuantity, setPendingQuantity] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/stock', { credentials: 'include' })
      if (!response.ok) throw new Error('Unable to load stock.')
      setProducts(stockResponseSchema.parse(await response.json()).products)
      setStockPage(1)
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

  useEffect(() => {
    if (mode !== 'stock' || !prefillProduct) return
    setQuantityEditMode(true)
    setProductId(prefillProduct.id)
    setQuantity(String(prefillProduct.stockQuantity))
    setDeductRestock(null)
    setProductMenuOpen(false)
    setNotice('Edit quantity mode: enter the complete stock amount, then save it.')
  }, [mode, prefillProduct, prefillRequest])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFieldError('')
    setError('')
    setNotice('')
    if (mode === 'stock' && !quantityEditMode && deductRestock === null) { setFieldError('Choose Yes or No for deducting the restock cost.'); return }
    const product = productIdSchema.safeParse(productId)
    const parsedQuantity = (quantityEditMode ? exactQuantitySchema : quantitySchema).safeParse(quantity)
    if (!product.success || !parsedQuantity.success) {
      if (!product.success) setFieldError(product.error.issues[0]?.message ?? 'Select a product.')
      else if (!parsedQuantity.success) setFieldError(parsedQuantity.error.issues[0]?.message ?? 'Enter a valid quantity.')
      return
    }
    if (mode === 'buy') {
      if (parsedQuantity.data > (selectedProduct?.stockQuantity ?? 0)) {
        setInsufficientStockOpen(true)
        return
      }
      const existing = cart.find((item) => item.product.id === product.data)
      if (existing && existing.quantity + parsedQuantity.data > existing.product.stockQuantity) {
        setInsufficientStockOpen(true)
        return
      }
      setCart((current) => existing
        ? current.map((item) => item.product.id === product.data ? { ...item, quantity: item.quantity + parsedQuantity.data } : item)
        : [...current, { product: selectedProduct!, quantity: parsedQuantity.data }])
      setProductId('')
      setQuantity('1')
      setProductSearchQuery('')
      setNotice('Added to cart.')
      return
    }
    if (quantityEditMode && parsedQuantity.data > (selectedProduct?.stockQuantity ?? 0)) {
      setPendingQuantity(parsedQuantity.data)
      setQuantityDeductionOpen(true)
      return
    }
    await saveStockQuantity(parsedQuantity.data, false)
  }

  async function saveStockQuantity(nextQuantity: number, deductEarnings: boolean) {
    setQuantityDeductionOpen(false)
    setPendingQuantity(null)
    setLoading(true)
    try {
      const response = await fetch(quantityEditMode ? '/api/stock/set-quantity' : '/api/stock/replenish', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quantityEditMode ? { productId, quantity: nextQuantity, deductEarnings } : { productId, quantity: nextQuantity, deductEarnings: deductRestock === true }) })
      const body = await response.json().catch(() => undefined) as { error?: { code?: string; message?: string } } | undefined
      if (!response.ok) {
        if (body?.error?.code === 'INSUFFICIENT_STOCK') {
          setInsufficientStockOpen(true)
          return
        }
        setError(body?.error?.message ?? 'Unable to save stock changes.')
        return
      }
      setQuantity('1')
      setDeductRestock(null)
      setQuantityEditMode(false)
      setNotice(quantityEditMode ? 'Stock quantity updated.' : 'Stock replenished.')
      await load()
      onChanged()
    } catch { setError('Unable to contact the stock service. Try again.') } finally { setLoading(false) }
  }

  async function checkout() {
    if (cart.length === 0) return
    setCheckoutLoading(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/stock/purchases/checkout', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })) }) })
      const body = await response.json().catch(() => undefined) as { error?: { code?: string; message?: string } } | undefined
      if (!response.ok) {
        if (body?.error?.code === 'INSUFFICIENT_STOCK') setInsufficientStockOpen(true)
        else setError(body?.error?.message ?? 'Unable to complete checkout.')
        return
      }
      setCart([])
      setNotice('Checkout complete. Stock updated.')
      await load()
      await loadPurchases()
      onChanged()
    } catch { setError('Unable to contact the checkout service. Try again.') } finally { setCheckoutLoading(false) }
  }

  const selectedProduct = products.find((product) => product.id === productId)
  const calculatedTotal = selectedProduct && mode === 'buy' ? (Number(selectedProduct.price) * Number(quantity || 0)).toFixed(2) : null
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const normalizedProductSearchQuery = productSearchQuery.trim().toLocaleLowerCase()
  const filteredPurchases = purchases.filter((purchase) => purchase.productName.toLocaleLowerCase().includes(normalizedSearchQuery))
  const purchaseTotalPages = Math.max(1, Math.ceil(filteredPurchases.length / purchasePageSize))
  const visiblePurchases = filteredPurchases.slice((purchasePage - 1) * purchasePageSize, purchasePage * purchasePageSize)
  const purchaseFirstRow = filteredPurchases.length === 0 ? 0 : (purchasePage - 1) * purchasePageSize + 1
  const purchaseLastRow = Math.min(purchasePage * purchasePageSize, filteredPurchases.length)
  const filteredProducts = products.filter((product) => product.name.toLocaleLowerCase().includes(normalizedSearchQuery))
  const pickerProducts = products.filter((product) => `${product.name} ${product.category}`.toLocaleLowerCase().includes(normalizedProductSearchQuery))
  const stockTotalPages = Math.max(1, Math.ceil(filteredProducts.length / stockPageSize))
  const visibleProducts = filteredProducts.slice((stockPage - 1) * stockPageSize, stockPage * stockPageSize)
  const stockFirstRow = filteredProducts.length === 0 ? 0 : (stockPage - 1) * stockPageSize + 1
  const stockLastRow = Math.min(stockPage * stockPageSize, filteredProducts.length)

  function chooseProduct(product: StockProduct) {
    setProductId(product.id)
    setProductMenuOpen(false)
    setProductSearchQuery('')
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

  function cancelQuantityEdit() {
    onQuantityEditCancel?.()
    setQuantityEditMode(false)
    setQuantity('1')
    setProductId('')
    setProductSearchQuery('')
    setDeductRestock(null)
    setPendingQuantity(null)
    setQuantityDeductionOpen(false)
    setFieldError('')
    setNotice('Quantity edit canceled. No changes were made.')
  }

  function cancelQuantityDeduction() {
    if (pendingQuantity !== null) setQuantity(String(pendingQuantity))
    setQuantityDeductionOpen(false)
    setPendingQuantity(null)
    setQuantityEditMode(true)
    setNotice('Back to quantity edit. No changes were made.')
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
          <span>{selectedProduct ? <><strong>{selectedProduct.name}</strong><small className={styles.pickerCategory}>{selectedProduct.category}</small></> : 'Select an active product'}</span>
          {selectedProduct && <span className={styles.pickerMeta}>Stock: {selectedProduct.stockQuantity} · Price: ₱{formatPrice(selectedProduct.price)}</span>}
          <span className={styles.pickerChevron} aria-hidden="true">⌄</span>
        </button>
        {productMenuOpen && <div className={styles.productPickerMenu}>
          <label className={styles.productPickerSearchLabel} htmlFor="stock-product-picker-search">Search products</label>
          <input
            id="stock-product-picker-search"
            className={styles.productPickerSearch}
            type="search"
            autoFocus
            value={productSearchQuery}
            placeholder="Type a name or category"
            onChange={(event) => setProductSearchQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') setProductMenuOpen(false) }}
          />
          <ul id="stock-product-options" className={styles.productPickerOptions} role="listbox" aria-labelledby="stock-product-label">
          {pickerProducts.length === 0 ? <li className={styles.productPickerEmpty}>No products match “{productSearchQuery}”.</li> : pickerProducts.map((product) => <li key={product.id} role="option" aria-selected={product.id === productId}>
            <button className={styles.productPickerOption} type="button" onClick={() => chooseProduct(product)}>
              <span><strong>{product.name}</strong><small className={styles.pickerCategory}>{product.category}</small></span>
              <span className={styles.pickerMeta}>Stock: {product.stockQuantity} · Price: ₱{formatPrice(product.price)}</span>
            </button>
          </li>)}
          </ul>
        </div>}
      </div>
      <label htmlFor="stock-quantity">Quantity</label><input id="stock-quantity" type="number" min={quantityEditMode ? 0 : 1} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      {mode === 'stock' && <>
        {!quantityEditMode && <div className={styles.deductionChoice}><span>Deduct from Total Profit?</span><label className={styles.checkboxLabel} htmlFor="restock-deduction-yes"><input id="restock-deduction-yes" type="checkbox" checked={deductRestock === true} onChange={() => setDeductRestock(true)} /> Yes</label><label className={styles.checkboxLabel} htmlFor="restock-deduction-no"><input id="restock-deduction-no" type="checkbox" checked={deductRestock === false} onChange={() => setDeductRestock(false)} /> No</label></div>}
      </>}
      {mode === 'buy' && <p>Unit price: ₱{selectedProduct?.price ?? '0.00'} · Total: ₱{calculatedTotal ?? '0.00'}</p>}
      {fieldError && <p className={styles.error} role="alert">{fieldError}</p>}
      <div className={quantityEditMode ? styles.formActions : undefined}>
        <button disabled={loading || checkoutLoading || (mode === 'stock' && !quantityEditMode && deductRestock === null)} type="submit">{loading ? 'Saving…' : mode === 'buy' ? 'Add to cart' : quantityEditMode ? 'Save quantity' : 'Add stock'}</button>
        {quantityEditMode && <button className={styles.secondary} disabled={loading || checkoutLoading} type="button" onClick={cancelQuantityEdit}>Cancel</button>}
      </div>
    </form>
    {insufficientStockOpen && <div className={styles.modalBackdrop} role="presentation">
      <section className={styles.stockErrorModal} role="alertdialog" aria-modal="true" aria-labelledby="insufficient-stock-heading" aria-describedby="insufficient-stock-message">
        <div className={styles.modalHeader}>
          <span className={styles.stockErrorIcon} aria-hidden="true">!</span>
          <span className={styles.stockErrorLabel}>Purchase not completed</span>
        </div>
        <h3 id="insufficient-stock-heading">Not enough stock</h3>
        <p id="insufficient-stock-message">Review your available stock before trying again. Your entries were preserved.</p>
        <div className={styles.formActions}>
          <button autoFocus type="button" onClick={() => setInsufficientStockOpen(false)}>Okay</button>
          <button className={styles.secondary} type="button" onClick={() => { setInsufficientStockOpen(false); onReviewStock?.() }}>Review stock</button>
        </div>
      </section>
    </div>}
    {quantityDeductionOpen && <div className={styles.modalBackdrop} role="presentation">
      <section className={styles.stockErrorModal} role="dialog" aria-modal="true" aria-labelledby="quantity-deduction-heading">
        <div className={styles.modalHeader}><span className={styles.stockErrorLabel}>Quantity increased</span></div>
        <h3 id="quantity-deduction-heading">Deduct from Total Profit?</h3>
        <p>The quantity increased by {(pendingQuantity ?? 0) - (selectedProduct?.stockQuantity ?? 0)}. Deduct the cost of the additional stock from total profit?</p>
        <div className={styles.formActions}>
          <button autoFocus type="button" onClick={() => pendingQuantity !== null && void saveStockQuantity(pendingQuantity, true)}>Yes, deduct</button>
          <button className={styles.secondary} type="button" onClick={() => pendingQuantity !== null && void saveStockQuantity(pendingQuantity, false)}>No, don’t deduct</button>
          <button className={styles.secondary} type="button" onClick={cancelQuantityDeduction}>Cancel</button>
        </div>
      </section>
    </div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {mode === 'buy' ? <>
      {cart.length > 0 && <section className={styles.cart} aria-labelledby="cart-heading">
        <div className={styles.cartHeader}><div><h3 id="cart-heading">Cart</h3><p>{cart.length} product{cart.length === 1 ? '' : 's'} ready for checkout.</p></div><strong>₱{cart.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0).toFixed(2)}</strong></div>
        <ul className={styles.cartList}>{cart.map((item) => <li className={styles.cartItem} key={item.product.id}><div><strong>{item.product.name}</strong><span>{item.product.category} · ₱{formatPrice(item.product.price)} each</span></div><div className={styles.cartItemControls}><label htmlFor={`cart-quantity-${item.product.id}`}>Qty</label><input id={`cart-quantity-${item.product.id}`} type="number" min="1" max={item.product.stockQuantity} value={item.quantity} onChange={(event) => { const nextQuantity = Number(event.target.value); if (Number.isInteger(nextQuantity) && nextQuantity > 0) setCart((current) => current.map((cartItem) => cartItem.product.id === item.product.id ? { ...cartItem, quantity: nextQuantity } : cartItem)) }} /><button className={styles.secondary} type="button" onClick={() => setCart((current) => current.filter((cartItem) => cartItem.product.id !== item.product.id))}>Remove</button></div></li>)}</ul>
        <button type="button" disabled={checkoutLoading} onClick={() => void checkout()}>{checkoutLoading ? 'Checking out…' : 'Checkout'}</button>
      </section>}
      <div className={styles.stockSearch}><label className={styles.searchLabel} htmlFor="bought-product-search">Search Product</label><input id="bought-product-search" type="search" value={searchQuery} placeholder="Type a product name" onChange={(event) => { setSearchQuery(event.target.value); setPurchasePage(1) }} /></div>
      {purchaseLoading ? <p role="status">Loading bought history…</p> : purchases.length === 0 ? <p className={styles.empty}>No bought products recorded yet.</p> : filteredPurchases.length === 0 ? <p className={styles.empty}>No bought products match “{searchQuery}”.</p> : <>
        <div className={styles.historyScrollArea}>
          <ul className={styles.productList} aria-label="Bought product history">{visiblePurchases.map((purchase) => <li className={styles.productItem} key={purchase.id}><div><strong>{purchase.productName} × {purchase.quantity}</strong><span>{purchase.category} · {new Date(purchase.purchasedAt).toLocaleString()}</span></div><strong>₱{purchase.totalCost}</strong></li>)}</ul>
        </div>
        <div className={styles.dashboardTablePagination}>
          <div className={styles.historyToolbar}>
            <label htmlFor="buy-history-page-size">Bought per page</label>
            <select id="buy-history-page-size" value={purchasePageSize} onChange={(event) => { setPurchasePageSize(Number(event.target.value)); setPurchasePage(1) }}>
              {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <span aria-live="polite">{purchaseFirstRow}–{purchaseLastRow} of {filteredPurchases.length} records</span>
          </div>
          <nav className={`${styles.pagination} ${styles.dashboardStockPagination}`} aria-label="Bought product pagination">
            <button type="button" aria-label="Previous page" disabled={purchasePage === 1} onClick={() => setPurchasePage((current) => current - 1)}>‹</button>
            <span aria-live="polite">{purchasePage} of {purchaseTotalPages}</span>
            <button type="button" aria-label="Next page" disabled={purchasePage === purchaseTotalPages} onClick={() => setPurchasePage((current) => current + 1)}>›</button>
          </nav>
        </div>
      </>}
    </> : loading && products.length === 0 ? <p role="status">Loading stock…</p> : products.length === 0 ? <p className={styles.empty}>No active products are available. Add a product first.</p> : <>
      <div className={styles.stockSearch}><label className={styles.searchLabel} htmlFor="stock-product-search">Search Product</label><input id="stock-product-search" type="search" value={searchQuery} placeholder="Type a product name" onChange={(event) => { setSearchQuery(event.target.value); setStockPage(1) }} /></div>
      {filteredProducts.length === 0 ? <p className={styles.empty}>No products match “{searchQuery}”.</p> : <><div className={styles.stockListScroll}>
        <ul className={styles.productList} aria-label="Available stock">{visibleProducts.map((product) => <li className={styles.productItem} key={product.id}><div><strong>{product.name}</strong><span>{product.category}</span></div><div className={styles.stockProductDetails}><div className={styles.stockMeta}><span>Stock: {product.stockQuantity}</span><span>Price: ₱{formatPrice(product.price)}</span></div>{onEdit && onDelete && <div className={styles.itemActions}><button className={styles.secondary} type="button" onClick={() => onEdit(product)}>Edit</button><button className={styles.danger} type="button" onClick={() => onDelete(product)}>Delete</button></div>}</div></li>)}</ul>
      </div>
      <div className={styles.dashboardTablePagination}>
        <div className={styles.historyToolbar}>
          <label htmlFor="stock-page-size">Rows per page</label>
          <select id="stock-page-size" value={stockPageSize} onChange={(event) => { setStockPageSize(Number(event.target.value)); setStockPage(1) }}>
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span aria-live="polite">{stockFirstRow}–{stockLastRow} of {filteredProducts.length} records</span>
        </div>
        <nav className={`${styles.pagination} ${styles.dashboardStockPagination}`} aria-label="Available stock pagination">
          <button type="button" aria-label="Previous page" disabled={stockPage === 1} onClick={() => setStockPage((current) => current - 1)}>‹</button>
          <span aria-live="polite">{stockPage} of {stockTotalPages}</span>
          <button type="button" aria-label="Next page" disabled={stockPage === stockTotalPages} onClick={() => setStockPage((current) => current + 1)}>›</button>
        </nav>
      </div>
      </>}
    </>}
  </section>
}