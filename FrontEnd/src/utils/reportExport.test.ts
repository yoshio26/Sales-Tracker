import { describe, expect, it, vi } from 'vitest'
import { currentReportMonth, downloadReportFiles, reportExportUrls } from './reportExport.js'

describe('report export helpers', () => {
  it('uses the UTC calendar month for the default selector', () => {
    expect(currentReportMonth(new Date('2026-10-06T23:30:00.000Z'))).toBe('2026-10')
  })

  it('builds the two authenticated report endpoint paths', () => {
    expect(reportExportUrls('2026-10')).toEqual({
      purchases: '/api/stock/export/purchases?month=2026-10',
      stock: '/api/stock/export/stock?month=2026-10',
    })
  })

  it('fetches and downloads both CSV files with session credentials', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['csv']) }))
    const links: Array<{ href: string; download: string; click: ReturnType<typeof vi.fn> }> = []
    const documentRef = { createElement: vi.fn(() => { const link = { href: '', download: '', click: vi.fn() }; links.push(link); return link }) }
    const urlApi = { createObjectURL: vi.fn((blob: Blob) => `blob:${blob.size}`), revokeObjectURL: vi.fn() }

    await downloadReportFiles('2026-10', fetcher, documentRef, urlApi)

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/stock/export/purchases?month=2026-10', { credentials: 'include' })
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/stock/export/stock?month=2026-10', { credentials: 'include' })
    expect(links.map((link) => link.download)).toEqual(['purchase-report-2026-10.csv', 'stock-report-2026-10.csv'])
    expect(links.every((link) => link.click.mock.calls.length === 1)).toBe(true)
  })

  it('does not create downloads when an export request fails', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, blob: async () => new Blob(['error']) }))
    const documentRef = { createElement: vi.fn() }
    const urlApi = { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() }

    await expect(downloadReportFiles('2026-10', fetcher, documentRef, urlApi)).rejects.toThrow('Unable to export the report.')
    expect(documentRef.createElement).not.toHaveBeenCalled()
    expect(urlApi.createObjectURL).not.toHaveBeenCalled()
  })
})