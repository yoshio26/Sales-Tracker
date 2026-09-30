import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findAllowedEmail: vi.fn(),
  createLoginCode: vi.fn(),
  sendLoginCode: vi.fn(),
}))

vi.mock('../../infrastructure/mailer.js', () => ({ sendLoginCode: mocks.sendLoginCode }))
vi.mock('../../infrastructure/prisma.js', () => ({ prisma: {} }))
vi.mock('./data-access.js', () => ({
  completeVerification: vi.fn(),
  createLoginCode: mocks.createLoginCode,
  database: {},
  deleteSession: vi.fn(),
  findAllowedEmail: mocks.findAllowedEmail,
  findActiveSession: vi.fn(),
  findLatestUsableCode: vi.fn(),
  recordFailedAttempt: vi.fn(),
}))

import { normalizeEmail, requestCode, resetRateLimitsForTests, withinLimit } from './service.js'

describe('authentication policy helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRateLimitsForTests()
  })

  it.afterEach(() => resetRateLimitsForTests())

  it('normalizes emails before persistence and lookup', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })

  it('keeps email and IP rate-limit buckets independent', () => {
    const now = Date.now()
    const emailBucket = new Map<string, number[]>()
    const ipBucket = new Map<string, number[]>()

    expect(withinLimit(emailBucket, 'user@example.com', 3, now)).toBe(true)
    expect(withinLimit(emailBucket, 'user@example.com', 3, now)).toBe(true)
    expect(withinLimit(emailBucket, 'user@example.com', 3, now)).toBe(true)
    expect(withinLimit(emailBucket, 'user@example.com', 3, now)).toBe(false)
    expect(withinLimit(ipBucket, '203.0.113.10', 20, now)).toBe(true)
  })

  it('discards timestamps outside the ten-minute window', () => {
    const now = Date.now()
    const bucket = new Map([['user@example.com', [now - 10 * 60 * 1000 - 1, now, now]]])
    expect(withinLimit(bucket, 'user@example.com', 3, now)).toBe(true)
  })

  it('keeps approved and unapproved requests indistinguishable', async () => {
    mocks.findAllowedEmail.mockResolvedValueOnce({ email: 'approved@example.com' }).mockResolvedValueOnce(null)

    const approved = await requestCode('approved@example.com', '203.0.113.10')
    const unapproved = await requestCode('unapproved@example.com', '203.0.113.11')

    expect(approved).toEqual(unapproved)
    expect(mocks.createLoginCode).toHaveBeenCalledOnce()
    expect(mocks.sendLoginCode).toHaveBeenCalledOnce()
    expect(mocks.sendLoginCode.mock.calls[0][1]).toMatch(/^\d{6}$/)
    expect(mocks.createLoginCode.mock.calls[0][1].codeHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('applies the email limit before checking the allowlist', async () => {
    mocks.findAllowedEmail.mockResolvedValue({ email: 'approved@example.com' })

    await requestCode('approved@example.com', '203.0.113.20')
    await requestCode('approved@example.com', '203.0.113.21')
    await requestCode('approved@example.com', '203.0.113.22')
    await requestCode('approved@example.com', '203.0.113.23')

    expect(mocks.findAllowedEmail).toHaveBeenCalledTimes(3)
    expect(mocks.createLoginCode).toHaveBeenCalledTimes(3)
  })
})
