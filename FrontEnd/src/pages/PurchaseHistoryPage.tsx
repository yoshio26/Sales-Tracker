import { useEffect, useState } from 'react'
import { z } from 'zod'
import styles from '../App.module.css'

const historySchema = z.object({ purchases: z.array(z.object({ id: z.string().uuid(), productId: z.string().uuid(), productName: z.string(), category: z.string(), quantity: z.number().int().positive(), totalCost: z.string(), purchasedAt: z.string() })) })

type Props = { deletable?: boolean; onChanged?: () => Promise<void>; refreshKey?: number }

export function PurchaseHistoryPage({ deletable = true, onChanged, refreshKey = 0 }: Props) {
  const [purchases, setPurchases] = useState<z.infer<typeof historySchema>['purchases']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/stock/purchases', { credentials: 'include' })
      if (!response.ok) throw new Error('Unable to load purchase history.')
      setPurchases(historySchema.parse(await response.json()).purchases)
      setPage(1)
    } catch { setError('Unable to load purchase history. Try again.') } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [refreshKey])

  async function remove(purchase: (typeof purchases)[number]) {
    if (!window.confirm(`Delete the purchase history entry for ${purchase.productName}?`)) return
    setDeletingId(purchase.id)
    setError('')
    try {
      const response = await fetch(`/api/stock/purchases/${purchase.id}`, { method: 'DELETE', credentials: 'include' })
      const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
      if (!response.ok) throw new Error(body?.error?.message ?? 'Unable to delete purchase history.')
      await load()
      await onChanged?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete purchase history. Try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(purchases.length / pageSize))
  const visiblePurchases = purchases.slice((page - 1) * pageSize, page * pageSize)

  function changePageSize(value: string) {
    const nextPageSize = Number(value)
    setPageSize(nextPageSize)
    setPage(1)
  }

  return <section className={styles.stockView} aria-labelledby="history-heading">
    <div><h2 id="history-heading">Purchase history</h2><p>Records are shown newest first using the labels captured at purchase time.</p></div>
    {error && <p className={styles.error} role="alert">{error} <button className={styles.linkButton} type="button" onClick={() => void load()}>Retry</button></p>}
    {loading ? <p role="status">Loading purchase history…</p> : purchases.length === 0 ? <p className={styles.empty}>No purchases recorded yet.</p> : <>
      <div className={styles.historyToolbar}>
        <label htmlFor="history-page-size">Records per page</label>
        <select id="history-page-size" value={pageSize} onChange={(event) => changePageSize(event.target.value)}>
          {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <span aria-live="polite">{purchases.length} purchase records</span>
      </div>
      <div className={styles.historyScrollArea}>
        <ul className={styles.productList} aria-label="Purchase history">{visiblePurchases.map((purchase) => <li className={styles.productItem} key={purchase.id}><div><strong>{purchase.productName} × {purchase.quantity}</strong><span>{purchase.category} · {new Date(purchase.purchasedAt).toLocaleString()}</span></div><div className={styles.itemActions}><strong>₱{purchase.totalCost}</strong>{deletable && <button className={styles.danger} type="button" disabled={deletingId !== null} onClick={() => void remove(purchase)}>{deletingId === purchase.id ? 'Deleting…' : 'Delete'}</button>}</div></li>)}</ul>
      </div>
      <nav className={styles.pagination} aria-label="Purchase history pagination">
        <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
      </nav>
    </>}
  </section>
}