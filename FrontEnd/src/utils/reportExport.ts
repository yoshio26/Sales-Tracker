export function currentReportMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function reportExportUrls(month: string): { purchases: string; stock: string } {
  return {
    purchases: `/api/stock/export/purchases?month=${encodeURIComponent(month)}`,
    stock: `/api/stock/export/stock?month=${encodeURIComponent(month)}`,
  }
}

type ReportResponse = Pick<Response, 'ok' | 'blob'>
type ReportFetcher = (input: URL | RequestInfo, init?: RequestInit) => Promise<ReportResponse>
type ReportLink = { href: string; download: string; click: () => void }
type ReportDocument = { createElement: (tagName: 'a') => ReportLink }
type ReportUrlApi = Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>

export async function downloadReportFiles(month: string, fetcher: ReportFetcher = fetch, documentRef: ReportDocument = document, urlApi: ReportUrlApi = URL): Promise<void> {
  const urls = reportExportUrls(month)
  const responses = await Promise.all([
    fetcher(urls.purchases, { credentials: 'include' }),
    fetcher(urls.stock, { credentials: 'include' }),
  ])
  if (responses.some((response) => !response.ok)) throw new Error('Unable to export the report.')

  const [purchaseBlob, stockBlob] = await Promise.all(responses.map((response) => response.blob()))
  const files = [
    { blob: purchaseBlob, name: `purchase-report-${month}.csv` },
    { blob: stockBlob, name: `stock-report-${month}.csv` },
  ]
  for (const file of files) {
    const url = urlApi.createObjectURL(file.blob)
    const link = documentRef.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    urlApi.revokeObjectURL(url)
  }
}