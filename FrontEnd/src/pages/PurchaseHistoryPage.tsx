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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/stock/purchases', { credentials: 'include' })
      if (!response.ok) throw new Error('Unable to load purchase history.')
      setPurchases(historySchema.parse(await response.json()).purchases)
      setSelectedIds(new Set())
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

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    setSelectedIds((current) => visiblePurchases.length > 0 && visiblePurchases.every((purchase) => current.has(purchase.id))
      ? new Set([...current].filter((id) => !visiblePurchases.some((purchase) => purchase.id === id)))
      : new Set([...current, ...visiblePurchases.map((purchase) => purchase.id)]))
  }

  async function removeSelected() {
    const selectedPurchases = purchases.filter((purchase) => selectedIds.has(purchase.id))
    if (selectedPurchases.length === 0) return
    if (!window.confirm(`Delete ${selectedPurchases.length} selected purchase record${selectedPurchases.length === 1 ? '' : 's'}?`)) return
    setDeletingId('bulk')
    setError('')
    try {
      const results = await Promise.all(selectedPurchases.map(async (purchase) => {
        try {
          const response = await fetch(`/api/stock/purchases/${purchase.id}`, { method: 'DELETE', credentials: 'include' })
          const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
          return { id: purchase.id, ok: response.ok, message: body?.error?.message }
        } catch {
          return { id: purchase.id, ok: false, message: 'Unable to contact the stock service.' }
        }
      }))
      const removedIds = results.filter((result) => result.ok).map((result) => result.id)
      const failures = results.filter((result) => !result.ok)
      if (removedIds.length > 0) {
        await load()
        await onChanged?.()
      }
      if (failures.length > 0) setError(`${removedIds.length} deleted; ${failures.length} could not be deleted. ${failures[0]?.message ?? ''}`.trim())
    } finally {
      setDeletingId(null)
    }
  }

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const filteredPurchases = purchases.filter((purchase) => purchase.productName.toLocaleLowerCase().includes(normalizedSearchQuery))
  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / pageSize))
  const visiblePurchases = filteredPurchases.slice((page - 1) * pageSize, page * pageSize)
  const firstRow = filteredPurchases.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, filteredPurchases.length)
  const allVisibleSelected = visiblePurchases.length > 0 && visiblePurchases.every((purchase) => selectedIds.has(purchase.id))

  function changePageSize(value: string) {
    const nextPageSize = Number(value)
    setPageSize(nextPageSize)
    setPage(1)
  }

  return <section className={styles.stockView} aria-labelledby="history-heading">
    <div><h2 id="history-heading">Purchase history</h2><p>Records are shown newest first using the labels captured at purchase time.</p><div className={styles.stockSearch}><label className={styles.searchLabel} htmlFor="history-product-search">Search Product</label><input id="history-product-search" type="search" value={searchQuery} placeholder="Type a product name" onChange={(event) => { setSearchQuery(event.target.value); setPage(1) }} /></div></div>
    {error && <p className={styles.error} role="alert">{error} <button className={styles.linkButton} type="button" onClick={() => void load()}>Retry</button></p>}
    {loading ? <p role="status">Loading purchase history…</p> : purchases.length === 0 ? <p className={styles.empty}>No purchases recorded yet.</p> : filteredPurchases.length === 0 ? <p className={styles.empty}>No purchases match “{searchQuery}”.</p> : <>
      <div className={styles.historyToolbar}>
        <label htmlFor="history-page-size">Records per page</label>
        <select id="history-page-size" value={pageSize} onChange={(event) => changePageSize(event.target.value)}>
          {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <span aria-live="polite">{firstRow}–{lastRow} of {filteredPurchases.length} purchase records</span>
      </div>
      {deletable && <div className={styles.selectionToolbar}>
        <label className={styles.selectAllLabel}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all purchase records on this page" /> <span>Select all on this page</span></label>
        <span className={styles.selectionCount} aria-live="polite">{selectedIds.size} selected</span>
        <button className={styles.danger} type="button" disabled={deletingId !== null || selectedIds.size === 0} onClick={() => void removeSelected()}>{deletingId === 'bulk' ? 'Deleting…' : 'Delete selected'}</button>
      </div>}
      <div className={styles.historyScrollArea}>
        <ul className={styles.productList} aria-label="Purchase history">{visiblePurchases.map((purchase) => <li className={styles.productItem} key={purchase.id}>{deletable && <label className={styles.rowCheckbox}><input type="checkbox" checked={selectedIds.has(purchase.id)} onChange={() => toggleSelected(purchase.id)} aria-label={`Select ${purchase.productName} purchase`} /></label>}<div className={styles.productItemDetails}><strong>{purchase.productName} × {purchase.quantity}</strong><span>{purchase.category} · {new Date(purchase.purchasedAt).toLocaleString()}</span></div><div className={styles.itemActions}><strong>₱{purchase.totalCost}</strong>{deletable && <button className={styles.danger} type="button" disabled={deletingId !== null} onClick={() => void remove(purchase)}>{deletingId === purchase.id ? 'Deleting…' : 'Delete'}</button>}</div></li>)}</ul>
      </div>
      <nav className={styles.pagination} aria-label="Purchase history pagination">
        <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
      </nav>
    </>}
  </section>
}