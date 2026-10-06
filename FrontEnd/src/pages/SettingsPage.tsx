import { useEffect, useRef, useState } from 'react'
import styles from '../App.module.css'
import { PurchaseHistoryPage } from './PurchaseHistoryPage'

type ArchivedProduct = { id: string; name: string; category: string; price: string; stockQuantity: number; archivedAt: string | null; deletedAt: string | null }
type SettingsSection = 'archive' | 'history' | 'settings'

type Props = { onStockDeleted: () => Promise<void>; onHistoryChanged: () => Promise<void>; archivedProducts: ArchivedProduct[] }

export function SettingsPage({ onStockDeleted, onHistoryChanged, archivedProducts }: Props) {
  const [section, setSection] = useState<SettingsSection>('archive')
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState('')
  const [stockNotice, setStockNotice] = useState('')
  const [stockConfirmationOpen, setStockConfirmationOpen] = useState(false)
  const [stockCountdown, setStockCountdown] = useState(10)
  const deleteStockButtonRef = useRef<HTMLButtonElement>(null)
  const cancelStockRef = useRef<HTMLButtonElement>(null)

  async function permanentlyDelete(product: ArchivedProduct) {
    if (!window.confirm(`Permanently delete ${product.name} and all of its history? This cannot be undone.`)) return
    setStockError('')
    setStockNotice('')
    try {
      const response = await fetch(`/api/products/${product.id}/permanent`, { method: 'DELETE', credentials: 'include' })
      const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
      if (!response.ok) {
        setStockError(body?.error?.message ?? 'Unable to permanently delete the archived product.')
        return
      }
      await onStockDeleted()
      setStockNotice(`${product.name} and its history were permanently deleted.`)
    } catch {
      setStockError('Unable to contact the product service. Try again.')
    }
  }

  async function restore(product: ArchivedProduct) {
    setStockError('')
    setStockNotice('')
    try {
      const response = await fetch(`/api/products/${product.id}/restore`, { method: 'POST', credentials: 'include' })
      const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
      if (!response.ok) {
        setStockError(body?.error?.message ?? 'Unable to restore the archived product.')
        return
      }
      await onStockDeleted()
      setStockNotice(`${product.name} was restored to active stocks.`)
    } catch {
      setStockError('Unable to contact the product service. Try again.')
    }
  }

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
    <nav className={styles.settingsTabs} aria-label="Settings pages" role="tablist">
      {([['archive', 'Archive'], ['history', 'History'], ['settings', 'Settings']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={section === value} aria-controls={`${value}-panel`} className={section === value ? styles.selectedTab : styles.tab} onClick={() => setSection(value)}>{label}</button>)}
    </nav>
    {section === 'archive' && <section id="archive-panel" className={styles.settingsCard} aria-labelledby="archived-products-heading" role="tabpanel">
      <div><h2 id="archived-products-heading">Archived products</h2><p>Products removed from active stocks remain here with their historical details.</p></div>
      {archivedProducts.length === 0 ? <p className={styles.empty}>No archived products.</p> : <div className={styles.stockTableScroll}><table className={styles.stockTable}><caption className={styles.visuallyHidden}>Archived products and recovery actions</caption><thead><tr><th scope="col">Stock Name</th><th scope="col">Stocks</th><th scope="col">Sold</th><th scope="col">Updated Price</th><th scope="col">Actions</th></tr></thead><tbody>{archivedProducts.map((product) => <tr key={product.id}><th scope="row"><span className={styles.stockTableName}>{product.name}</span><span className={styles.stockTableCategory}>{product.category}</span><span className={styles.archived}>{product.deletedAt ? `Deleted ${new Date(product.deletedAt).toLocaleDateString()}` : `Archived ${product.archivedAt ? new Date(product.archivedAt).toLocaleDateString() : ''}`}</span></th><td data-label="Stocks">{product.stockQuantity}</td><td data-label="Sold">—</td><td data-label="Updated Price">₱{product.price}</td><td data-label="Actions"><div className={styles.stockTableActions}><button className={styles.secondary} type="button" onClick={() => void restore(product)}>Restore</button><button className={styles.danger} type="button" onClick={() => void permanentlyDelete(product)}>Delete permanently</button></div></td></tr>)}</tbody></table></div>}
      {stockError && <p className={styles.error} role="alert">{stockError}</p>}
      {stockNotice && <p className={styles.notice} role="status">{stockNotice}</p>}
    </section>}
    {section === 'settings' && <section id="settings-panel" className={styles.settingsCard} aria-labelledby="settings-heading" role="tabpanel">
      <div><h2 id="settings-heading">Settings</h2><p>Manage your stock and purchase-history data with deliberate confirmation for destructive actions.</p></div>
      <div className={styles.dangerPanel}>
        <div><h3>Delete all products</h3><p>Remove all active products, stock records, purchase history, and expenses. Deleted data is recoverable for 10 days, then automatically deleted.</p></div>
        <button ref={deleteStockButtonRef} className={styles.danger} type="button" disabled={stockLoading || stockConfirmationOpen} onClick={openStockConfirmation}>{stockLoading ? 'Deleting…' : 'Delete all products'}</button>
      </div>
      {stockConfirmationOpen && <section className={styles.stockConfirmation} role="dialog" aria-modal="true" aria-labelledby="delete-stocks-heading">
        <h3 id="delete-stocks-heading">Confirm stock deletion</h3>
        <p>This will remove all products, purchase history, and expenses. The data will be recoverable for 10 days, then automatically deleted.</p>
        <p className={styles.warning} role="status" aria-live="polite">{stockCountdown > 0 ? `Confirm becomes available in ${stockCountdown} seconds.` : 'You can now confirm this deletion.'}</p>
        <div className={styles.formActions}>
          <button ref={cancelStockRef} className={styles.secondary} type="button" onClick={cancelStockDeletion}>Cancel</button>
          <button className={styles.danger} type="button" disabled={stockCountdown > 0 || stockLoading} onClick={() => void deleteStocks()}>{stockCountdown > 0 ? `Confirm (${stockCountdown})` : 'Confirm deletion'}</button>
        </div>
      </section>}
      {stockError && <p className={styles.error} role="alert">{stockError}</p>}
      {stockNotice && <p className={styles.notice} role="status">{stockNotice}</p>}
    </section>}
    {section === 'history' && <div id="history-panel" role="tabpanel"><PurchaseHistoryPage deletable onChanged={onHistoryChanged} /></div>}
  </div>
}
