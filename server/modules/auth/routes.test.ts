import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  requestCode: vi.fn(),
  verifyCode: vi.fn(),
}))

vi.mock('./service.js', () => mocks)

import { authRouter, SESSION_COOKIE } from './routes.js'

type Handler = (req: never, res: never, next: never) => unknown
type Route = { path?: string; methods?: Record<string, boolean>; stack: Array<{ handle: Handler }> }
type MockResponse = {
  clearCookie: ReturnType<typeof vi.fn>
  cookie: ReturnType<typeof vi.fn>
  json: ReturnType<typeof vi.fn>
  status: ReturnType<typeof vi.fn>
}

function response(): MockResponse {
  const json = vi.fn()
  return {
    clearCookie: vi.fn(),
    cookie: vi.fn(),
    json,
    status: vi.fn(() => ({ json, end: vi.fn() })),
  }
}

function handlers(method: 'get' | 'post', path: string): Handler[] {
  const layer = authRouter.stack.find((candidate) => {
    const route = candidate.route as Route | undefined
    return route?.path === path && route.methods?.[method] === true
  })
  const route = layer?.route as Route | undefined
  if (!route) throw new Error(`Route ${method} ${path} is missing.`)
  return route.stack.map((candidate) => candidate.handle)
}

async function invoke(method: 'get' | 'post', path: string, input: { body?: unknown; cookies?: Record<string, string>; userId?: string; origin?: string }) {
  const res = response()
  const routeHandlers = handlers(method, path)
  const req = {
    body: input.body,
    cookies: input.cookies ?? {},
    get: (header: string) => header.toLowerCase() === 'origin' ? input.origin : undefined,
    socket: { remoteAddress: '203.0.113.10' },
    userId: input.userId,
  }
  let index = 0
  const next = async (error?: unknown): Promise<void> => {
    if (error) throw error
    const handler = routeHandlers[index++]
    if (handler) await handler(req as never, res as never, next as never)
  }
  await next()
  return res
}

describe('authentication routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requestCode.mockResolvedValue({ message: 'If the email is approved, a sign-in code has been sent.' })
    mocks.verifyCode.mockResolvedValue({ ok: false })
  })

  it('rejects invalid request DTOs without consulting the auth service', async () => {
    const res = await invoke('post', '/request-code', { body: { email: 'not-an-email' }, origin: 'http://localhost:5173' })

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INVALID_INPUT', message: 'Enter a valid email address.' } })
    expect(mocks.requestCode).not.toHaveBeenCalled()
  })

  it('keeps approved and unknown request responses generic', async () => {
    const approved = await invoke('post', '/request-code', { body: { email: 'approved@example.com' }, origin: 'http://localhost:5173' })
    const unknown = await invoke('post', '/request-code', { body: { email: 'unknown@example.com' }, origin: 'http://localhost:5173' })

    expect(approved.json).toHaveBeenCalledWith({ message: 'If the email is approved, a sign-in code has been sent.' })
    expect(unknown.json).toHaveBeenCalledWith({ message: 'If the email is approved, a sign-in code has been sent.' })
    expect(mocks.requestCode).toHaveBeenNthCalledWith(1, 'approved@example.com', '203.0.113.10')
    expect(mocks.requestCode).toHaveBeenNthCalledWith(2, 'unknown@example.com', '203.0.113.10')
  })

  it('rejects foreign origins before any auth mutation service is invoked', async () => {
    const request = await invoke('post', '/request-code', { body: { email: 'user@example.com' }, origin: 'https://attacker.example' })
    const verify = await invoke('post', '/verify-code', { body: { email: 'user@example.com', code: '123456' }, origin: 'https://attacker.example' })
    const logout = await invoke('post', '/logout', { cookies: { [SESSION_COOKIE]: 'token' }, origin: 'https://attacker.example' })

    expect(request.status).toHaveBeenCalledWith(403)
    expect(verify.status).toHaveBeenCalledWith(403)
    expect(logout.status).toHaveBeenCalledWith(403)
    expect(mocks.requestCode).not.toHaveBeenCalled()
    expect(mocks.verifyCode).not.toHaveBeenCalled()
    expect(mocks.logout).not.toHaveBeenCalled()
  })

  it('returns a safe invalid-code response without setting a session cookie', async () => {
    const res = await invoke('post', '/verify-code', { body: { email: 'user@example.com', code: '000000' }, origin: 'http://localhost:5173' })

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INVALID_CODE', message: 'The code could not be verified.' } })
    expect(res.cookie).not.toHaveBeenCalled()
  })

  it('rejects malformed verification DTOs without consulting the auth service', async () => {
    const res = await invoke('post', '/verify-code', { body: { email: 'user@example.com', code: 'not-a-code' }, origin: 'http://localhost:5173' })

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INVALID_INPUT', message: 'Enter a valid email and six-digit code.' } })
    expect(mocks.verifyCode).not.toHaveBeenCalled()
  })

  it('sets an HttpOnly lax session cookie after successful verification', async () => {
    mocks.verifyCode.mockResolvedValue({ ok: true, token: 'opaque-token', userId: 'user-a' })

    const res = await invoke('post', '/verify-code', { body: { email: ' User@Example.COM ', code: '123456' }, origin: 'http://localhost:5173' })

    expect(mocks.verifyCode).toHaveBeenCalledWith('User@Example.COM', '123456', '203.0.113.10')
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE, 'opaque-token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    })
    expect(res.json).toHaveBeenCalledWith({ message: 'Signed in.' })
  })

  it('reports session state without exposing session details', async () => {
    const authenticated = await invoke('get', '/session', { userId: 'user-a' })
    const anonymous = await invoke('get', '/session', {})

    expect(authenticated.json).toHaveBeenCalledWith({ authenticated: true })
    expect(anonymous.json).toHaveBeenCalledWith({ authenticated: false })
  })

  it('revokes the supplied session and clears its cookie', async () => {
    const res = await invoke('post', '/logout', { cookies: { [SESSION_COOKIE]: 'opaque-token' }, origin: 'http://localhost:5173' })

    expect(mocks.logout).toHaveBeenCalledWith('opaque-token')
    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: false, path: '/' })
    expect(res.status).toHaveBeenCalledWith(204)
  })
})
