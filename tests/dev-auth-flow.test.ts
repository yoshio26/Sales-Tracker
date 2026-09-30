import { describe, expect, it } from 'vitest'

describe.skipIf(process.env.RUN_DEV_AUTH_FLOW !== 'true')('development Mailpit auth flow', () => {
  it('requests a code, reads it from Mailpit, verifies it, and receives a session cookie', async () => {
    const baseUrl = process.env.AUTH_BASE_URL ?? 'http://localhost:3000'
    const email = process.env.ALLOWLIST_EMAIL
    if (!email) throw new Error('ALLOWLIST_EMAIL is required for the development auth flow')

    const request = await fetch(`${baseUrl}/api/auth/request-code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    expect(verification.ok).toBe(true)
    expect(verification.headers.get('set-cookie')).toMatch(/HttpOnly/i)
  })
})
