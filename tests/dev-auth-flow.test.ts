import 'dotenv/config'
import { describe, expect, it } from 'vitest'

describe.skipIf(process.env.RUN_DEV_AUTH_FLOW !== 'true')('development Mailpit auth flow', () => {
  it('requests a code, reads it from Mailpit, verifies it, and receives a session cookie', async () => {
    const baseUrl = process.env.AUTH_BASE_URL ?? 'http://localhost:3000'
    const email = process.env.ALLOWLIST_EMAIL
    if (!email) throw new Error('ALLOWLIST_EMAIL is required for the development auth flow')

    const clearMailbox = await fetch(`${process.env.MAILPIT_API_URL ?? 'http://localhost:8025'}/api/v1/messages`, { method: 'DELETE' })
    expect(clearMailbox.ok).toBe(true)

    const request = await fetch(`${baseUrl}/api/auth/request-code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: process.env.APP_ORIGIN ?? 'http://localhost:5173' },
      body: JSON.stringify({ email }),
    })
    expect(request.ok).toBe(true)

    const messages = await fetch(`${process.env.MAILPIT_API_URL ?? 'http://localhost:8025'}/api/v1/messages`).then((response) => response.json()) as { messages: Array<{ ID: string }> }
    const message = messages.messages[0]
    expect(message).toBeDefined()
    const detail = await fetch(`${process.env.MAILPIT_API_URL ?? 'http://localhost:8025'}/api/v1/message/${message.ID}`).then((response) => response.json()) as { Text: string }
    const code = detail.Text.match(/\b\d{6}\b/)?.[0]
    expect(code).toMatch(/^\d{6}$/)

    const verification = await fetch(`${baseUrl}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: process.env.APP_ORIGIN ?? 'http://localhost:5173' },
      body: JSON.stringify({ email, code }),
    })
    expect(verification.ok).toBe(true)
    const cookie = verification.headers.get('set-cookie')
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).not.toMatch(/Secure/i)

    const session = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: cookie?.split(';')[0] ?? '' } })
    await expect(session.json()).resolves.toEqual({ authenticated: true })

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookie?.split(';')[0] ?? '', origin: process.env.APP_ORIGIN ?? 'http://localhost:5173' },
    })
    expect(logout.status).toBe(204)
    expect(logout.headers.get('set-cookie')).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT/i)

    const afterLogout = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: cookie?.split(';')[0] ?? '' } })
    await expect(afterLogout.json()).resolves.toEqual({ authenticated: false })
  })
})
