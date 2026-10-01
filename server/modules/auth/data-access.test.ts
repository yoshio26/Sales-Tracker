import { describe, expect, it, vi } from 'vitest'
import { deleteExpiredAuthRecords, invalidateLoginCode } from './data-access.js'

describe('authentication data access', () => {
  it('invalidates only an unused login code by ID', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const db = { loginCode: { updateMany } }
    const now = new Date('2026-10-01T12:00:00.000Z')

    await expect(invalidateLoginCode(db as never, 'code-id', now)).resolves.toEqual({ count: 1 })
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'code-id', usedAt: null },
      data: { usedAt: now },
    })
  })

  it('deletes expired login codes and sessions in one transaction', async () => {
    const deleteLoginCodes = vi.fn().mockResolvedValue({ count: 2 })
    const deleteSessions = vi.fn().mockResolvedValue({ count: 3 })
    const deleteRateLimitEvents = vi.fn().mockResolvedValue({ count: 4 })
    const transaction = vi.fn().mockResolvedValue([{ count: 2 }, { count: 3 }, { count: 4 }])
    const db = { loginCode: { deleteMany: deleteLoginCodes }, session: { deleteMany: deleteSessions }, rateLimitEvent: { deleteMany: deleteRateLimitEvents }, $transaction: transaction }
    const now = new Date('2026-10-01T12:00:00.000Z')

    await expect(deleteExpiredAuthRecords(db as never, now)).resolves.toEqual([{ count: 2 }, { count: 3 }, { count: 4 }])
    expect(deleteLoginCodes).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } })
    expect(deleteSessions).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } })
    expect(deleteRateLimitEvents).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date('2026-10-01T11:50:00.000Z') } } })
    expect(transaction).toHaveBeenCalledOnce()
  })
})