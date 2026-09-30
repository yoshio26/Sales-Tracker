import { describe, expect, it, vi } from 'vitest'

const resolveSession = vi.hoisted(() => vi.fn())
vi.mock('../modules/auth/service.js', () => ({ resolveSession }))

import { requireSession, sessionMiddleware } from './session.js'

describe('session protection', () => {
  it('rejects requests without server-derived identity', () => {
    const json = vi.fn()
    const res = { status: vi.fn(() => ({ json })) } as never
    const next = vi.fn()
    requireSession({} as never, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(json).toHaveBeenCalledWith({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } })
  })

  it('passes only with server-derived identity', () => {
    const next = vi.fn()
    requireSession({ userId: 'server-user' } as never, {} as never, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('attaches only the identity returned by session storage', async () => {
    resolveSession.mockResolvedValueOnce({ userId: 'server-user' })
    const request = { cookies: { sales_tracker_session: 'opaque-token' } } as never
    const next = vi.fn()

    await sessionMiddleware(request, {} as never, next)

    expect(request.userId).toBe('server-user')
    expect(resolveSession).toHaveBeenCalledWith('opaque-token')
    expect(next).toHaveBeenCalledOnce()
  })

  it('does not attach an identity for an expired or missing session', async () => {
    resolveSession.mockResolvedValueOnce(null)
    const request = { userId: 'client-supplied-user', cookies: { sales_tracker_session: 'expired-token' } } as never
    const next = vi.fn()

    await sessionMiddleware(request, {} as never, next)

    expect(request.userId).toBeUndefined()
    expect(next).toHaveBeenCalledOnce()
  })
})
