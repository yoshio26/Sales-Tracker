import { useEffect, useState } from 'react'
import { z } from 'zod'
import styles from '../App.module.css'

const historySchema = z.object({ purchases: z.array(z.object({ id: z.string().uuid(), productId: z.string().uuid(), productName: z.string(), category: z.string(), quantity: z.number().int().positive(), totalCost: z.string(), purchasedAt: z.string() })) })

export function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState<z.infer<typeof historySchema>['purchases']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/stock/purchases', { credentials: 'include' })
      if (!response.ok) throw new Error('Unable to load purchase history.')
      setPurchases(historySchema.parse(await response.json()).purchases)
    } catch { setError('Unable to load purchase history. Try again.') } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  return <section className={styles.stockView} aria-labelledby="history-heading">
    <div><h2 id="history-heading">Purchase history</h2><p>Immutable records are shown newest first using the labels captured at purchase time.</p></div>
    {error && <p className={styles.error} role="alert">{error} <button className={styles.linkButton} type="button" onClick={() => void load()}>Retry</button></p>}
    {loading ? <p role="status">Loading purchase history…</p> : purchases.length === 0 ? <p className={styles.empty}>No purchases recorded yet.</p> : <ul className={styles.productList} aria-label="Purchase history">{purchases.map((purchase) => <li className={styles.productItem} key={purchase.id}><div><strong>{purchase.productName} × {purchase.quantity}</strong><span>{purchase.category} · {new Date(purchase.purchasedAt).toLocaleString()}</span></div><strong>${purchase.totalCost}</strong></li>)}</ul>}
  </section>
}