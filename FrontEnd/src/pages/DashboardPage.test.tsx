// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { ToastProvider } from '../components/Toast/ToastProvider'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

vi.mock('../utils/reportExport.js', () => ({ currentReportMonth: '2026-11', downloadReportFiles: vi.fn() }))

describe('DashboardPage total stocks card', () => {
  it('shows product and unit totals', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(async () => root.render(<ToastProvider><DashboardPage
      dashboard={{
        currentMonth: { from: '', to: '', total: '0.00', trend: [], byProduct: [], byCategory: [] },
        allTime: { total: '0.00', trend: [], byProduct: [], byCategory: [] },
        stock: { totalUnits: 240, productsCount: 18, productsInStock: 16, productsOutOfStock: 2 },
        purchases: { count: 0, quantity: 0, totalCost: '0.00' },
        totalEarnings: '0.00',
        profit: '0.00',
      }}
      loading={false}
      error=""
      onRetry={() => undefined}
    /></ToastProvider>))

    expect(container.textContent).toContain('Total stocks')
    expect(container.textContent).toContain('18 products')
    expect(container.textContent).toContain('240 units')
    await act(async () => root.unmount())
    container.remove()
  })
})
