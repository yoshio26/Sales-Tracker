import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useState, type ReactNode } from 'react'
import styles from '../App.module.css'
import { currentReportMonth, downloadReportFiles } from '../utils/reportExport.js'

export type DashboardPoint = { label: string; amount: string }
export type DashboardTrendPoint = { bucket: string; amount: string }
export type DashboardReport = { total: string; trend: DashboardTrendPoint[]; byProduct: DashboardPoint[]; byCategory: DashboardPoint[] }
export type Dashboard = { currentMonth: DashboardReport & { from: string; to: string }; allTime: DashboardReport; stock: { totalUnits: number; productsInStock: number; productsOutOfStock: number }; purchases: { count: number; quantity: number; totalCost: string }; totalEarnings: string; profit: string }

type DashboardPageProps = {
  dashboard: Dashboard | null
  loading: boolean
  error: string
  onRetry: () => void
  mode?: 'overview' | 'reports'
  children?: ReactNode
}

export function DashboardPage({ dashboard, loading, error, onRetry, mode = 'overview', children }: DashboardPageProps) {
  const [reportMonth, setReportMonth] = useState(currentReportMonth)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  async function exportReport() {
    setReportLoading(true)
    setReportError('')
    try {
      await downloadReportFiles(reportMonth)
    } catch {
      setReportError('Unable to export the report. Try again.')
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <section className={styles.dashboard} aria-labelledby="dashboard-heading">
      <div><h2 id="dashboard-heading">{mode === 'reports' ? 'Earnings reports' : 'Earnings dashboard'}</h2><p>{mode === 'reports' ? 'Review spending trends and category reports.' : 'Track total earnings, costs, profit, and available stock.'}</p></div>
      {error && <p className={styles.error} role="alert">{error} <button className={styles.linkButton} type="button" onClick={onRetry}>Retry</button></p>}
      {loading ? <p role="status" aria-live="polite">Loading dashboard…</p> : dashboard && <>
        {mode === 'overview' && <div className={styles.summaryCards} aria-label="Spending totals">
          <article className={styles.summaryCard}><span>Total Earnings</span><strong>₱{dashboard.totalEarnings}</strong></article>
          <article className={styles.summaryCard}><span>Profit</span><strong>₱{dashboard.profit}</strong></article>
          <article className={styles.summaryCard}><span>Available stock</span><strong>{dashboard.stock.totalUnits}</strong><small>{dashboard.stock.productsInStock} stocked · {dashboard.stock.productsOutOfStock} empty</small></article>
          <article className={styles.summaryCard}><span>Total sold</span><strong>{dashboard.purchases.quantity} items</strong><small>{dashboard.purchases.count} records · ₱{dashboard.purchases.totalCost}</small></article>
        </div>}
        {mode === 'overview' && children}
        {mode === 'reports' && <section className={styles.reportExport} aria-labelledby="report-export-heading">
          <div><h3 id="report-export-heading">Monthly report export</h3><p>Download purchase costs and current stock performance for the selected month.</p></div>
          <div className={styles.reportExportControls}>
            <label htmlFor="report-month">Report month</label>
            <input id="report-month" type="month" value={reportMonth} onChange={(event) => { setReportMonth(event.target.value); setReportError('') }} />
            <button type="button" onClick={() => void exportReport()} disabled={reportLoading || !reportMonth}>{reportLoading ? 'Exporting…' : 'Export Report?'}</button>
          </div>
          {reportError && <p className={styles.error} role="alert">{reportError}</p>}
        </section>}
        {mode === 'reports' && (dashboard.allTime.total === '0.00' ? <p className={styles.empty}>No expenses recorded yet. Expense charts will appear when expense data is available.</p> : <div className={styles.chartGrid}>
          <article className={styles.chartCard}><h3>This month over time</h3><p className={styles.chartSummary}>{dashboard.currentMonth.trend.length ? dashboard.currentMonth.trend.map((point) => `${point.bucket}: ₱${point.amount}`).join('; ') : 'No spending this month.'}</p><div className={styles.chart} aria-label="This month spending chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={dashboard.currentMonth.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="bucket" tickFormatter={(value: string) => value.slice(5, 10)} /><YAxis /><Tooltip formatter={(value) => `₱${value}`} /><Line type="monotone" dataKey="amount" name="Amount" stroke="var(--accent)" strokeWidth={3} dot /></LineChart></ResponsiveContainer></div></article>
          <article className={styles.chartCard}><h3>All-time over time</h3><p className={styles.chartSummary}>{dashboard.allTime.trend.length ? dashboard.allTime.trend.map((point) => `${point.bucket}: ₱${point.amount}`).join('; ') : 'No all-time spending.'}</p><div className={styles.chart} aria-label="All-time spending trend chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={dashboard.allTime.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="bucket" tickFormatter={(value: string) => value.slice(0, 7)} /><YAxis /><Tooltip formatter={(value) => `₱${value}`} /><Line type="monotone" dataKey="amount" name="Amount" stroke="var(--accent-hover)" strokeWidth={3} dot /></LineChart></ResponsiveContainer></div></article>
          <article className={styles.chartCard}><h3>All-time by product</h3><p className={styles.chartSummary}>{dashboard.allTime.byProduct.map((item) => `${item.label}: ₱${item.amount}`).join('; ')}</p><div className={styles.chart} aria-label="All-time spending by product chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboard.allTime.byProduct} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="label" width={90} /><Tooltip formatter={(value) => `₱${value}`} /><Bar dataKey="amount" name="Amount" fill="var(--accent)" /></BarChart></ResponsiveContainer></div></article>
          <article className={styles.chartCard}><h3>All-time by category</h3><p className={styles.chartSummary}>{dashboard.allTime.byCategory.map((item) => `${item.label}: ₱${item.amount}`).join('; ')}</p><div className={styles.chart} aria-label="All-time spending by category chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboard.allTime.byCategory} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="label" width={90} /><Tooltip formatter={(value) => `₱${value}`} /><Bar dataKey="amount" name="Amount" fill="var(--accent-hover)" /></BarChart></ResponsiveContainer></div></article>
        </div>)}
      </>}
    </section>
  )
}