import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import styles from './App.module.css'

type View = 'email' | 'code' | 'signed-in'
type CatalogStatus = 'active' | 'archived'
type Product = { id: string; name: string; category: string; active: boolean; archivedAt: string | null; updatedAt: string }

const productInputSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.').max(200),
  category: z.string().trim().min(1, 'Category is required.').max(100),
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

function App() {
  const [view, setView] = useState<View>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('active')
  const [search, setSearch] = useState('')
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [catalogNotice, setCatalogNotice] = useState('')
  const [fieldError, setFieldError] = useState('')
  const productRequestId = useRef(0)

  useEffect(() => {
    void authApi('session')
      .then(async (response) => {
        if (response.ok && (await response.json()).authenticated) setView('signed-in')
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (view === 'signed-in') void loadProducts(catalogStatus)
  }, [view, catalogStatus])

  async function loadProducts(status = catalogStatus): Promise<Product[]> {
    const requestId = ++productRequestId.current
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const response = await productsApi(`?status=${status}`)
      if (!response.ok) throw new Error('Unable to load products.')
      const data = await response.json() as { products: Product[] }
      if (requestId === productRequestId.current) setProducts(data.products)
      return data.products
    } catch {
      if (requestId === productRequestId.current) setCatalogError('Unable to load products. Try again.')
      return []
    } finally {
      if (requestId === productRequestId.current) setCatalogLoading(false)
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
    }
  }

  const visibleProducts = products.filter((product) => `${product.name} ${product.category}`.includes(search.trim().toLowerCase()))

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
            <div className={styles.tabs} role="tablist" aria-label="Catalog status">
              <button type="button" role="tab" aria-selected={catalogStatus === 'active'} className={catalogStatus === 'active' ? styles.selectedTab : styles.tab} onClick={() => setCatalogStatus('active')}>Active</button>
              <button type="button" role="tab" aria-selected={catalogStatus === 'archived'} className={catalogStatus === 'archived' ? styles.selectedTab : styles.tab} onClick={() => setCatalogStatus('archived')}>Archived</button>
            </div>
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
              {visibleProducts.map((product) => <li key={product.id} className={styles.productItem}><div><strong>{product.name}</strong><span>{product.category}</span>{!product.active && <span className={styles.archived}>Archived {product.archivedAt ? new Date(product.archivedAt).toLocaleDateString() : ''}</span>}</div>{product.active && <div className={styles.itemActions}><button className={styles.secondary} type="button" onClick={() => { setEditing(product); setProductName(product.name); setCategory(product.category); setFieldError('') }}>Edit</button><button className={styles.danger} type="button" onClick={() => void archive(product)}>Archive</button></div>}</li>)}
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
