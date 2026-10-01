import 'dotenv/config'
import { describe, expect, it } from 'vitest'

async function jsonWithDiagnostics<T>(response: Response, context: string): Promise<T> {
  try {
    return await response.json() as T
  } catch (error) {
    throw new Error(`${context} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function fetchWithDiagnostics(url: string, init: RequestInit, context: string) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
  } catch (error) {
    throw new Error(`${context} (${url}) failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

describe.skipIf(process.env.RUN_DEV_AUTH_FLOW !== 'true')('development Mailpit auth flow', () => {
  it('requests a code, reads it from Mailpit, verifies it, and receives a session cookie', async () => {
    const baseUrl = process.env.AUTH_BASE_URL ?? 'http://localhost:3000'
    const mailpitUrl = process.env.MAILPIT_API_URL ?? 'http://localhost:8025'
    const appOrigin = process.env.APP_ORIGIN ?? 'http://localhost:5173'
    const email = process.env.ALLOWLIST_EMAIL
    if (!email) throw new Error('ALLOWLIST_EMAIL is required for the development auth flow; set it to an approved database email.')

    const clearMailbox = await fetchWithDiagnostics(`${mailpitUrl}/api/v1/messages`, { method: 'DELETE' }, 'Mailpit mailbox cleanup')
    expect(clearMailbox.ok, `Mailpit mailbox cleanup failed at ${mailpitUrl} (${clearMailbox.status}). Is Mailpit running?`).toBe(true)

    const request = await fetchWithDiagnostics(`${baseUrl}/api/auth/request-code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: appOrigin },
      body: JSON.stringify({ email }),
    })
    expect(request.ok, `Auth code request failed at ${baseUrl}/api/auth/request-code (${request.status}). Is the server running with the configured allowlist?`).toBe(true)

    const messagesResponse = await fetchWithDiagnostics(`${mailpitUrl}/api/v1/messages`, {}, 'Mailpit message listing')
    expect(messagesResponse.ok, `Mailpit message listing failed at ${mailpitUrl} (${messagesResponse.status}).`).toBe(true)
    const messages = await jsonWithDiagnostics<{ messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }> }>(messagesResponse, `Mailpit message listing at ${mailpitUrl}`)
    if (!Array.isArray(messages.messages)) throw new Error(`Mailpit returned an invalid message list at ${mailpitUrl}.`)
    const message = messages.messages.find((candidate) => Array.isArray(candidate.To) && candidate.To.some((recipient) => recipient && typeof recipient.Address === 'string' && recipient.Address.toLowerCase() === email.toLowerCase()))
    expect(message, `No message arrived in Mailpit at ${mailpitUrl}; verify SMTP configuration and the allowlisted email.`).toBeDefined()
    if (!message?.ID) throw new Error(`Mailpit returned no usable message ID for ${email}.`)
    const detailResponse = await fetchWithDiagnostics(`${mailpitUrl}/api/v1/message/${message.ID}`, {}, 'Mailpit message lookup')
    expect(detailResponse.ok, `Mailpit message lookup failed at ${mailpitUrl} (${detailResponse.status}).`).toBe(true)
    const detail = await jsonWithDiagnostics<{ ID?: string; Text?: string; To?: Array<{ Address?: string }> }>(detailResponse, `Mailpit message ${message.ID} lookup`)
    if (detail.ID !== message.ID) throw new Error(`Mailpit returned a different message ID (${detail.ID ?? 'missing'}) for ${message.ID}.`)
    if (typeof detail.Text !== 'string') throw new Error(`Mailpit message ${message.ID} did not include text.`)
    expect(Array.isArray(detail.To) && detail.To.some((recipient) => recipient && typeof recipient.Address === 'string' && recipient.Address.toLowerCase() === email.toLowerCase()), `Mailpit message was not addressed to ${email}.`).toBe(true)
    const code = detail.Text.match(/\b\d{6}\b/)?.[0]
    expect(code, 'Mailpit message did not contain a six-digit login code.').toMatch(/^\d{6}$/)

    const verification = await fetchWithDiagnostics(`${baseUrl}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: appOrigin },
      body: JSON.stringify({ email, code }),
    })
    expect(verification.ok, `Auth verification failed at ${baseUrl}/api/auth/verify-code (${verification.status}).`).toBe(true)
    const cookie = verification.headers.get('set-cookie')
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).not.toMatch(/Secure/i)

    const session = await fetchWithDiagnostics(`${baseUrl}/api/auth/session`, { headers: { cookie: cookie?.split(';')[0] ?? '' } }, 'Authenticated session lookup')
    expect(session.ok, `Authenticated session lookup failed at ${baseUrl}/api/auth/session (${session.status}).`).toBe(true)
    await expect(session.json()).resolves.toEqual({ authenticated: true })

    const logout = await fetchWithDiagnostics(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookie?.split(';')[0] ?? '', origin: appOrigin },
    })
    expect(logout.status).toBe(204)
    expect(logout.headers.get('set-cookie')).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT/i)

    const afterLogout = await fetchWithDiagnostics(`${baseUrl}/api/auth/session`, { headers: { cookie: cookie?.split(';')[0] ?? '' } }, 'Post-logout session lookup')
    expect(afterLogout.ok, `Post-logout session lookup failed at ${baseUrl}/api/auth/session (${afterLogout.status}).`).toBe(true)
    await expect(afterLogout.json()).resolves.toEqual({ authenticated: false })
  })
})
