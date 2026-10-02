import { useEffect, useRef, useState } from 'react'
import styles from '../App.module.css'
import { PurchaseHistoryPage } from './PurchaseHistoryPage'

type Props = { onStockDeleted: () => Promise<void>; onHistoryChanged: () => Promise<void> }

export function SettingsPage({ onStockDeleted, onHistoryChanged }: Props) {
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState('')
  const [stockNotice, setStockNotice] = useState('')
  const [stockConfirmationOpen, setStockConfirmationOpen] = useState(false)
  const [stockCountdown, setStockCountdown] = useState(10)
  const deleteStockButtonRef = useRef<HTMLButtonElement>(null)
  const cancelStockRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!stockConfirmationOpen) return
    setStockCountdown(10)
    cancelStockRef.current?.focus()
    const timer = window.setInterval(() => setStockCountdown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [stockConfirmationOpen])

  function openStockConfirmation() {
    setStockError('')
    setStockNotice('')
    setStockConfirmationOpen(true)
  }

  function cancelStockDeletion() {
    setStockConfirmationOpen(false)
    setStockCountdown(10)
    deleteStockButtonRef.current?.focus()
  }

  async function deleteStocks() {
    if (stockCountdown > 0) return
    setStockConfirmationOpen(false)
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
      <div><h2 id="settings-heading">Settings</h2><p>Manage your stock and purchase-history data with deliberate confirmation for destructive actions.</p></div>
      <div className={styles.dangerPanel}>
        <div><h3>Delete stocks</h3><p>Remove your stock records and their purchase history and expenses. Deleted data is recoverable for 10 days.</p></div>
        <button ref={deleteStockButtonRef} className={styles.danger} type="button" disabled={stockLoading || stockConfirmationOpen} onClick={openStockConfirmation}>{stockLoading ? 'Deleting…' : 'Delete stocks'}</button>
      </div>
      {stockConfirmationOpen && <section className={styles.stockConfirmation} role="dialog" aria-modal="true" aria-labelledby="delete-stocks-heading">
        <h3 id="delete-stocks-heading">Confirm stock deletion</h3>
        <p>This will remove your active stocks, purchase history, and expenses. The data will be recoverable for 10 days, then permanently purged.</p>
        <p className={styles.warning} role="status" aria-live="polite">{stockCountdown > 0 ? `Confirm becomes available in ${stockCountdown} seconds.` : 'You can now confirm this deletion.'}</p>
        <div className={styles.formActions}>
          <button ref={cancelStockRef} className={styles.secondary} type="button" onClick={cancelStockDeletion}>Cancel</button>
          <button className={styles.danger} type="button" disabled={stockCountdown > 0 || stockLoading} onClick={() => void deleteStocks()}>{stockCountdown > 0 ? `Confirm (${stockCountdown})` : 'Confirm deletion'}</button>
        </div>
      </section>}
      {stockError && <p className={styles.error} role="alert">{stockError}</p>}
      {stockNotice && <p className={styles.notice} role="status">{stockNotice}</p>}
    </section>
    <PurchaseHistoryPage deletable onChanged={onHistoryChanged} />
  </div>
}
