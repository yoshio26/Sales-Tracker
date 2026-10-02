import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import styles from '../App.module.css'

export type StockProduct = { id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }

const stockResponseSchema = z.object({ products: z.array(z.object({ id: z.string().uuid(), name: z.string(), category: z.string(), price: z.string(), stockQuantity: z.number().int().nonnegative(), updatedAt: z.string() })) })
const productIdSchema = z.string().uuid('Select a product.')
const quantitySchema = z.coerce.number().int('Quantity must be a whole number.').positive('Quantity must be greater than zero.')

type Props = { mode: 'buy' | 'stock'; onChanged: () => void; refreshKey?: number }

export function StockTrackerPage({ mode, onChanged, refreshKey = 0 }: Props) {
  const [products, setProducts] = useState<StockProduct[]>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [fieldError, setFieldError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/stock', { credentials: 'include' })
      if (!response.ok) throw new Error('Unable to load stock.')
      setProducts(stockResponseSchema.parse(await response.json()).products)
    } catch { setError('Unable to load stock. Try again.') } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [refreshKey])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFieldError('')
    setError('')
    setNotice('')
    const product = productIdSchema.safeParse(productId)
    const parsedQuantity = quantitySchema.safeParse(quantity)
    if (!product.success || !parsedQuantity.success) {
      if (!product.success) setFieldError(product.error.issues[0]?.message ?? 'Select a product.')
      else if (!parsedQuantity.success) setFieldError(parsedQuantity.error.issues[0]?.message ?? 'Enter a valid quantity.')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(mode === 'buy' ? '/api/stock/purchases' : '/api/stock/replenish', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'buy' ? { productId: product.data, quantity: parsedQuantity.data } : { productId: product.data, quantity: parsedQuantity.data }) })
      const body = await response.json().catch(() => undefined) as { error?: { code?: string; message?: string } } | undefined
      if (!response.ok) { setError(body?.error?.code === 'INSUFFICIENT_STOCK' ? 'There is not enough available stock for that purchase. Your entries were preserved.' : body?.error?.message ?? 'Unable to save stock changes.'); return }
      setQuantity('1')
      setNotice(mode === 'buy' ? 'Purchase recorded and stock updated.' : 'Stock replenished.')
      await load()
      onChanged()
    } catch { setError('Unable to contact the stock service. Try again.') } finally { setLoading(false) }
  }

  const selectedProduct = products.find((product) => product.id === productId)
  const calculatedTotal = selectedProduct && mode === 'buy' ? (Number(selectedProduct.price) * Number(quantity || 0)).toFixed(2) : null

  return <section className={styles.stockView} aria-labelledby="stock-heading">
    <div><h2 id="stock-heading">{mode === 'buy' ? 'Buy stock' : 'Stocks'}</h2><p>{mode === 'buy' ? 'Record a purchase from available stock.' : 'Available stocks stay visible, including products at zero.'}</p></div>
    {error && <p className={styles.error} role="alert">{error} <button className={styles.linkButton} type="button" onClick={() => void load()}>Retry</button></p>}
    <form className={styles.productForm} onSubmit={submit} noValidate>
      <label htmlFor="stock-product">Product</label>
      <select id="stock-product" value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Select an active product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — ₱{product.price} ({product.stockQuantity} available)</option>)}</select>
      <label htmlFor="stock-quantity">Quantity</label><input id="stock-quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      {mode === 'buy' && <p>Unit price: ₱{selectedProduct?.price ?? '0.00'} · Total: ₱{calculatedTotal ?? '0.00'}</p>}
      {fieldError && <p className={styles.error} role="alert">{fieldError}</p>}
      <button disabled={loading} type="submit">{loading ? 'Saving…' : mode === 'buy' ? 'Buy stock' : 'Add stock'}</button>
    </form>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {loading && products.length === 0 ? <p role="status">Loading stock…</p> : products.length === 0 ? <p className={styles.empty}>No active products are available. Add a product first.</p> : <ul className={styles.productList} aria-label="Available stock">{products.map((product) => <li className={styles.productItem} key={product.id}><div><strong>{product.name}</strong><span>{product.category} · ₱{product.price} each</span></div><strong>{product.stockQuantity} available</strong></li>)}</ul>}
  </section>
}