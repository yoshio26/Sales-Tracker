// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StockStatusChip } from './StockStatusChip'

describe('StockStatusChip', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it.each([
    [0, 'out-of-stock', 'Out of stock'],
    [1, 'low-stock', 'Low stock'],
    [5, 'low-stock', 'Low stock'],
    [6, 'in-stock', 'In stock'],
  ])('labels quantity %s as %s', async (quantity, status, label) => {
    await act(async () => root.render(<StockStatusChip quantity={quantity} />))
    const chip = container.querySelector('[data-status]')
    expect(chip?.getAttribute('data-status')).toBe(status)
    expect(chip?.textContent).toBe(label)
  })
})
