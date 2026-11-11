import { config } from '../../infrastructure/config.js'
import { logError } from '../../infrastructure/logger.js'
import { sendMessage } from '../../infrastructure/mailer.js'
import { prisma } from '../../infrastructure/prisma.js'
import { getDashboard } from '../dashboard/service.js'

export type NotificationEvent = 'added' | 'deleted' | 'changed'
export type NotificationChange = { label: string; before: string; after: string }
export type NotificationItem = { name: string; category: string; quantity?: number; price?: string; costDeducted?: string; changes?: NotificationChange[] }

function money(value: string | undefined): string {
  return value ? `₱${value}` : ''
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))
}

export async function notifyStock(userId: string, event: NotificationEvent, items: NotificationItem[], bulk = false): Promise<void> {
  if (items.length === 0) return
  if (event === 'changed' && items.every((item) => !item.changes?.length)) return
  try {
    const settings = await prisma.notificationSettings.findUnique({ where: { userId } })
    const enabled = settings?.[`${event}Enabled`] ?? true
    if (!enabled) return
    const recipient = settings?.recipientEmail ?? config.NOTIFY_EMAIL_TO
    if (!recipient) return

    const dashboard = await getDashboard(userId)
    const now = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: config.NOTIFY_TIMEZONE }).format(new Date())
    const title = bulk ? 'Stock added' : `Stock ${event}`
    const itemLines = items.flatMap((item) => {
      const details = event === 'changed'
        ? (item.changes ?? []).map((change) => `${change.label}: ${change.before} -> ${change.after}`)
        : [
            ...(item.quantity === undefined ? [] : [`Quantity: ${item.quantity}`]),
            ...(item.price === undefined ? [] : [`Price: ${money(item.price)}`]),
            ...(item.costDeducted === undefined ? [] : [`Initial cost deducted: ${money(item.costDeducted)}`]),
          ]
      return [`${item.name} (${item.category})`, ...details]
    })
    const summary = `Profit: ${money(dashboard.profit)}\nTotal stocks: ${dashboard.stock.productsCount} products · ${dashboard.stock.totalUnits} units`
    const text = `${title}\n\n${itemLines.join('\n')}\n\n${summary}\nDate/time: ${now}`
    const htmlItems = items.map((item) => {
      const details = event === 'changed'
        ? (item.changes ?? []).map((change) => `${change.label}: ${change.before} → ${change.after}`)
        : [
            ...(item.quantity === undefined ? [] : [`Quantity: ${item.quantity}`]),
            ...(item.price === undefined ? [] : [`Price: ${money(item.price)}`]),
            ...(item.costDeducted === undefined ? [] : [`Initial cost deducted: ${money(item.costDeducted)}`]),
          ]
      return `<li><strong>${escapeHtml(item.name)} (${escapeHtml(item.category)})</strong>${details.length ? `<ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>` : ''}</li>`
    }).join('')
    const html = `<h2>${escapeHtml(title)}</h2><ul>${htmlItems}</ul><p>${escapeHtml(summary).replaceAll('\n', '<br>')}<br>Date/time: ${escapeHtml(now)}</p>`
    const subject = `${title}: ${items[0]?.name ?? 'multiple products'}${items[0]?.category ? ` (${items[0].category})` : ''} | Profit ${dashboard.profit} | ${dashboard.stock.totalUnits} units`
    await sendMessage({ to: recipient, subject, text, html })
  } catch (error) {
    logError('stock_notification_failed', error, { userId, event, itemCount: items.length })
  }
}

export async function getNotificationSettings(userId: string) {
  const settings = await prisma.notificationSettings.findUnique({ where: { userId } })
  return {
    recipientEmail: settings?.recipientEmail ?? '',
    addedEnabled: settings?.addedEnabled ?? true,
    deletedEnabled: settings?.deletedEnabled ?? true,
    changedEnabled: settings?.changedEnabled ?? true,
  }
}

export async function updateNotificationSettings(userId: string, input: { recipientEmail?: string | null; addedEnabled: boolean; deletedEnabled: boolean; changedEnabled: boolean }) {
  return prisma.notificationSettings.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
  })
}
