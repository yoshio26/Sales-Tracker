// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast/ToastProvider'
import { DashboardStockTable } from './DashboardStockTable'
import { StockTrackerPage } from './StockTrackerPage'
import { PurchaseHistoryPage } from './PurchaseHistoryPage'
import { SettingsPage } from './SettingsPage'

const product = { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Shirt', category: 'Clothes', price: '10.00', originalPrice: null, stockQuantity: 4, updatedAt: '2026-11-11T00:00:00.000Z', imageUrl: 'https://res.cloudinary.com/test/current.png' }
const purchase = { id: '123e4567-e89b-12d3-a456-426614174001', productId: product.id, productName: 'Old Shirt', category: 'Old Clothes', quantity: 1, totalCost: '10.00', purchasedAt: product.updatedAt, imageUrl: 'https://res.cloudinary.com/test/snapshot.png' }

describe('product photo page renderers', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.includes('/purchases') ? { purchases: [purchase] } : { products: [product] })))
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals() })
  async function render(children: React.ReactNode) { await act(async () => root.render(<ToastProvider>{children}</ToastProvider>)) }
  async function click(text: string) {
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === text)!
    expect(button).toBeDefined()
    await act(async () => button.click())
  }
  function sources() { return [...container.querySelectorAll('img')].map((image) => image.getAttribute('src')) }

  it('renders dashboard photos and preserves them in edit callbacks', async () => {
    const edit = vi.fn()
    await render(<DashboardStockTable onEdit={edit} onDelete={vi.fn()} onAddStock={vi.fn()} />)
    expect(sources()).toContain(product.imageUrl)
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Shirt"]')!.click())
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: product.imageUrl }))
  })
  it('uses the purchase snapshot rather than the current product image in purchase history', async () => {
    await render(<PurchaseHistoryPage />)
    expect(sources()).toEqual([purchase.imageUrl])
    expect(sources()).not.toContain(product.imageUrl)
  })
  it('renders current photos in picker/cart and snapshot photos in bought history', async () => {
    await render(<StockTrackerPage mode="buy" onChanged={vi.fn()} />)
    expect(sources()).toEqual([purchase.imageUrl])
    await act(async () => container.querySelector<HTMLButtonElement>('[role="combobox"]')!.click())
    expect(sources()).toContain(product.imageUrl)
    await act(async () => container.querySelector<HTMLButtonElement>('[role="option"] button')!.click())
    const form = container.querySelector('form')!
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(container.querySelector('[aria-labelledby="cart-heading"] img')?.getAttribute('src')).toBe(product.imageUrl)
    expect(container.querySelector('[aria-label="Bought product history"] img')?.getAttribute('src')).toBe(purchase.imageUrl)
  })
  it('renders available stock photos and keeps them through edit callbacks', async () => {
    const edit = vi.fn()
    await render(<StockTrackerPage mode="stock" onChanged={vi.fn()} onEdit={edit} onDelete={vi.fn()} />)
    expect(container.querySelector('[aria-label="Available stock"] img')?.getAttribute('src')).toBe(product.imageUrl)
    await click('Edit')
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: product.imageUrl }))
  })
  it('renders archived photos alongside recovery actions', async () => {
    await render(<SettingsPage archivedProducts={[{ ...product, archivedAt: product.updatedAt, deletedAt: null }]} onStockDeleted={vi.fn()} onHistoryChanged={vi.fn()} onProfitChanged={vi.fn()} />)
    expect(sources()).toEqual([product.imageUrl])
    expect(container.textContent).toContain('Restore')
  })
})