import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import styles from '../App.module.css'
import { PurchaseHistoryPage } from './PurchaseHistoryPage'

type ArchivedProduct = { id: string; name: string; category: string; price: string; stockQuantity: number; archivedAt: string | null; deletedAt: string | null }
type ColorTheme = 'default' | 'blue' | 'green' | 'purple' | 'orange'
type SettingsSection = 'archive' | 'history' | 'settings' | 'color-theme'
type ProfitAdjustment = { id: string; amount: string; note: string | null; createdAt: string; updatedAt: string }

const colorThemes: Array<{ name: ColorTheme; label: string; color: string }> = [
  { name: 'default', label: 'Pink', color: '#f51f80' },
  { name: 'blue', label: 'Blue', color: '#2563eb' },
  { name: 'green', label: 'Green', color: '#159957' },
  { name: 'purple', label: 'Purple', color: '#7c3aed' },
  { name: 'orange', label: 'Orange', color: '#ea580c' },
]

type Props = { onStockDeleted: () => Promise<void>; onHistoryChanged: () => Promise<void>; onProfitChanged: () => Promise<void>; archivedProducts: ArchivedProduct[] }

export function SettingsPage({ onStockDeleted, onHistoryChanged, onProfitChanged, archivedProducts }: Props) {
  const [section, setSection] = useState<SettingsSection>('archive')
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState('')
  const [stockNotice, setStockNotice] = useState('')
  const [selectedArchivedProductIds, setSelectedArchivedProductIds] = useState<Set<string>>(new Set())
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [stockConfirmationOpen, setStockConfirmationOpen] = useState(false)
  const [stockCountdown, setStockCountdown] = useState(10)
  const [profitAdjustments, setProfitAdjustments] = useState<ProfitAdjustment[]>([])
  const [selectedProfitAdjustmentIds, setSelectedProfitAdjustmentIds] = useState<Set<string>>(new Set())
  const [profitAmount, setProfitAmount] = useState('')
  const [profitOperation, setProfitOperation] = useState<'add' | 'deduct'>('add')
  const [profitNote, setProfitNote] = useState('')
  const [profitLoading, setProfitLoading] = useState(false)
  const [profitError, setProfitError] = useState('')
  const [profitNotice, setProfitNotice] = useState('')
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

  useEffect(() => {
    if (section !== 'settings') return
    setProfitError('')
    void fetch('/api/profit-adjustment', { credentials: 'include' }).then(async (response) => {
      if (!response.ok) throw new Error()
      const body = await response.json() as { adjustments: ProfitAdjustment[] }
      setProfitAdjustments(body.adjustments)
      setSelectedProfitAdjustmentIds(new Set())
    }).catch(() => setProfitError('Unable to load the profit adjustment. Try again.'))
  }, [section])

  useEffect(() => {
    setSelectedArchivedProductIds((current) => new Set([...current].filter((id) => archivedProducts.some((product) => product.id === id))))
  }, [archivedProducts])

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

  function toggleArchivedProduct(id: string) {
    setSelectedArchivedProductIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllArchivedProducts() {
    setSelectedArchivedProductIds((current) => current.size === archivedProducts.length
      ? new Set()
      : new Set(archivedProducts.map((product) => product.id)))
  }

  async function permanentlyDeleteSelected() {
    const selectedProducts = archivedProducts.filter((product) => selectedArchivedProductIds.has(product.id))
    if (selectedProducts.length === 0) return
    if (!window.confirm(`Permanently delete ${selectedProducts.length} selected archived product${selectedProducts.length === 1 ? '' : 's'} and all of their history? This cannot be undone.`)) return
    setArchiveLoading(true)
    setStockError('')
    setStockNotice('')
    try {
      const results = await Promise.all(selectedProducts.map(async (product) => {
        try {
          const response = await fetch(`/api/products/${product.id}/permanent`, { method: 'DELETE', credentials: 'include' })
          const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
          return { id: product.id, ok: response.ok, message: body?.error?.message }
        } catch {
          return { id: product.id, ok: false, message: 'Unable to contact the product service.' }
        }
      }))
      const removedIds = results.filter((result) => result.ok).map((result) => result.id)
      const failures = results.filter((result) => !result.ok)
      if (removedIds.length > 0) {
        await onStockDeleted()
        setSelectedArchivedProductIds((current) => new Set([...current].filter((id) => !removedIds.includes(id))))
      }
      if (failures.length > 0) setStockError(`${removedIds.length} deleted; ${failures.length} could not be deleted. ${failures[0]?.message ?? ''}`.trim())
      else if (removedIds.length > 0) setStockNotice(`${removedIds.length} archived product${removedIds.length === 1 ? '' : 's'} permanently deleted.`)
    } finally {
      setArchiveLoading(false)
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

  async function saveProfitAdjustment(event: FormEvent) {
    event.preventDefault()
    setProfitLoading(true)
    setProfitError('')
    setProfitNotice('')
    try {
      const response = await fetch('/api/profit-adjustment', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: profitAmount, operation: profitOperation, note: profitNote }) })
      const body = await response.json().catch(() => undefined) as { adjustment?: ProfitAdjustment; error?: { message?: string } } | undefined
      if (!response.ok) {
        setProfitError(body?.error?.message ?? 'Unable to save the profit adjustment.')
        return
      }
      if (body?.adjustment) setProfitAdjustments((current) => [body.adjustment!, ...current])
      setProfitAmount('')
      setProfitNote('')
      setProfitNotice('Profit adjustment saved.')
      await onProfitChanged()
    } catch {
      setProfitError('Unable to contact the profit service. Try again.')
    } finally {
      setProfitLoading(false)
    }
  }

  async function removeProfitAdjustment(id: string) {
    setProfitLoading(true)
    setProfitError('')
    setProfitNotice('')
    try {
      const response = await fetch(`/api/profit-adjustment/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
        setProfitError(body?.error?.message ?? 'Unable to remove the profit adjustment.')
        return
      }
      setProfitAdjustments((current) => current.filter((adjustment) => adjustment.id !== id))
      setSelectedProfitAdjustmentIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      setProfitNotice('Profit adjustment removed.')
      await onProfitChanged()
    } catch {
      setProfitError('Unable to contact the profit service. Try again.')
    } finally {
      setProfitLoading(false)
    }
  }

  function toggleProfitAdjustment(id: string) {
    setSelectedProfitAdjustmentIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllProfitAdjustments() {
    setSelectedProfitAdjustmentIds((current) => current.size === profitAdjustments.length
      ? new Set()
      : new Set(profitAdjustments.map((adjustment) => adjustment.id)))
  }

  async function removeSelectedProfitAdjustments() {
    const ids = profitAdjustments
      .filter((adjustment) => selectedProfitAdjustmentIds.has(adjustment.id))
      .map((adjustment) => adjustment.id)
    if (ids.length === 0) return
    if (!window.confirm(`Remove ${ids.length} selected profit adjustment${ids.length === 1 ? '' : 's'}?`)) return

    setProfitLoading(true)
    setProfitError('')
    setProfitNotice('')
    try {
      const results = await Promise.all(ids.map(async (id) => {
        try {
          const response = await fetch(`/api/profit-adjustment/${id}`, { method: 'DELETE', credentials: 'include' })
          if (response.ok) return { id, ok: true }
          const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
          return { id, ok: false, message: body?.error?.message ?? 'Unable to remove the profit adjustment.' }
        } catch {
          return { id, ok: false, message: 'Unable to contact the profit service. Try again.' }
        }
      }))
      const removedIds = results.filter((result) => result.ok).map((result) => result.id)
      const failures = results.filter((result) => !result.ok)
      if (removedIds.length > 0) {
        setProfitAdjustments((current) => current.filter((adjustment) => !removedIds.includes(adjustment.id)))
        setSelectedProfitAdjustmentIds((current) => {
          const next = new Set(current)
          removedIds.forEach((id) => next.delete(id))
          return next
        })
        try {
          await onProfitChanged()
        } catch {
          setProfitError('Adjustments were removed, but the dashboard could not be refreshed.')
        }
      }
      if (failures.length > 0) {
        setProfitError(`${removedIds.length} removed; ${failures.length} could not be removed. ${failures[0]?.message ?? ''}`.trim())
      } else if (removedIds.length > 0) {
        setProfitNotice(`${removedIds.length} profit adjustment${removedIds.length === 1 ? '' : 's'} removed.`)
      }
    } finally {
      setProfitLoading(false)
    }
  }

  return <div className={styles.settingsView}>
    <nav className={styles.settingsTabs} aria-label="Settings pages" role="tablist">
      {([['archive', 'Archive'], ['history', 'History'], ['settings', 'Settings'], ['color-theme', 'Color Theme']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={section === value} aria-controls={`${value}-panel`} className={section === value ? styles.selectedTab : styles.tab} onClick={() => setSection(value)}>{label}</button>)}
    </nav>
    {section === 'archive' && <section id="archive-panel" className={styles.settingsCard} aria-labelledby="archived-products-heading" role="tabpanel">
      <div><h2 id="archived-products-heading">Archived products</h2><p>Products removed from active stocks remain here with their historical details.</p></div>
      {archivedProducts.length === 0 ? <p className={styles.empty}>No archived products.</p> : <><div className={styles.selectionToolbar}><label className={styles.selectAllLabel}><input type="checkbox" checked={archivedProducts.length > 0 && selectedArchivedProductIds.size === archivedProducts.length} onChange={toggleAllArchivedProducts} aria-label="Select all archived products" /> <span>Select all archived</span></label><span className={styles.selectionCount} aria-live="polite">{selectedArchivedProductIds.size} selected</span><button className={styles.danger} type="button" disabled={archiveLoading || selectedArchivedProductIds.size === 0} onClick={() => void permanentlyDeleteSelected()}>{archiveLoading ? 'Deleting…' : 'Delete selected permanently'}</button></div><div className={styles.stockTableScroll}><table className={styles.stockTable}><caption className={styles.visuallyHidden}>Archived products and recovery actions</caption><thead><tr><th scope="col" className={styles.selectionColumn}>Select</th><th scope="col">Stock Name</th><th scope="col">Stocks</th><th scope="col">Sold</th><th scope="col">Updated Price</th><th scope="col">Actions</th></tr></thead><tbody>{archivedProducts.map((product) => <tr key={product.id}><td data-label="Select" className={styles.selectionColumn}><input type="checkbox" checked={selectedArchivedProductIds.has(product.id)} onChange={() => toggleArchivedProduct(product.id)} aria-label={`Select archived product ${product.name}`} /></td><th scope="row"><span className={styles.stockTableName}>{product.name}</span><span className={styles.stockTableCategory}>{product.category}</span><span className={styles.archived}>{product.deletedAt ? `Deleted ${new Date(product.deletedAt).toLocaleDateString()}` : `Archived ${product.archivedAt ? new Date(product.archivedAt).toLocaleDateString() : ''}`}</span></th><td data-label="Stocks">{product.stockQuantity}</td><td data-label="Sold">—</td><td data-label="Updated Price">₱{product.price}</td><td data-label="Actions"><div className={styles.stockTableActions}><button className={styles.secondary} type="button" disabled={archiveLoading} onClick={() => void restore(product)}>Restore</button><button className={styles.danger} type="button" disabled={archiveLoading} onClick={() => void permanentlyDelete(product)}>Delete permanently</button></div></td></tr>)}</tbody></table></div></>}
      {stockError && <p className={styles.error} role="alert">{stockError}</p>}
      {stockNotice && <p className={styles.notice} role="status">{stockNotice}</p>}
    </section>}
    {section === 'settings' && <section id="settings-panel" className={styles.settingsCard} aria-labelledby="settings-heading" role="tabpanel">
      <div><h2 id="settings-heading">Settings</h2><p>Manage your stock, profit adjustment, and purchase-history data.</p></div>
      <form className={styles.productForm} onSubmit={(event) => void saveProfitAdjustment(event)} noValidate>
        <div><h3>Manual profit adjustment</h3><p>Add or deduct an all-time amount from the calculated dashboard profit.</p></div>
        <label htmlFor="profit-operation">Adjustment</label>
        <select id="profit-operation" value={profitOperation} onChange={(event) => setProfitOperation(event.target.value as 'add' | 'deduct')}><option value="add">Add profit</option><option value="deduct">Deduct profit</option></select>
        <label htmlFor="profit-amount">Amount</label>
        <input id="profit-amount" inputMode="decimal" placeholder="0.00" value={profitAmount} onChange={(event) => setProfitAmount(event.target.value)} required />
        <label htmlFor="profit-note">Note (optional)</label>
        <textarea id="profit-note" maxLength={2000} value={profitNote} onChange={(event) => setProfitNote(event.target.value)} rows={3} />
        {profitError && <p className={styles.error} role="alert">{profitError}</p>}
        {profitNotice && <p className={styles.notice} role="status">{profitNotice}</p>}
        <div className={styles.formActions}><button type="submit" disabled={profitLoading}>{profitLoading ? 'Saving…' : 'Save adjustment'}</button></div>
      </form>
      <section className={styles.profitHistory} aria-labelledby="profit-history-heading">
        <div><h3 id="profit-history-heading">Adjustment history</h3><p>Removing an entry reverses its add or deduct amount from profit.</p></div>
        {profitAdjustments.length === 0 ? <p className={styles.empty}>No profit adjustments yet.</p> : <>
          <div className={styles.selectionToolbar}>
            <label className={styles.selectAllLabel}><input type="checkbox" checked={profitAdjustments.length > 0 && profitAdjustments.every((adjustment) => selectedProfitAdjustmentIds.has(adjustment.id))} onChange={toggleAllProfitAdjustments} aria-label="Select all profit adjustments" /> <span>Select all adjustments</span></label>
            <span className={styles.selectionCount} aria-live="polite">{selectedProfitAdjustmentIds.size} selected</span>
            <button className={styles.danger} type="button" disabled={profitLoading || selectedProfitAdjustmentIds.size === 0} onClick={() => void removeSelectedProfitAdjustments()}>Remove selected</button>
          </div>
          <ul className={styles.profitHistoryList}>{profitAdjustments.map((adjustment) => {
          const isDeduction = adjustment.amount.startsWith('-')
          return <li key={adjustment.id} className={styles.profitHistoryItem}><label className={styles.profitHistoryCheckbox}><input type="checkbox" checked={selectedProfitAdjustmentIds.has(adjustment.id)} onChange={() => toggleProfitAdjustment(adjustment.id)} aria-label={`Select ${isDeduction ? 'deducted' : 'added'} adjustment of ₱${adjustment.amount.replace('-', '')}`} /></label><div><strong>{isDeduction ? 'Deducted' : 'Added'} ₱{adjustment.amount.replace('-', '')}</strong><small>{new Date(adjustment.createdAt).toLocaleString()}{adjustment.note ? ` · ${adjustment.note}` : ''}</small></div><button className={styles.danger} type="button" disabled={profitLoading} onClick={() => void removeProfitAdjustment(adjustment.id)}>Remove</button></li>
        })}</ul></>}
      </section>
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
