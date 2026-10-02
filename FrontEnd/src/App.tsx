import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import styles from './App.module.css'
import type { Dashboard } from './pages/DashboardPage'
import { PurchaseHistoryPage } from './pages/PurchaseHistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { StockTrackerPage } from './pages/StockTrackerPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))

type View = 'email' | 'code' | 'signed-in'
type WorkspaceView = 'dashboard' | 'buy' | 'stock' | 'history' | 'settings'
type CatalogStatus = 'active' | 'archived'
type Product = { id: string; name: string; category: string; price: string; stockQuantity: number; active: boolean; archivedAt: string | null; updatedAt: string }
type Expense = { id: string; productId: string; productName: string; category: string; amount: string; quantity: number; note: string | null; spentAt: string; createdAt: string; updatedAt: string }
const dashboardPointSchema = z.object({ label: z.string(), amount: z.string() })
const dashboardReportSchema = z.object({ total: z.string(), trend: z.array(z.object({ bucket: z.string(), amount: z.string() })), byProduct: z.array(dashboardPointSchema), byCategory: z.array(dashboardPointSchema) })
const dashboardSchema = z.object({ currentMonth: dashboardReportSchema.extend({ from: z.string(), to: z.string() }), allTime: dashboardReportSchema, stock: z.object({ totalUnits: z.number().int().nonnegative(), productsInStock: z.number().int().nonnegative(), productsOutOfStock: z.number().int().nonnegative() }), purchases: z.object({ count: z.number().int().nonnegative(), quantity: z.number().int().nonnegative(), totalCost: z.string() }) })

const productInputSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.').max(200),
  category: z.string().trim().min(1, 'Category is required.').max(100),
  price: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, 'Enter a valid price.').refine((value) => Number(value) > 0, 'Price must be greater than zero.'),
  stockQuantity: z.coerce.number().int('Initial stock must be a whole number.').nonnegative('Initial stock cannot be negative.').max(1_000_000_000, 'Initial stock is too large.'),
})
const expenseInputSchema = z.object({
  productId: z.string().uuid('Select a product.'),
  amount: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, 'Enter an amount with up to two decimal places.').refine((value) => Number(value) > 0, 'Amount must be greater than zero.'),
  quantity: z.coerce.number().int('Quantity must be a whole number.').positive('Quantity must be greater than zero.'),
  note: z.string().trim().max(2000, 'Note is too long.'),
  spentAt: z.string().min(1, 'Purchase date is required.'),
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

async function dashboardApi(): Promise<Response> {
  return fetch('/api/dashboard', { credentials: 'include' })
}

function NavIcon({ name }: { name: WorkspaceView | 'settings' }) {
  const paths: Record<string, string> = {
    dashboard: 'M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z',
    buy: 'M3 5h18v14H3V5Zm4 4h10M7 13h4M7 16h7',
    stock: 'M4 19V9l8-5 8 5v10H4Zm4 0v-6h8v6M8 9h.01M12 9h.01M16 9h.01',
    history: 'M5 4h14v16H5V4Zm3 4h8M8 12h8M8 16h5',
    settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12v2m0 13v2m8.5-8.5h-2m-13 0h-2m15.01-6.01-1.42 1.42M6.91 17.09l-1.42 1.42m13.02 0-1.42-1.42M6.91 6.91 5.49 5.49',
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
  const [products, setProducts] = useState<Product[]>([])
  const [activeProducts, setActiveProducts] = useState<Product[]>([])
  const [archivedProducts, setArchivedProducts] = useState<Product[]>([])
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('active')
  const [search, setSearch] = useState('')
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [stockQuantity, setStockQuantity] = useState('0')
  const [editing, setEditing] = useState<Product | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [catalogNotice, setCatalogNotice] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [archiveLoadingId, setArchiveLoadingId] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expenseProductId, setExpenseProductId] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseQuantity, setExpenseQuantity] = useState('1')
  const [expenseNote, setExpenseNote] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [expenseFilterProduct, setExpenseFilterProduct] = useState('')
  const [expenseFilterFrom, setExpenseFilterFrom] = useState('')
  const [expenseFilterTo, setExpenseFilterTo] = useState('')
  const [expenseLoading, setExpenseLoading] = useState(false)
  const [expenseError, setExpenseError] = useState('')
  const [expenseNotice, setExpenseNotice] = useState('')
  const [expenseFieldError, setExpenseFieldError] = useState('')
  const [expenseDeleteLoadingId, setExpenseDeleteLoadingId] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [stockRefreshKey, setStockRefreshKey] = useState(0)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('dashboard')
  const dashboardRequestId = useRef(0)
  const productRequestId = useRef(0)

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
      void loadExpenses()
      void loadDashboard()
    }
  }, [view, catalogStatus])

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

  async function loadProducts(status = catalogStatus): Promise<Product[]> {
    const requestId = ++productRequestId.current
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const response = await productsApi(`?status=${status}`)
      if (!response.ok) throw new Error('Unable to load products.')
      const data = await response.json() as { products: Product[] }
      if (!Array.isArray(data.products)) throw new Error('Invalid product response.')
      if (status === 'active') setActiveProducts(data.products)
      if (status === 'archived') setArchivedProducts(data.products)
      if (requestId === productRequestId.current) setProducts(data.products)
      return data.products
    } catch {
      if (requestId === productRequestId.current) setCatalogError('Unable to load products. Try again.')
      return []
    } finally {
      if (requestId === productRequestId.current) setCatalogLoading(false)
    }
  }

  async function loadExpenses(): Promise<Expense[]> {
    setExpenseLoading(true)
    setExpenseError('')
    if (expenseFilterFrom && expenseFilterTo && expenseFilterFrom > expenseFilterTo) {
      setExpenseError('The start date must be on or before the end date.')
      setExpenseLoading(false)
      return []
    }
    const params = new URLSearchParams()
    if (expenseFilterProduct) params.set('productId', expenseFilterProduct)
    if (expenseFilterFrom) params.set('from', `${expenseFilterFrom}T00:00:00.000Z`)
    if (expenseFilterTo) {
      const end = new Date(`${expenseFilterTo}T00:00:00.000Z`)
      end.setUTCDate(end.getUTCDate() + 1)
      params.set('to', end.toISOString())
    }
    try {
      const response = await expensesApi(params.size ? `?${params}` : '')
      if (!response.ok) throw new Error('Unable to load expenses.')
      const data = await response.json() as { expenses: Expense[] }
      if (!Array.isArray(data.expenses)) throw new Error('Invalid expense response.')
      setExpenses(data.expenses)
      return data.expenses
    } catch {
      setExpenseError('Unable to load expenses. Try again.')
      return []
    } finally {
      setExpenseLoading(false)
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
    setCategory('')
    setPrice('')
    setStockQuantity('0')
    setFieldError('')
  }

  function resetExpenseForm() {
    setEditingExpense(null)
    setExpenseProductId('')
    setExpenseAmount('')
    setExpenseQuantity('1')
    setExpenseNote('')
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setExpenseFieldError('')
  }

  async function saveExpense(event: FormEvent) {
    event.preventDefault()
    setExpenseFieldError('')
    setExpenseError('')
    setExpenseNotice('')
    const parsed = expenseInputSchema.safeParse({ productId: expenseProductId, amount: expenseAmount, quantity: expenseQuantity, note: expenseNote, spentAt: expenseDate })
    if (!parsed.success) {
      setExpenseFieldError(parsed.error.issues[0]?.message ?? 'Enter valid expense details.')
      return
    }
    setExpenseLoading(true)
    const wasEditing = editingExpense !== null
    try {
      const response = await expensesApi(editingExpense ? `/${editingExpense.id}` : '', {
        method: editingExpense ? 'PUT' : 'POST',
        body: JSON.stringify({ ...parsed.data, spentAt: new Date(`${parsed.data.spentAt}T00:00:00.000Z`).toISOString(), ...(editingExpense ? { updatedAt: editingExpense.updatedAt } : {}) }),
      })
      const body = await response.json().catch(() => undefined) as { expense?: Expense; error?: { code?: string; message?: string } } | undefined
      if (!response.ok) {
        if (body?.error?.code === 'STALE_EXPENSE') {
          setExpenseError('This expense changed elsewhere. The latest ledger has been loaded; review your changes and try again.')
          const latest = await loadExpenses()
          const refreshed = latest.find((expense) => expense.id === editingExpense?.id)
          if (refreshed) setEditingExpense(refreshed)
        } else setExpenseFieldError(body?.error?.message ?? 'Unable to save the expense.')
        return
      }
      resetExpenseForm()
      await loadExpenses()
      await loadDashboard()
      setExpenseNotice(wasEditing ? 'Expense changes saved.' : 'Expense recorded.')
    } catch {
      setExpenseError('Unable to contact the expense service. Try again.')
    } finally {
      setExpenseLoading(false)
    }
  }

  async function deleteExpense(expense: Expense) {
    if (!window.confirm(`Delete the ${expense.amount} expense for ${expense.productName}?`)) return
    setExpenseDeleteLoadingId(expense.id)
    setExpenseError('')
    setExpenseNotice('')
    try {
      const response = await expensesApi(`/${expense.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Unable to delete the expense.')
      await loadExpenses()
      await loadDashboard()
      setExpenseNotice('Expense deleted.')
    } catch {
      setExpenseError('Unable to delete the expense. Try again.')
    } finally {
      setExpenseDeleteLoadingId(null)
    }
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault()
    setFieldError('')
    setCatalogError('')
    setCatalogNotice('')
    const parsed = productInputSchema.safeParse({ name: productName, category, price, stockQuantity: editing ? 0 : stockQuantity })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid product name and category.')
      return
    }
    setLoading(true)
    const wasEditing = editing !== null
    try {
      const response = await productsApi(editing ? `/${editing.id}` : '', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(editing ? { name: parsed.data.name, category: parsed.data.category, price: parsed.data.price, updatedAt: editing.updatedAt } : parsed.data),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { error?: { code?: string; message?: string } } | undefined
        if (body?.error?.code === 'STALE_PRODUCT') {
          setCatalogError('This product changed elsewhere. The latest catalog has been loaded; review your changes and try again.')
          const latest = await loadProducts()
          const refreshed = latest.find((product) => product.id === editing?.id)
          if (refreshed) setEditing(refreshed)
        } else setFieldError(body?.error?.message ?? 'Unable to save the product.')
        return
      }
      resetProductForm()
      setProductModalOpen(false)
      await loadProducts()
      setStockRefreshKey((value) => value + 1)
      setCatalogNotice(wasEditing ? 'Product changes saved.' : 'Product added.')
    } catch {
      setCatalogError('Unable to contact the catalog service. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function archive(product: Product) {
    if (!window.confirm(`Delete ${product.name}? It will be removed from active stock and kept in your archived catalog.`)) return
    setCatalogError('')
    setCatalogNotice('')
    setArchiveLoadingId(product.id)
    try {
      const response = await productsApi(`/${product.id}`, { method: 'DELETE', body: JSON.stringify({ updatedAt: product.updatedAt }) })
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
        setCatalogError(body?.error?.message ?? 'Unable to delete the stock.')
        if (response.status === 409) await loadProducts()
        return
      }
      await loadProducts()
      setStockRefreshKey((value) => value + 1)
      setCatalogNotice(`${product.name} was deleted from active stock.`)
    } catch {
      setCatalogError('Unable to contact the stock service. Try again.')
    } finally {
      setArchiveLoadingId(null)
    }
  }

  function editStock(product: { id: string; name: string; category: string; price: string; stockQuantity: number; updatedAt: string }) {
    setEditing({ ...product, active: true, archivedAt: null })
    setProductName(product.name)
    setCategory(product.category)
    setPrice(product.price)
    setFieldError('')
    setProductModalOpen(true)
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

  const visibleProducts = products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <main className={styles.shell}>
      <section className={view === 'signed-in' ? styles.appFrame : styles.card} aria-live="polite">
        {view === 'signed-in' ? (
          <div className={styles.workspaceLayout}>
            <aside className={styles.sidebar} aria-label="Sales V1 navigation">
              <div className={styles.brand}><span className={styles.brandMark}>S</span><span>Sales V1</span></div>
              <nav className={styles.sidebarNav} aria-label="Workspace views">
                <button type="button" aria-current={workspaceView === 'dashboard' ? 'page' : undefined} className={workspaceView === 'dashboard' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('dashboard')}><NavIcon name="dashboard" /><span>Dashboard</span></button>
                <button type="button" aria-current={workspaceView === 'buy' ? 'page' : undefined} className={workspaceView === 'buy' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('buy')}><NavIcon name="buy" /><span>Buy</span></button>
                <button type="button" aria-current={workspaceView === 'stock' ? 'page' : undefined} className={workspaceView === 'stock' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('stock')}><NavIcon name="stock" /><span>Stocks</span></button>
                <button type="button" aria-current={workspaceView === 'history' ? 'page' : undefined} className={workspaceView === 'history' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('history')}><NavIcon name="history" /><span>Purchase History</span></button>
                <button type="button" aria-current={workspaceView === 'settings' ? 'page' : undefined} className={workspaceView === 'settings' ? styles.selectedSidebarItem : styles.sidebarItem} onClick={() => setWorkspaceView('settings')}><NavIcon name="settings" /><span>Settings</span></button>
              </nav>
              <button className={styles.sidebarSettings} type="button" onClick={() => void logout()}><NavIcon name="settings" /><span>Sign out</span></button>
            </aside>
            <div className={styles.workspaceMain}>
            <div className={styles.workspaceHeader}>
              <div><p className={styles.dateLabel}>{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p><h1>{workspaceView === 'dashboard' ? 'Dashboard' : workspaceView === 'buy' ? 'Buy stock' : workspaceView === 'stock' ? 'Stocks' : workspaceView === 'settings' ? 'Settings' : 'Purchase history'}</h1><p>Welcome back — here’s your sales overview.</p></div>
              <div className={styles.profile}><span className={styles.avatar}>A</span><span><strong>Account owner</strong><small>Sales manager</small></span></div>
            </div>
            {workspaceView === 'buy' && <StockTrackerPage mode="buy" onChanged={() => void loadDashboard()} refreshKey={stockRefreshKey} />}
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
                    <label htmlFor="stock-product-name">Stock name</label>
                    <input id="stock-product-name" autoFocus value={productName} onChange={(event) => setProductName(event.target.value)} maxLength={200} aria-describedby={fieldError ? 'stock-product-error' : undefined} />
                    <label htmlFor="stock-category">Category</label>
                    <input id="stock-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={100} aria-describedby={fieldError ? 'stock-product-error' : undefined} />
                    <label htmlFor="stock-price">Unit price</label>
                    <input id="stock-price" inputMode="decimal" placeholder="0.00" value={price} onChange={(event) => setPrice(event.target.value)} aria-describedby={fieldError ? 'stock-product-error' : undefined} />
                    {!editing && <><label htmlFor="initial-stock">Initial quantity</label>
                    <input id="initial-stock" type="number" min="0" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} aria-describedby={fieldError ? 'stock-product-error' : undefined} /></>}
                    {fieldError && <p id="stock-product-error" className={styles.error} role="alert">{fieldError}</p>}
                    <div className={styles.formActions}><button disabled={loading} type="submit">{loading ? 'Saving…' : editing ? 'Save changes' : 'Add stock'}</button><button className={styles.secondary} type="button" onClick={() => { resetProductForm(); setProductModalOpen(false) }}>Cancel</button></div>
                  </form>
                </section>
              </div>}
              <StockTrackerPage mode="stock" onChanged={() => void loadDashboard()} refreshKey={stockRefreshKey} onEdit={editStock} onDelete={(product) => void archive({ ...product, active: true, archivedAt: null })} />
            </>}
            {workspaceView === 'history' && <PurchaseHistoryPage refreshKey={historyRefreshKey} onChanged={refreshAfterHistoryDeletion} />}
            {workspaceView === 'settings' && <SettingsPage onStockDeleted={refreshAfterStockDeletion} onHistoryChanged={refreshAfterHistoryDeletion} />}
            {workspaceView === 'dashboard' && <>
            <Suspense fallback={<section className={styles.dashboard}><p>Loading dashboard…</p></section>}><DashboardPage dashboard={dashboard} loading={dashboardLoading} error={dashboardError} onRetry={() => void loadDashboard()} /></Suspense>
            <div className={styles.tabs} role="group" aria-label="Catalog status">
              <button type="button" aria-pressed={catalogStatus === 'active'} className={catalogStatus === 'active' ? styles.selectedTab : styles.tab} onClick={() => setCatalogStatus('active')}>Active</button>
              <button type="button" aria-pressed={catalogStatus === 'archived'} className={catalogStatus === 'archived' ? styles.selectedTab : styles.tab} onClick={() => setCatalogStatus('archived')}>Archived</button>
            </div>
            <section className={styles.ledger} aria-labelledby="expense-heading">
              <h2 id="expense-heading">Expense ledger</h2>
              <p>Record what you spent; historical product details are preserved automatically.</p>
              <form className={styles.productForm} onSubmit={saveExpense} noValidate>
                <h3>{editingExpense ? 'Edit expense' : 'Record an expense'}</h3>
                <label htmlFor="expense-product">Product</label>
                <select id="expense-product" value={expenseProductId} onChange={(event) => setExpenseProductId(event.target.value)}>
                  <option value="">Select an active product</option>
                  {activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.category}</option>)}
                  {editingExpense && archivedProducts.some((product) => product.id === editingExpense.productId) && <option value={editingExpense.productId}>{editingExpense.productName} — archived historical product</option>}
                </select>
                <label htmlFor="expense-amount">Amount</label>
                <input id="expense-amount" inputMode="decimal" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="0.00" aria-describedby={expenseFieldError ? 'expense-error' : undefined} />
                <label htmlFor="expense-quantity">Quantity</label>
                <input id="expense-quantity" type="number" min="1" step="1" value={expenseQuantity} onChange={(event) => setExpenseQuantity(event.target.value)} aria-describedby={expenseFieldError ? 'expense-error' : undefined} />
                <label htmlFor="expense-date">Purchase date</label>
                <input id="expense-date" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
                <label htmlFor="expense-note">Note <span>(optional)</span></label>
                <textarea id="expense-note" value={expenseNote} onChange={(event) => setExpenseNote(event.target.value)} maxLength={2000} rows={2} />
                {expenseFieldError && <p id="expense-error" className={styles.error} role="alert">{expenseFieldError}</p>}
                <div className={styles.formActions}><button disabled={expenseLoading} type="submit">{expenseLoading ? 'Saving…' : editingExpense ? 'Save changes' : 'Record expense'}</button>{editingExpense && <button className={styles.secondary} type="button" onClick={resetExpenseForm}>Cancel</button>}</div>
              </form>
              <div className={styles.filters} aria-label="Expense filters">
                <label htmlFor="expense-filter-product">Filter by product</label>
                <select id="expense-filter-product" value={expenseFilterProduct} onChange={(event) => setExpenseFilterProduct(event.target.value)}><option value="">All products</option>{[...activeProducts, ...archivedProducts].map((product) => <option key={product.id} value={product.id}>{product.name}{product.active ? '' : ' (archived)'}</option>)}</select>
                <label htmlFor="expense-filter-from">From</label><input id="expense-filter-from" type="date" value={expenseFilterFrom} onChange={(event) => setExpenseFilterFrom(event.target.value)} />
                <label htmlFor="expense-filter-to">To</label><input id="expense-filter-to" type="date" value={expenseFilterTo} onChange={(event) => setExpenseFilterTo(event.target.value)} />
                <button className={styles.secondary} type="button" onClick={() => void loadExpenses()}>Apply filters</button>
              </div>
              {expenseError && <p className={styles.error} role="alert">{expenseError} <button className={styles.linkButton} type="button" onClick={() => void loadExpenses()}>Retry</button></p>}
              {expenseNotice && <p className={styles.notice} role="status">{expenseNotice}</p>}
              {expenseLoading ? <p>Loading expenses…</p> : expenses.length === 0 ? <p className={styles.empty}>No expenses match these filters.</p> : <ul className={styles.productList} aria-label="Expenses">{expenses.map((expense) => <li key={expense.id} className={styles.productItem}><div><strong>{expense.amount} × {expense.quantity} — {expense.productName}</strong><span>{expense.category} · {new Date(expense.spentAt).toLocaleDateString()}</span>{expense.note && <span>{expense.note}</span>}</div><div className={styles.itemActions}><button className={styles.secondary} disabled={expenseDeleteLoadingId !== null} type="button" onClick={() => { setEditingExpense(expense); setExpenseProductId(expense.productId); setExpenseAmount(expense.amount); setExpenseQuantity(String(expense.quantity)); setExpenseNote(expense.note ?? ''); setExpenseDate(expense.spentAt.slice(0, 10)); setExpenseFieldError('') }}>Edit</button><button className={styles.danger} disabled={expenseDeleteLoadingId !== null} type="button" onClick={() => void deleteExpense(expense)}>{expenseDeleteLoadingId === expense.id ? 'Deleting…' : 'Delete'}</button></div></li>)}</ul>}
            </section>
            <label className={styles.searchLabel} htmlFor="product-search">Search {catalogStatus} products</label>
            <input id="product-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or category" />
            {catalogError && <p className={styles.error} role="alert">{catalogError} <button className={styles.linkButton} type="button" onClick={() => void loadProducts()}>Retry</button></p>}
            {catalogNotice && <p className={styles.notice} role="status">{catalogNotice}</p>}
            {catalogLoading ? <p>Loading products…</p> : visibleProducts.length === 0 ? <p className={styles.empty}>No {catalogStatus} products match your search.</p> : <ul className={styles.productList} aria-label={`${catalogStatus} products`}>
              {visibleProducts.map((product) => <li key={product.id} className={styles.productItem}><div><strong>{product.name}</strong><span>{product.category} · ₱{product.price} each</span>{!product.active && <span className={styles.archived}>Archived {product.archivedAt ? new Date(product.archivedAt).toLocaleDateString() : ''}</span>}</div>{product.active && <div className={styles.itemActions}><button className={styles.secondary} disabled={loading || archiveLoadingId !== null} type="button" onClick={() => { setEditing(product); setProductName(product.name); setCategory(product.category); setPrice(product.price); setFieldError('') }}>Edit</button><button className={styles.danger} disabled={archiveLoadingId !== null} type="button" onClick={() => void archive(product)}>{archiveLoadingId === product.id ? 'Archiving…' : 'Archive'}</button></div>}</li>)}
            </ul>}
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
