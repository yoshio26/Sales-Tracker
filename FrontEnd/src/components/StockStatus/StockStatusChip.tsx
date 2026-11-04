import styles from '../../App.module.css'

type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock'

function getStockStatus(quantity: number): StockStatus {
  if (quantity === 0) return 'out-of-stock'
  if (quantity <= 5) return 'low-stock'
  return 'in-stock'
}

const statusLabels: Record<StockStatus, string> = {
  'in-stock': 'In stock',
  'low-stock': 'Low stock',
  'out-of-stock': 'Out of stock',
}

const statusClasses: Record<StockStatus, string> = {
  'in-stock': styles.stockStatusChipInStock,
  'low-stock': styles.stockStatusChipLowStock,
  'out-of-stock': styles.stockStatusChipOutOfStock,
}

export function StockStatusChip({ quantity }: { quantity: number }) {
  const status = getStockStatus(quantity)
  return <span className={`${styles.stockStatusChip} ${statusClasses[status]}`} data-status={status}>{statusLabels[status]}</span>
}
