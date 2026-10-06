import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import styles from '../App.module.css'
import { PurchaseHistoryPage } from './PurchaseHistoryPage'

type ArchivedProduct = { id: string; name: string; category: string; price: string; stockQuantity: number; archivedAt: string | null; deletedAt: string | null }
type ColorTheme = 'default' | 'blue' | 'green' | 'purple' | 'orange'
type SettingsSection = 'archive' | 'history' | 'settings' | 'color-theme'

const colorThemes: Array<{ name: ColorTheme; label: string; color: string }> = [
  { name: 'default', label: 'Pink', color: '#f51f80' },
  { name: 'blue', label: 'Blue', color: '#2563eb' },
  { name: 'green', label: 'Green', color: '#159957' },
  { name: 'purple', label: 'Purple', color: '#7c3aed' },
  { name: 'orange', label: 'Orange', color: '#ea580c' },
]

type Props = { onStockDeleted: () => Promise<void>; onHistoryChanged: () => Promise<void>; archivedProducts: ArchivedProduct[] }

export function SettingsPage({ onStockDeleted, onHistoryChanged, archivedProducts }: Props) {
  const [section, setSection] = useState<SettingsSection>('archive')
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState('')
  const [stockNotice, setStockNotice] = useState('')
  const [stockConfirmationOpen, setStockConfirmationOpen] = useState(false)
  const [stockCountdown, setStockCountdown] = useState(10)
  const [selectedColorTheme, setSelectedColorTheme] = useState<ColorTheme>(() => {
    const color = document.documentElement.getAttribute('data-color')
    return colorThemes.some((theme) => theme.name === color) ? color as ColorTheme : 'default'
  })
  const [customColor, setCustomColor] = useState(() => {
    try {
      return window.localStorage.getItem('customColor') ?? ''
    } catch {
      return ''
    }
  })
  const deleteStockButtonRef = useRef<HTMLButtonElement>(null)
  const cancelStockRef = useRef<HTMLButtonElement>(null)

  function setColorTheme(name: ColorTheme) {
    document.documentElement.removeAttribute('data-color')
    document.documentElement.style.removeProperty('--accent')
    document.documentElement.style.removeProperty('--accent-hover')
    document.documentElement.style.removeProperty('--accent-soft')
    document.documentElement.style.removeProperty('--on-accent')
    if (name !== 'default') document.documentElement.setAttribute('data-color', name)
    setSelectedColorTheme(name)
    setCustomColor('')
    try {
      window.localStorage.setItem('colorTheme', name)
      window.localStorage.removeItem('customColor')
    } catch {
      // Theme preference remains usable when browser storage is unavailable.
    }
  }

  function setCustomAccent(hex: string) {
    const red = Number.parseInt(hex.slice(1, 3), 16)
    const green = Number.parseInt(hex.slice(3, 5), 16)
    const blue = Number.parseInt(hex.slice(5, 7), 16)
    const darker = (value: number) => Math.round(value * 0.82)
    const luminance = (value: number) => {
      const channel = value / 255
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    }
    const contrast = 0.2126 * luminance(red) + 0.7152 * luminance(green) + 0.0722 * luminance(blue) + 0.05
    document.documentElement.removeAttribute('data-color')
    document.documentElement.style.setProperty('--accent', hex)
    document.documentElement.style.setProperty('--accent-hover', `rgb(${darker(red)}, ${darker(green)}, ${darker(blue)})`)
    document.documentElement.style.setProperty('--accent-soft', `rgba(${red}, ${green}, ${blue}, 0.12)`)
    document.documentElement.style.setProperty('--on-accent', contrast > 0.179 ? '#000000' : '#ffffff')
    setSelectedColorTheme('default')
    setCustomColor(hex)
    try {
      window.localStorage.setItem('customColor', hex)
      window.localStorage.removeItem('colorTheme')
    } catch {
      // Theme preference remains usable when browser storage is unavailable.
    }
  }

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
      {([['archive', 'Archive'], ['history', 'History'], ['settings', 'Settings'], ['color-theme', 'Color Theme']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={section === value} aria-controls={`${value}-panel`} className={section === value ? styles.selectedTab : styles.tab} onClick={() => setSection(value)}>{label}</button>)}
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
    {section === 'color-theme' && <section id="color-theme-panel" className={styles.settingsCard} aria-labelledby="color-theme-heading" role="tabpanel">
      <div><h2 id="color-theme-heading">Color Theme</h2><p>Choose an accent color without changing the existing light or dark mode.</p></div>
      <div className={styles.colorThemeOptions} role="radiogroup" aria-label="Preset color themes">
        {colorThemes.map((theme) => <button key={theme.name} type="button" role="radio" aria-checked={!customColor && selectedColorTheme === theme.name} className={`${styles.colorSwatch} ${!customColor && selectedColorTheme === theme.name ? styles.colorSwatchSelected : ''}`} style={{ '--swatch-color': theme.color } as CSSProperties} onClick={() => setColorTheme(theme.name)}><span aria-hidden="true" />{theme.label}</button>)}
        <label className={`${styles.colorSwatch} ${customColor ? styles.colorSwatchSelected : ''}`}><span aria-hidden="true" style={{ background: customColor || '#ffffff' }} /><span>Custom</span><input type="color" value={customColor || '#f51f80'} onChange={(event) => setCustomAccent(event.target.value)} aria-label="Choose custom accent color" /></label>
      </div>
    </section>}
  </div>
}
