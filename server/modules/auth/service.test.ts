import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findAllowedEmail: vi.fn(),
  createLoginCode: vi.fn(),
  completeVerification: vi.fn(),
  sendLoginCode: vi.fn(),
  findLatestUsableCode: vi.fn(),
  recordFailedAttempt: vi.fn(),
  deleteSession: vi.fn(),
}))

vi.mock('../../infrastructure/mailer.js', () => ({ sendLoginCode: mocks.sendLoginCode }))
vi.mock('../../infrastructure/prisma.js', () => ({ prisma: {} }))
vi.mock('./data-access.js', () => ({
  completeVerification: mocks.completeVerification,
  createLoginCode: mocks.createLoginCode,
  database: {},
  deleteSession: mocks.deleteSession,
  findAllowedEmail: mocks.findAllowedEmail,
  findActiveSession: vi.fn(),
  findLatestUsableCode: mocks.findLatestUsableCode,
  recordFailedAttempt: mocks.recordFailedAttempt,
}))

import { logout, normalizeEmail, requestCode, resetRateLimitsForTests, verifyCode, withinLimit } from './service.js'

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

  it('rate-limits unapproved emails while preserving the generic response', async () => {
    mocks.findAllowedEmail.mockResolvedValue(null)

    const responses = await Promise.all([
      requestCode('unknown@example.com', '203.0.113.30'),
      requestCode('unknown@example.com', '203.0.113.31'),
      requestCode('unknown@example.com', '203.0.113.32'),
      requestCode('unknown@example.com', '203.0.113.33'),
    ])

    expect(responses.every((response) => response.message === responses[0].message)).toBe(true)
    expect(mocks.findAllowedEmail).toHaveBeenCalledTimes(3)
    expect(mocks.createLoginCode).not.toHaveBeenCalled()
    expect(mocks.sendLoginCode).not.toHaveBeenCalled()
  })

  it('atomically completes a valid code verification and returns an opaque token', async () => {
    const codeHash = createHash('sha256').update('123456').digest('hex')
    mocks.findLatestUsableCode.mockResolvedValue({
      id: 'code-id',
      codeHash,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    })
    mocks.completeVerification.mockResolvedValue({ id: 'user-id' })

    const result = await verifyCode(' User@Example.COM ', '123456')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.token).toMatch(/^[a-f0-9]{64}$/)
    expect(mocks.completeVerification).toHaveBeenCalledWith(expect.objectContaining({
      codeId: 'code-id',
      email: 'user@example.com',
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }))
    expect(mocks.recordFailedAttempt).not.toHaveBeenCalled()
  })

  it('records a failed attempt without disclosing the code state', async () => {
    mocks.findLatestUsableCode.mockResolvedValue({
      id: 'code-id',
      codeHash: createHash('sha256').update('123456').digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    })

    await expect(verifyCode('user@example.com', '000000')).resolves.toEqual({ ok: false })
    expect(mocks.recordFailedAttempt).toHaveBeenCalledWith({}, 'code-id')
    expect(mocks.completeVerification).not.toHaveBeenCalled()
  })

  it('rejects expired or locked codes without creating a session', async () => {
    mocks.findLatestUsableCode.mockResolvedValueOnce({
      id: 'expired',
      codeHash: createHash('sha256').update('123456').digest('hex'),
      expiresAt: new Date(Date.now() - 1),
      attempts: 0,
    }).mockResolvedValueOnce({
      id: 'locked',
      codeHash: createHash('sha256').update('123456').digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 5,
    })

    await expect(verifyCode('user@example.com', '123456')).resolves.toEqual({ ok: false })
    await expect(verifyCode('user@example.com', '123456')).resolves.toEqual({ ok: false })
    expect(mocks.recordFailedAttempt).not.toHaveBeenCalled()
    expect(mocks.completeVerification).not.toHaveBeenCalled()
  })

  it('hashes the opaque token before deleting the session on logout', async () => {
    await logout('opaque-token')

    expect(mocks.deleteSession).toHaveBeenCalledWith({}, createHash('sha256').update('opaque-token').digest('hex'))
  })
})
