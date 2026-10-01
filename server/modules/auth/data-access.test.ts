import { describe, expect, it, vi } from 'vitest'
import { invalidateLoginCode } from './data-access.js'

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
})