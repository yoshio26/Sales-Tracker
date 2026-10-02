import { useState } from 'react'
import styles from '../App.module.css'
import { PurchaseHistoryPage } from './PurchaseHistoryPage'

type Props = { onStockDeleted: () => Promise<void>; onHistoryChanged: () => Promise<void> }

export function SettingsPage({ onStockDeleted, onHistoryChanged }: Props) {
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState('')
  const [stockNotice, setStockNotice] = useState('')

  async function deleteStocks() {
    if (!window.confirm('Delete all of your stock records? This cannot be undone.')) return
    setStockLoading(true)
    setStockError('')
    setStockNotice('')
    try {
      const response = await fetch('/api/stock', { method: 'DELETE', credentials: 'include' })
      const body = await response.json().catch(() => undefined) as { deleted?: number; error?: { message?: string } } | undefined
      if (!response.ok) {
        setStockError(body?.error?.message ?? 'Unable to delete stocks. Try again.')
        return
      }
      await onStockDeleted()
      setStockNotice(`${body?.deleted ?? 0} stock record${body?.deleted === 1 ? '' : 's'} deleted.`)
    } catch {
      setStockError('Unable to contact the stock service. Try again.')
    } finally {
      setStockLoading(false)
    }
  }

  return <div className={styles.settingsView}>
    <section className={styles.settingsCard} aria-labelledby="settings-heading">
      <div><h2 id="settings-heading">Settings</h2><p>Manage your stock and purchase-history data. These actions are permanent.</p></div>
      <div className={styles.dangerPanel}>
        <div><h3>Delete stocks</h3><p>Remove your stock records. Stocks with purchase history or expenses cannot be deleted.</p></div>
        <button className={styles.danger} type="button" disabled={stockLoading} onClick={() => void deleteStocks()}>{stockLoading ? 'Deleting…' : 'Delete stocks'}</button>
      </div>
      {stockError && <p className={styles.error} role="alert">{stockError}</p>}
      {stockNotice && <p className={styles.notice} role="status">{stockNotice}</p>}
    </section>
    <PurchaseHistoryPage deletable onChanged={onHistoryChanged} />
  </div>
}
