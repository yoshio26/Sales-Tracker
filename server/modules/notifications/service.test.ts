import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  getDashboard: vi.fn(),
  sendMessage: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('../../infrastructure/prisma.js', () => ({ prisma: { notificationSettings: { findUnique: mocks.findUnique, upsert: mocks.upsert } } }))
vi.mock('../../infrastructure/mailer.js', () => ({ sendMessage: mocks.sendMessage }))
vi.mock('../../infrastructure/logger.js', () => ({ logError: mocks.logError }))
vi.mock('../dashboard/service.js', () => ({ getDashboard: mocks.getDashboard }))

import { notifyStock } from './service.js'

describe('stock notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findUnique.mockResolvedValue(null)
    mocks.getDashboard.mockResolvedValue({ stock: { productsCount: 3, totalUnits: 18 }, profit: '125.50' })
    mocks.sendMessage.mockResolvedValue(undefined)
  })

  it('sends an added notification with product details and post-save totals', async () => {
    await notifyStock('user-a', 'added', [{ name: 'Widget', category: 'Tools', quantity: 5, price: '10.00', costDeducted: '25.00' }])

    const message = mocks.sendMessage.mock.calls[0][0]
    expect(message.subject).toContain('Stock added: Widget (Tools) | Profit 125.50 | 18 units')
    expect(message.text).toContain('Quantity: 5')
    expect(message.text).toContain('Initial cost deducted: ₱25.00')
    expect(message.text).toContain('Total stocks: 3 products · 18 units')
    expect(message.html).toContain('<strong>Widget (Tools)</strong>')
  })

  it('escapes trusted photo markup and preserves readable plain text', async () => {
    await notifyStock('user-a', 'added', [{ name: 'A <shirt>', category: 'Clothes', imageUrl: 'https://res.cloudinary.com/test/image/upload/photo.png?a=1&b=2' }])
    const message = mocks.sendMessage.mock.calls[0][0]
    expect(message.html).toContain('<img src="https://res.cloudinary.com/')
    expect(message.html).toContain('a=1&amp;b=2')
    expect(message.html).toContain('alt="A &lt;shirt&gt;"')
    expect(message.text).toContain('A <shirt> (Clothes)')
  })

  it.each(['https://res.cloudinary.com.evil.test/photo', 'http://res.cloudinary.com/photo', 'javascript:alert(1)', 'https://evil.test/photo'])('omits untrusted image URL %s', async (imageUrl) => {
    await notifyStock('user-a', 'added', [{ name: 'Widget', category: 'Tools', imageUrl }])
    expect(mocks.sendMessage.mock.calls[0][0].html).not.toContain('<img')
    expect(mocks.sendMessage.mock.calls[0][0].text).toContain('Widget (Tools)')
  })

  it('sends one summary message for bulk additions', async () => {
    await notifyStock('user-a', 'added', [
      { name: 'Widget', category: 'Tools', quantity: 2, price: '10.00' },
      { name: 'Cable', category: 'Electronics', quantity: 4, price: '5.00' },
    ], true)

    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
    expect(mocks.sendMessage.mock.calls[0][0].text).toContain('Cable (Electronics)')
  })

  it('renders only changed fields for edits', async () => {
    await notifyStock('user-a', 'changed', [{ name: 'Widget', category: 'Tools', changes: [{ label: 'Quantity', before: '10', after: '15' }, { label: 'Price', before: '50.00', after: '55.00' }] }])

    const message = mocks.sendMessage.mock.calls[0][0]
    expect(message.text).toContain('Quantity: 10 -> 15')
    expect(message.text).toContain('Price: 50.00 -> 55.00')
    expect(message.text).not.toContain('Category:')
  })

  it('does not send an edit notification when no fields changed', async () => {
    await notifyStock('user-a', 'changed', [{ name: 'Widget', category: 'Tools', changes: [] }])

    expect(mocks.sendMessage).not.toHaveBeenCalled()
    expect(mocks.getDashboard).not.toHaveBeenCalled()
  })

  it('sends deletion details', async () => {
    await notifyStock('user-a', 'deleted', [{ name: 'Widget', category: 'Tools', quantity: 2 }])

    expect(mocks.sendMessage.mock.calls[0][0].text).toContain('Quantity: 2')
  })

  it('does not send disabled event notifications', async () => {
    mocks.findUnique.mockResolvedValue({ addedEnabled: false, deletedEnabled: true, changedEnabled: true, recipientEmail: 'owner@example.com' })

    await notifyStock('user-a', 'added', [{ name: 'Widget', category: 'Tools', quantity: 1 }])

    expect(mocks.sendMessage).not.toHaveBeenCalled()
    expect(mocks.getDashboard).not.toHaveBeenCalled()
  })

  it('isolates mail failures and logs them', async () => {
    const failure = new Error('SMTP unavailable')
    mocks.sendMessage.mockRejectedValue(failure)

    await expect(notifyStock('user-a', 'deleted', [{ name: 'Widget', category: 'Tools', quantity: 2 }])).resolves.toBeUndefined()
    expect(mocks.logError).toHaveBeenCalledWith('stock_notification_failed', failure, { userId: 'user-a', event: 'deleted', itemCount: 1 })
  })
})
