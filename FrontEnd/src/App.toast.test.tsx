// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ToastProvider } from './components/Toast/ToastProvider'

const product = { imageUrl: 'https://res.cloudinary.com/test/shirt.png', id: 'stock-id', name: 'Shirt', category: 'Clothing', price: '10.00', originalPrice: null, stockQuantity: 2, updatedAt: '2026-11-03T00:00:00.000Z' }
const report = { total: '0.00', trend: [], byProduct: [], byCategory: [] }

vi.mock('./pages/StockTrackerPage', () => ({ StockTrackerPage: ({ onEdit, onDelete }: { onEdit: (value: typeof product) => void; onDelete: (value: typeof product) => void }) => <><button onClick={() => onEdit(product)}>Edit sample</button><button onClick={() => onDelete(product)}>Delete sample</button></> }))
vi.mock('./pages/DashboardPage', () => ({ DashboardPage: () => <div>Dashboard ready</div> }))

describe('App stock toast integration', () => {
  let container: HTMLDivElement
  let root: Root
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    window.localStorage.clear()
    vi.stubGlobal('confirm', () => true)
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:photo'); static revokeObjectURL = vi.fn() })
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url === '/api/auth/session') return Response.json({ authenticated: true })
      if (url === '/api/dashboard') return Response.json({ currentMonth: { ...report, from: '', to: '' }, allTime: report, stock: { totalUnits: 2, productsInStock: 1, productsOutOfStock: 0 }, purchases: { count: 0, quantity: 0, totalCost: '0.00' }, totalEarnings: '0.00', profit: '0.00' })
      return Response.json({ products: [product], product })
    })
    vi.stubGlobal('fetch', fetchMock)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(<ToastProvider><App /></ToastProvider>))
    await click('Stocks')
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  async function click(label: string) {
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label || item.getAttribute('aria-label') === label)
    expect(button, label).toBeDefined()
    await act(async () => button!.click())
  }

  async function fill(id: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(`#${id}`)!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function notificationText() {
    return container.querySelector('[aria-label="Notifications"]')!.textContent
  }

  it('toasts a stock addition without changing the POST payload', async () => {
    await click('Add new stock')
    await fill('stock-product-name', 'Hat')
    await fill('stock-category', 'Clothing')
    await fill('stock-price', '12.50')
    await act(async () => container.querySelector<HTMLInputElement>('#initial-stock-deduction-no')!.click())
    await click('Add stock')
    expect(notificationText()).toContain('1 stock added.')
    const request = fetchMock.mock.calls.find(([url, options]) => url === '/api/products' && options?.method === 'POST')!
    expect(JSON.parse(request[1]!.body as string)).toEqual({ name: 'Hat', category: 'Clothing', price: '12.50', stockQuantity: 0 })
  })

  it('toasts an edit while preserving the optimistic-concurrency payload', async () => {
    await click('Edit sample')
    await click('Save changes')
    expect(notificationText()).toContain('Stock updated.')
    const request = fetchMock.mock.calls.find(([url, options]) => url === '/api/products/stock-id' && options?.method === 'PUT')!
    expect(JSON.parse(request[1]!.body as string)).toEqual({ name: product.name, category: product.category, price: product.price, updatedAt: product.updatedAt })
  })

  async function selectPhoto() {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { value: [new File(['photo'], 'photo.png', { type: 'image/png' })] })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  }

  it('preserves the edit photo, sends FormData without a Content-Type, and toasts upload warnings', async () => {
    await click('Edit sample')
    expect(container.querySelector('img')?.getAttribute('src')).toBe(product.imageUrl)
    await selectPhoto()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:photo')
    fetchMock.mockResolvedValueOnce(Response.json({ product, warning: 'Product details saved, but the photo could not be uploaded. Please try again.' }))
    await click('Save changes')
    const request = fetchMock.mock.calls.find(([url, options]) => url === '/api/products/stock-id' && options?.method === 'PUT')!
    expect(request[1]!.body).toBeInstanceOf(FormData)
    expect((request[1]!.body as FormData).get('image')).toBeInstanceOf(File)
    expect(request[1]!.headers).toEqual({})
    expect(notificationText()).toContain('photo could not be uploaded')
    expect(notificationText()).toContain('Stock updated.')
    await click('Add new stock')
    expect(container.querySelector('img')).toBeNull()
  })

  it('removes a photo with a JSON flag and resets a canceled preview', async () => {
    await click('Edit sample')
    await click('Remove photo')
    await click('Save changes')
    const request = fetchMock.mock.calls.find(([url, options]) => url === '/api/products/stock-id' && options?.method === 'PUT')!
    expect(JSON.parse(request[1]!.body as string)).toMatchObject({ removeImage: true, updatedAt: product.updatedAt })
    await click('Add new stock')
    await selectPhoto()
    await click('Cancel')
    await click('Add new stock')
    expect(container.querySelector('img')).toBeNull()
  })

  it('toasts deletion only after the DELETE succeeds', async () => {
    await click('Delete sample')
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Delete Shirt?')
    expect(document.activeElement).toBe(container.querySelector('button[aria-label="Cancel archive"]'))
    await click('Delete')
    expect(notificationText()).toContain('Shirt removed from active stock.')
    const request = fetchMock.mock.calls.find(([url, options]) => url === '/api/products/stock-id' && options?.method === 'DELETE')!
    expect(JSON.parse(request[1]!.body as string)).toEqual({ updatedAt: product.updatedAt })
    expect(request[1]!.credentials).toBe('include')
    expect(request[1]!.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('shows an error and no success toast on an HTTP failure', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: 'Stock could not be deleted.' } }, { status: 500 }))
    await click('Delete sample')
    await click('Delete')
    expect(notificationText()).toContain('Stock could not be deleted.')
    expect(notificationText()).not.toContain('Success')
  })

  it('shows an error on a network failure and uses the dark-mode theme scope', async () => {
    await click('Switch to dark mode')
    const viewport = container.querySelector('[aria-label="Notifications"]')!
    expect(viewport.parentElement!.className).toMatch(/darkMode/)
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await click('Delete sample')
    await click('Delete')
    expect(notificationText()).toContain('Unable to contact the stock service. Try again.')
    expect(notificationText()).not.toContain('Success')
  })

  it('keeps archive confirmation keyboard-accessible without calling DELETE on Escape', async () => {
    await click('Delete sample')
    const dialog = container.querySelector<HTMLElement>('[data-archive-confirmation]')!
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')]
    expect(document.activeElement).toBe(buttons[0])
    buttons[1].focus()
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    expect(document.activeElement).toBe(buttons[0])
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(container.querySelector('[data-archive-confirmation]')).toBeNull()
    expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/products/stock-id' && options?.method === 'DELETE')).toBe(false)
  })

  it('uses one bulk creation request for multiple stocks', async () => {
    await click('Add new stock')
    await click('Multiple')
    const textarea = container.querySelector<HTMLTextAreaElement>('#bulk-stock-names')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Hat\nScarf')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await fill('stock-category', 'Clothing')
    await fill('stock-price', '12.50')
    await act(async () => container.querySelector<HTMLInputElement>('#initial-stock-deduction-no')!.click())
    fetchMock.mockResolvedValueOnce(Response.json({ products: [product, product] }))
    await click('Add stocks')
    expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/products/bulk' && options?.method === 'POST')).toBe(true)
    expect(notificationText()).toContain('2 stocks added.')
  })

  it('reports session-service HTTP failures without treating ordinary unauthenticated sessions as errors', async () => {
    fetchMock.mockImplementationOnce(async () => Response.json({}, { status: 503 }))
    await act(async () => root.render(<ToastProvider key="session-error"><App /></ToastProvider>))
    expect(notificationText()).toContain('Unable to contact the sign-in service. Try again.')
    fetchMock.mockImplementationOnce(async () => Response.json({ authenticated: false }))
    await act(async () => root.render(<ToastProvider key="signed-out"><App /></ToastProvider>))
    expect(notificationText()).toBe('')
  })
})