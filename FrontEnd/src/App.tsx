import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import styles from './App.module.css'
import type { Dashboard } from './pages/DashboardPage'
import { DashboardStockTable } from './pages/DashboardStockTable'
import { Camellia } from './components/camellia/Camellia'
import { GuidePage } from './pages/GuidePage'
import { MotivationPage } from './pages/MotivationPage'
import { NotesPage } from './pages/NotesPage'
import { PurchaseHistoryPage } from './pages/PurchaseHistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { StockTrackerPage } from './pages/StockTrackerPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))

type View = 'email' | 'code' | 'signed-in'
type WorkspaceView = 'dashboard' | 'buy' | 'stock' | 'history' | 'notes' | 'settings' | 'guide' | 'motivation' | 'camellia'
type Product = { id: string; name: string; category: string; price: string; stockQuantity: number; active: boolean; archivedAt: string | null; deletedAt: string | null; updatedAt: string }
const dashboardPointSchema = z.object({ label: z.string(), amount: z.string() })
const dashboardReportSchema = z.object({ total: z.string(), trend: z.array(z.object({ bucket: z.string(), amount: z.string() })), byProduct: z.array(dashboardPointSchema), byCategory: z.array(dashboardPointSchema) })
const dashboardSchema = z.object({ currentMonth: dashboardReportSchema.extend({ from: z.string(), to: z.string() }), allTime: dashboardReportSchema, stock: z.object({ totalUnits: z.number().int().nonnegative(), productsInStock: z.number().int().nonnegative(), productsOutOfStock: z.number().int().nonnegative() }), purchases: z.object({ count: z.number().int().nonnegative(), quantity: z.number().int().nonnegative(), totalCost: z.string() }), totalEarnings: z.string(), profit: z.string() })

const productInputSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.').max(200),
  category: z.string().trim().min(1, 'Category is required.').max(100),
  price: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, 'Enter a valid price.').refine((value) => Number(value) > 0, 'Price must be greater than zero.'),
  stockQuantity: z.coerce.number().int('Initial stock must be a whole number.').nonnegative('Initial stock cannot be negative.').max(1_000_000_000, 'Initial stock is too large.'),
})

async function authApi(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`/api/auth/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'include',
  })
}

async function productsApi(path = '', options?: RequestInit): Promise<Response> {
  return fetch(`/api/products${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'include',
  })
}

async function expensesApi(path = '', options?: RequestInit): Promise<Response> {
  return fetch(`/api/expenses${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'include',
  })
}

async function notesApi(path = '', options?: RequestInit): Promise<Response> {
  return fetch(`/api/notes${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'include',
  })
}

async function dashboardApi(): Promise<Response> {
  return fetch('/api/dashboard', { credentials: 'include' })
}

function NavIcon({ name }: { name: WorkspaceView | 'settings' }) {
  const paths: Record<string, string> = {
    dashboard: 'M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z',
    buy: 'M3 5h18v14H3V5Zm4 4h10M7 13h4M7 16h7',
    stock: 'M4 19V9l8-5 8 5v10H4Zm4 0v-6h8v6M8 9h.01M12 9h.01M16 9h.01',
    history: 'M5 4h14v16H5V4Zm3 4h8M8 12h8M8 16h5',
    notes: 'M5 4h14v16H5V4Zm3 4h8M8 12h6M8 16h4',
    settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12v2m0 13v2m8.5-8.5h-2m-13 0h-2m15.01-6.01-1.42 1.42M6.91 17.09l-1.42 1.42m13.02 0-1.42-1.42M6.91 6.91 5.49 5.49',
    guide: 'M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22V4.5Zm0 0A2.5 2.5 0 0 1 7.5 7H19M9 11h6M9 15h6',
    motivation: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z',
  }
  return <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>
}

function App() {
  const [view, setView] = useState<View>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [archivedProducts, setArchivedProducts] = useState<Product[]>([])
  const [productName, setProductName] = useState('')
  const [bulkProductNames, setBulkProductNames] = useState('')
  const [bulkAddMode, setBulkAddMode] = useState(false)
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [stockQuantity, setStockQuantity] = useState('0')
  const [deductInitialStock, setDeductInitialStock] = useState<boolean | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [fieldError, setFieldError] = useState('')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [stockRefreshKey, setStockRefreshKey] = useState(0)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [quantityEditProduct, setQuantityEditProduct] = useState<Product | null>(null)
  const [quantityEditRequest, setQuantityEditRequest] = useState(0)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('dashboard')
  const [dashboardSection, setDashboardSection] = useState<'overview' | 'reports'>('overview')
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem('sales-tracker-dark-mode') === 'true'
    } catch {
      return false
    }
  })
  const dashboardRequestId = useRef(0)

  useEffect(() => {
    try {
      window.localStorage.setItem('sales-tracker-dark-mode', String(darkMode))
    } catch {
      // Theme preference remains usable when browser storage is unavailable.
    }
  }, [darkMode])

  useEffect(() => {
    void authApi('session')
      .then(async (response) => {
        if (response.ok && (await response.json()).authenticated) setView('signed-in')
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (view === 'signed-in') {
      void loadProducts('active')
      void loadProducts('archived')
      void loadDashboard()
    }
  }, [view])

  async function loadDashboard() {
    const requestId = ++dashboardRequestId.current
    setDashboardLoading(true)
    setDashboardError('')
    try {
      const response = await dashboardApi()
      if (!response.ok) throw new Error('Unable to load dashboard.')
      const data = dashboardSchema.parse(await response.json()) as Dashboard
      if (requestId === dashboardRequestId.current) setDashboard(data)
    } catch {
      if (requestId === dashboardRequestId.current) {
        setDashboard(null)
        setDashboardError('Unable to load the dashboard. Try again.')
      }
    } finally {
      if (requestId === dashboardRequestId.current) setDashboardLoading(false)
    }
  }

  async function loadProducts(status: 'active' | 'archived' = 'active'): Promise<Product[]> {
    try {
      const response = await productsApi(`?status=${status}`)
      if (!response.ok) throw new Error('Unable to load products.')
      const data = await response.json() as { products: Product[] }
      if (!Array.isArray(data.products)) throw new Error('Invalid product response.')
      if (status === 'archived') setArchivedProducts(data.products)
      return data.products
    } catch {
      return []
    }
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await authApi('request-code', { method: 'POST', body: JSON.stringify({ email }) })
      if (!response.ok) {
        setError('Enter a valid email address.')
        return
      }
      setMessage('If the email is eligible, a sign-in code has been sent.')
      setView('code')
    } catch {
      setError('Unable to contact the sign-in service. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await authApi('verify-code', { method: 'POST', body: JSON.stringify({ email, code }) })
      if (!response.ok) {
        setError('The code could not be verified. Request a new code and try again.')
        return
      }
      setView('signed-in')
      setWorkspaceView('dashboard')
    } catch {
      setError('Unable to contact the sign-in service. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    setError('')
    try {
      const response = await authApi('logout', { method: 'POST' })
      if (!response.ok) {
        setError('Unable to sign out. Try again.')
        return
      }
      setView('email')
      setCode('')
      setMessage('')
    } catch {
      setError('Unable to contact the sign-in service. Try again.')
    }
  }

  function resetProductForm() {
    setEditing(null)
    setProductName('')
    setBulkProductNames('')
    setBulkAddMode(false)
    setCategory('')
    setPrice('')
    setStockQuantity('0')
    setDeductInitialStock(null)
    setFieldError('')
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault()
    setFieldError('')
    const names = editing || !bulkAddMode
      ? [productName]
      : bulkProductNames.split(/\r?\n/).map((name) => name.trim()).filter(Boolean)
    if (names.length === 0) {
      setFieldError('Enter at least one stock name.')
      return
    }
    if (names.length > 50) {
      setFieldError('Add no more than 50 stocks at a time.')
      return
    }
    const parsedProducts = names.map((name) => productInputSchema.safeParse({ name, category, price, stockQuantity: editing ? 0 : stockQuantity }))
    const invalidProduct = parsedProducts.find((parsed) => !parsed.success)
    if (invalidProduct && !invalidProduct.success) {
      setFieldError(invalidProduct.error.issues[0]?.message ?? 'Enter valid stock details.')
      return
    }
    const parsed = parsedProducts[0]
    if (!parsed || !parsed.success) return
    if (!editing && deductInitialStock === null) {
      setFieldError('Choose Yes or No for deducting the initial stock cost.')
      return
    }
    if (!editing && deductInitialStock === true && parsed.data.stockQuantity === 0) {
      setFieldError('Enter an initial quantity before deducting its cost from total earnings.')
      return
    }
    setLoading(true)
    try {
      let createdCount = 0
      for (const parsedProduct of parsedProducts) {
        if (!parsedProduct.success) continue
        const response = await productsApi(editing ? `/${editing.id}` : '', {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(editing ? { name: parsedProduct.data.name, category: parsedProduct.data.category, price: parsedProduct.data.price, updatedAt: editing.updatedAt } : parsedProduct.data),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => undefined) as { error?: { code?: string; message?: string } } | undefined
          if (body?.error?.code === 'STALE_PRODUCT') {
            setFieldError('This stock changed elsewhere. The latest catalog has been loaded; review your changes and try again.')
            const latest = await loadProducts()
            const refreshed = latest.find((product) => product.id === editing?.id)
            if (refreshed) setEditing(refreshed)
          } else if (createdCount > 0) setFieldError(`${createdCount} stock${createdCount === 1 ? '' : 's'} added. ${body?.error?.message ?? 'The remaining stocks could not be added.'}`)
          else setFieldError(body?.error?.message ?? 'Unable to save the stock.')
          return
        }
        createdCount += 1
        if (!editing && deductInitialStock === true) {
          const created = await response.clone().json() as { product?: Product }
          if (!created.product) {
            setFieldError(`${createdCount} stock${createdCount === 1 ? '' : 's'} added, but its deduction could not be recorded.`)
            return
          }
          const expenseResponse = await expensesApi('', {
            method: 'POST',
            body: JSON.stringify({ productId: created.product.id, amount: parsedProduct.data.price, quantity: parsedProduct.data.stockQuantity, note: 'Initial stock deduction', spentAt: new Date().toISOString() }),
          })
          if (!expenseResponse.ok) {
            setFieldError(`${createdCount} stock${createdCount === 1 ? '' : 's'} added, but its deduction could not be recorded.`)
            return
          }
        }
      }
      if (!editing && deductInitialStock === true) await loadDashboard()
      resetProductForm()
      setProductModalOpen(false)
      await loadProducts()
      setStockRefreshKey((value) => value + 1)
    } catch {
      setFieldError('Unable to contact the catalog service. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function archive(product: Product) {
    if (!window.confirm(`Delete ${product.name}? It will be removed from active stock and kept in your archived catalog.`)) return
    try {
      const response = await productsApi(`/${product.id}`, { method: 'DELETE', body: JSON.stringify({ updatedAt: product.updatedAt }) })
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
        setFieldError(body?.error?.message ?? 'Unable to delete the stock.')
        if (response.status === 409) await loadProducts()
        return
      }
      await loadProducts()
      setStockRefreshKey((value) => value + 1)
    } catch {
      setFieldError('Unable to contact the stock service. Try again.')
    }
  }

  function editStock(product: { id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }) {
    setWorkspaceView('stock')
    setEditing({ ...product, active: true, archivedAt: null, deletedAt: null })
    setProductName(product.name)
    setCategory(product.category)
    setPrice(product.price)
    setFieldError('')
    setProductModalOpen(true)
  }

  function editStockQuantity() {
    if (!editing) return
    setQuantityEditProduct(editing)
    setQuantityEditRequest((value) => value + 1)
    setProductModalOpen(false)
    resetProductForm()
  }

  async function refreshAfterStockDeletion() {
    await Promise.all([loadProducts('active'), loadProducts('archived'), loadDashboard()])
    setStockRefreshKey((value) => value + 1)
    setHistoryRefreshKey((value) => value + 1)
  }

  async function refreshAfterHistoryDeletion() {
    await loadDashboard()
    setHistoryRefreshKey((value) => value + 1)
  }

  function refreshStockViews() {
    void loadDashboard()
    setStockRefreshKey((value) => value + 1)
  }

  return (
    <main className={styles.shell}>
      <section className={view === 'signed-in' ? styles.appFrame : styles.card} aria-live="polite">
        {view === 'signed-in' ? (
          <div className={`${styles.workspaceLayout} ${darkMode ? styles.darkMode : ''}`}>
            <aside className={styles.sidebar} aria-label="Sales V1 navigation">
              <div className={styles.brand}><span className={styles.brandMark}>S</span><span>Sales V1</span></div>
              <nav className={styles.sidebarNav} aria-label="Workspace views">
                <button type="button" aria-current={workspaceView === 'dashboard' ? 'page' : undefined} className={workspaceView === 'dashboard' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('dashboard')}><NavIcon name="dashboard" /><span>Dashboard</span></button>
                <button type="button" aria-current={workspaceView === 'buy' ? 'page' : undefined} className={workspaceView === 'buy' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('buy')}><NavIcon name="buy" /><span>Bought</span></button>
                <button type="button" aria-current={workspaceView === 'stock' ? 'page' : undefined} className={workspaceView === 'stock' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('stock')}><NavIcon name="stock" /><span>Stocks</span></button>
                <button type="button" aria-current={workspaceView === 'history' ? 'page' : undefined} className={workspaceView === 'history' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('history')}><NavIcon name="history" /><span>Purchase History</span></button>
                <button type="button" aria-current={workspaceView === 'notes' ? 'page' : undefined} className={workspaceView === 'notes' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('notes')}><NavIcon name="notes" /><span>Notes</span></button>
                <button type="button" aria-current={workspaceView === 'guide' ? 'page' : undefined} className={workspaceView === 'guide' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('guide')}><NavIcon name="guide" /><span>Guide</span></button>
                <button type="button" aria-current={workspaceView === 'motivation' ? 'page' : undefined} className={workspaceView === 'motivation' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('motivation')}><NavIcon name="motivation" /><span>Motivation</span></button>
                <button type="button" aria-current={workspaceView === 'settings' ? 'page' : undefined} className={workspaceView === 'settings' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('settings')}><NavIcon name="settings" /><span>Settings</span></button>
              </nav>
              <button className={`${styles.sidebarSettings} ${styles.sidebarUserCard}`} type="button" onClick={() => void logout()} aria-label="Sign out">
                <span className={styles.sidebarUserAvatar}>A</span>
                <span className={styles.sidebarUserDetails}><strong>Account owner</strong><small>Sales manager</small></span>
                <svg className={styles.sidebarSignOutIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4M9 12h9" /></svg>
              </button>
            </aside>
            <div className={styles.workspaceMain}>
            <div className={styles.workspaceHeader}>
              <div><p className={styles.dateLabel}>{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p><h1>{workspaceView === 'dashboard' ? 'Dashboard' : workspaceView === 'buy' ? 'Bought' : workspaceView === 'stock' ? 'Stocks' : workspaceView === 'notes' ? 'Notes' : workspaceView === 'settings' ? 'Settings' : workspaceView === 'guide' ? 'Guide' : workspaceView === 'motivation' ? 'Motivation' : workspaceView === 'camellia' ? 'Camellia' : 'Purchase history'}</h1>{workspaceView === 'dashboard' && <nav className={styles.dashboardTabs} aria-label="Dashboard views"><button type="button" aria-current={dashboardSection === 'overview' ? 'page' : undefined} className={dashboardSection === 'overview' ? styles.selectedTab : styles.tab} onClick={() => setDashboardSection('overview')}>Overview</button><button type="button" aria-current={dashboardSection === 'reports' ? 'page' : undefined} className={dashboardSection === 'reports' ? styles.selectedTab : styles.tab} onClick={() => setDashboardSection('reports')}>Reports</button></nav>}</div>
              <div className={styles.headerActions}><button className={styles.themeToggle} type="button" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={darkMode} onClick={() => setDarkMode((enabled) => !enabled)}>{darkMode ? '☀ Light' : '☾ Dark'}</button><div className={styles.profile}><span className={styles.avatar}>A</span><span><strong>Account owner</strong><small>Sales manager</small></span></div></div>
            </div>
            {workspaceView === 'buy' && <StockTrackerPage mode="buy" onChanged={refreshStockViews} refreshKey={stockRefreshKey} onReviewStock={() => setWorkspaceView('stock')} />}
            {workspaceView === 'stock' && <>
              <div className={styles.stockActions}>
                <button
                  title="Add New"
                  aria-label="Add new stock"
                  className={styles.addNewButton}
                  type="button"
                  onClick={() => { resetProductForm(); setProductModalOpen(true) }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" strokeWidth="1.5" />
                    <path d="M8 12H16" strokeWidth="1.5" />
                    <path d="M12 16V8" strokeWidth="1.5" />
                  </svg>
                </button>
                <span className={styles.addStockLabel}>Add Stock</span>
              </div>
              {productModalOpen && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductModalOpen(false) }}>
                <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="stock-form-heading">
                  <div className={styles.modalHeader}>
                    <h2 id="stock-form-heading">{editing ? 'Edit stock' : 'Add a stock'}</h2>
                    <button className={styles.modalClose} type="button" aria-label="Close stock dialog" onClick={() => setProductModalOpen(false)}>×</button>
                  </div>
                  <form className={styles.productForm} onSubmit={saveProduct} noValidate>
                    <div className={styles.stockNameHeader}>
                      <label htmlFor={bulkAddMode ? 'bulk-stock-names' : 'stock-product-name'}>{bulkAddMode ? 'Stock names' : 'Stock name'}</label>
                      {!editing && <button className={`${styles.multipleStockButton} ${bulkAddMode ? styles.multipleStockButtonActive : ''}`} id="bulk-stock-mode" type="button" aria-pressed={bulkAddMode} onClick={() => { setBulkAddMode((enabled) => !enabled); setFieldError('') }}>{bulkAddMode ? 'Single' : 'Multiple'}</button>}
                    </div>
                    {bulkAddMode ? <textarea id="bulk-stock-names" autoFocus value={bulkProductNames} onChange={(event) => setBulkProductNames(event.target.value)} placeholder={'One stock name per line\nExample: Red shirt\nBlue shirt'} rows={5} aria-describedby={fieldError ? 'stock-product-error' : undefined} /> : <input id="stock-product-name" autoFocus value={productName} onChange={(event) => setProductName(event.target.value)} maxLength={200} aria-describedby={fieldError ? 'stock-product-error' : undefined} />}
                    <label htmlFor="stock-category">Category</label>
                    <input id="stock-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={100} aria-describedby={fieldError ? 'stock-product-error' : undefined} />
                    <label htmlFor="stock-price">Unit price</label>
                    <input id="stock-price" inputMode="decimal" placeholder="0.00" value={price} onChange={(event) => setPrice(event.target.value)} aria-describedby={fieldError ? 'stock-product-error' : undefined} />
                    {!editing && <><label htmlFor="initial-stock">Initial quantity</label>
                    <input id="initial-stock" type="number" min="0" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} aria-describedby={fieldError ? 'stock-product-error' : undefined} />
                    <label htmlFor="initial-stock-cost">Initial stock cost (optional)</label>
                    <div className={styles.deductionChoice}><span>Deduct from Total Profit?</span><label className={styles.checkboxLabel} htmlFor="initial-stock-deduction-yes"><input id="initial-stock-deduction-yes" type="checkbox" checked={deductInitialStock === true} onChange={() => setDeductInitialStock(true)} /> Yes</label><label className={styles.checkboxLabel} htmlFor="initial-stock-deduction-no"><input id="initial-stock-deduction-no" type="checkbox" checked={deductInitialStock === false} onChange={() => setDeductInitialStock(false)} /> No</label></div></>}
                    {fieldError && <p id="stock-product-error" className={styles.error} role="alert">{fieldError}</p>}
                    <div className={styles.formActions}><button disabled={loading || (!editing && deductInitialStock === null)} type="submit">{loading ? 'Saving…' : editing ? 'Save changes' : bulkAddMode ? 'Add stocks' : 'Add stock'}</button>{editing && <button className={styles.secondary} type="button" onClick={editStockQuantity}>Edit quantity?</button>}<button className={styles.secondary} type="button" onClick={() => { resetProductForm(); setProductModalOpen(false) }}>Cancel</button></div>
                  </form>
                </section>
              </div>}
              <StockTrackerPage mode="stock" onChanged={refreshStockViews} refreshKey={stockRefreshKey} prefillProduct={quantityEditProduct} prefillRequest={quantityEditRequest} onQuantityEditCancel={() => setQuantityEditProduct(null)} onEdit={editStock} onDelete={(product) => void archive({ ...product, active: true, archivedAt: null, deletedAt: null })} />
            </>}
            {workspaceView === 'history' && <PurchaseHistoryPage refreshKey={historyRefreshKey} onChanged={refreshAfterHistoryDeletion} />}
            {workspaceView === 'notes' && <NotesPage api={notesApi} />}
            {workspaceView === 'settings' && <SettingsPage archivedProducts={archivedProducts} onStockDeleted={refreshAfterStockDeletion} onHistoryChanged={refreshAfterHistoryDeletion} />}
            {workspaceView === 'guide' && <GuidePage />}
            {workspaceView === 'motivation' && <MotivationPage onViewCamellia={() => setWorkspaceView('camellia')} />}
            {workspaceView === 'camellia' && <Camellia onBack={() => setWorkspaceView('motivation')} />}
            {workspaceView === 'dashboard' && <>
            <Suspense fallback={<section className={styles.dashboard}><p>Loading dashboard…</p></section>}>
              <DashboardPage dashboard={dashboard} loading={dashboardLoading} error={dashboardError} mode={dashboardSection} onRetry={() => void loadDashboard()}>
                {dashboardSection === 'overview' && <DashboardStockTable
                  refreshKey={stockRefreshKey}
                  onEdit={editStock}
                  onDelete={(product) => void archive({ ...product, active: true, archivedAt: null, deletedAt: null })}
                />}
              </DashboardPage>
            </Suspense>
            </>}
            </div>
          </div>
        ) : view === 'email' ? (
          <><p className={styles.eyebrow}>SALES V1</p>
          <form onSubmit={requestCode}>
            <h1>Sign in without a password</h1>
            <p>Use your email address to receive a one-time code.</p>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <button disabled={loading} type="submit">{loading ? 'Sending…' : 'Send sign-in code'}</button>
          </form>
          </>
        ) : (
          <><p className={styles.eyebrow}>SALES V1</p>
          <form onSubmit={verifyCode}>
            <h1>Check your email</h1>
            <p>{message}</p>
            <label htmlFor="code">Six-digit code</label>
            <input id="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required />
            <button disabled={loading} type="submit">{loading ? 'Verifying…' : 'Verify code'}</button>
            <button className={styles.secondary} type="button" onClick={() => setView('email')}>Use another email</button>
          </form>
          </>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>
    </main>
  )
}

export default App
