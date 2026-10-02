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

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/stock/purchases', { credentials: 'include' })
      if (!response.ok) throw new Error('Unable to load purchase history.')
      setPurchases(historySchema.parse(await response.json()).purchases)
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

  return <section className={styles.stockView} aria-labelledby="history-heading">
    <div><h2 id="history-heading">Purchase history</h2><p>Records are shown newest first using the labels captured at purchase time.</p></div>
    {error && <p className={styles.error} role="alert">{error} <button className={styles.linkButton} type="button" onClick={() => void load()}>Retry</button></p>}
    {loading ? <p role="status">Loading purchase history…</p> : purchases.length === 0 ? <p className={styles.empty}>No purchases recorded yet.</p> : <ul className={styles.productList} aria-label="Purchase history">{purchases.map((purchase) => <li className={styles.productItem} key={purchase.id}><div><strong>{purchase.productName} × {purchase.quantity}</strong><span>{purchase.category} · {new Date(purchase.purchasedAt).toLocaleString()}</span></div><div className={styles.itemActions}><strong>₱{purchase.totalCost}</strong>{deletable && <button className={styles.danger} type="button" disabled={deletingId !== null} onClick={() => void remove(purchase)}>{deletingId === purchase.id ? 'Deleting…' : 'Delete'}</button>}</div></li>)}</ul>}
  </section>
}