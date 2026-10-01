import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import styles from './App.module.css'

type View = 'email' | 'code' | 'signed-in'
type CatalogStatus = 'active' | 'archived'
type Product = { id: string; name: string; category: string; active: boolean; archivedAt: string | null; updatedAt: string }
type Expense = { id: string; productId: string; productName: string; category: string; amount: string; quantity: number; note: string | null; spentAt: string; createdAt: string; updatedAt: string }

const productInputSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.').max(200),
  category: z.string().trim().min(1, 'Category is required.').max(100),
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
    }
  }, [view, catalogStatus])

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
    const parsed = productInputSchema.safeParse({ name: productName, category })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid product name and category.')
      return
    }
    setLoading(true)
    const wasEditing = editing !== null
    try {
      const response = await productsApi(editing ? `/${editing.id}` : '', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(editing ? { ...parsed.data, updatedAt: editing.updatedAt } : parsed.data),
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
      await loadProducts()
      setCatalogNotice(wasEditing ? 'Product changes saved.' : 'Product added.')
    } catch {
      setCatalogError('Unable to contact the catalog service. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function archive(product: Product) {
    if (!window.confirm(`Archive ${product.name}? It will remain in your archived catalog.`)) return
    setCatalogError('')
    setCatalogNotice('')
    setArchiveLoadingId(product.id)
    try {
      const response = await productsApi(`/${product.id}`, { method: 'DELETE', body: JSON.stringify({ updatedAt: product.updatedAt }) })
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined
        setCatalogError(body?.error?.message ?? 'Unable to archive the product.')
        if (response.status === 409) await loadProducts()
        return
      }
      await loadProducts()
      setCatalogNotice(`${product.name} was archived.`)
    } catch {
      setCatalogError('Unable to contact the catalog service. Try again.')
    } finally {
      setArchiveLoadingId(null)
    }
  }

  const visibleProducts = products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-live="polite">
        <p className={styles.eyebrow}>SALES TRACKER</p>
        {view === 'signed-in' ? (
          <div className={styles.workspace}>
            <div className={styles.workspaceHeader}>
              <div><h1>Product catalog</h1><p>Create the products and categories you reuse in your sales records.</p></div>
              <button className={styles.secondary} type="button" onClick={() => void logout()}>Sign out</button>
            </div>
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
            {catalogStatus === 'active' && <form className={styles.productForm} onSubmit={saveProduct} noValidate>
              <h2>{editing ? 'Edit product' : 'Add a product'}</h2>
              <label htmlFor="product-name">Product name</label>
              <input id="product-name" value={productName} onChange={(event) => setProductName(event.target.value)} maxLength={200} aria-describedby={fieldError ? 'product-error' : undefined} />
              <label htmlFor="product-category">Category</label>
              <input id="product-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={100} aria-describedby={fieldError ? 'product-error' : undefined} />
              {fieldError && <p id="product-error" className={styles.error} role="alert">{fieldError}</p>}
              <div className={styles.formActions}><button disabled={loading} type="submit">{loading ? 'Saving…' : editing ? 'Save changes' : 'Add product'}</button>{editing && <button className={styles.secondary} type="button" onClick={resetProductForm}>Cancel</button>}</div>
            </form>}
            <label className={styles.searchLabel} htmlFor="product-search">Search {catalogStatus} products</label>
            <input id="product-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or category" />
            {catalogError && <p className={styles.error} role="alert">{catalogError} <button className={styles.linkButton} type="button" onClick={() => void loadProducts()}>Retry</button></p>}
            {catalogNotice && <p className={styles.notice} role="status">{catalogNotice}</p>}
            {catalogLoading ? <p>Loading products…</p> : visibleProducts.length === 0 ? <p className={styles.empty}>No {catalogStatus} products match your search.</p> : <ul className={styles.productList} aria-label={`${catalogStatus} products`}>
              {visibleProducts.map((product) => <li key={product.id} className={styles.productItem}><div><strong>{product.name}</strong><span>{product.category}</span>{!product.active && <span className={styles.archived}>Archived {product.archivedAt ? new Date(product.archivedAt).toLocaleDateString() : ''}</span>}</div>{product.active && <div className={styles.itemActions}><button className={styles.secondary} disabled={loading || archiveLoadingId !== null} type="button" onClick={() => { setEditing(product); setProductName(product.name); setCategory(product.category); setFieldError('') }}>Edit</button><button className={styles.danger} disabled={archiveLoadingId !== null} type="button" onClick={() => void archive(product)}>{archiveLoadingId === product.id ? 'Archiving…' : 'Archive'}</button></div>}</li>)}
            </ul>}
          </div>
        ) : view === 'email' ? (
          <form onSubmit={requestCode}>
            <h1>Sign in without a password</h1>
            <p>Use your email address to receive a one-time code.</p>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <button disabled={loading} type="submit">{loading ? 'Sending…' : 'Send sign-in code'}</button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <h1>Check your email</h1>
            <p>{message}</p>
            <label htmlFor="code">Six-digit code</label>
            <input id="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required />
            <button disabled={loading} type="submit">{loading ? 'Verifying…' : 'Verify code'}</button>
            <button className={styles.secondary} type="button" onClick={() => setView('email')}>Use another email</button>
          </form>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>
    </main>
  )
}

export default App
