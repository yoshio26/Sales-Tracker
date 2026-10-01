import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { config } from '../../infrastructure/config.js'
import { sendLoginCode } from '../../infrastructure/mailer.js'
import {
  completeVerification,
  createLoginCode,
  database,
  deleteSession,
  findAllowedEmail,
  findActiveSession,
  findLatestUsableCode,
  invalidateLoginCode,
  recordFailedAttempt,
} from './data-access.js'

const GENERIC_REQUEST_RESPONSE = { message: 'If the email is approved, a sign-in code has been sent.' }
const ipRequests = new Map<string, number[]>()
const emailRequests = new Map<string, number[]>()

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function withinLimit(bucket: Map<string, number[]>, key: string, max: number, now: number): boolean {
  const windowStart = now - 10 * 60 * 1000
  const recent = (bucket.get(key) ?? []).filter((timestamp) => timestamp >= windowStart)
  if (recent.length >= max) {
    bucket.set(key, recent)
    return false
  }
  recent.push(now)
  bucket.set(key, recent)
  return true
}

export function resetRateLimitsForTests(): void {
  ipRequests.clear()
  emailRequests.clear()
}

export async function requestCode(rawEmail: string, ip: string): Promise<typeof GENERIC_REQUEST_RESPONSE> {
  const email = normalizeEmail(rawEmail)
  const now = Date.now()
  const ipAllowed = withinLimit(ipRequests, ip, config.RATE_LIMIT_IP_MAX, now)
  const emailAllowed = withinLimit(emailRequests, email, config.RATE_LIMIT_EMAIL_MAX, now)
  if (!ipAllowed || !emailAllowed) return GENERIC_REQUEST_RESPONSE

  const allowed = await findAllowedEmail(database, email)
  if (!allowed) return GENERIC_REQUEST_RESPONSE

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  const loginCode = await createLoginCode(database, {
    email,
    codeHash: hash(code),
    expiresAt: new Date(now + 10 * 60 * 1000),
  })

  try {
    await sendLoginCode(email, code)
  } catch (error) {
    console.error('Unable to send login email', error instanceof Error ? { name: error.name, message: error.message, code: 'code' in error ? error.code : undefined } : { message: String(error) })
    try {
      await invalidateLoginCode(database, loginCode.id, new Date())
    } catch (cleanupError) {
      console.error('Unable to invalidate login code after delivery failure', cleanupError instanceof Error ? { name: cleanupError.name, message: cleanupError.message } : { message: String(cleanupError) })
    }
  }
  return GENERIC_REQUEST_RESPONSE
}

export type VerificationResult =
  | { ok: true; token: string; userId: string }
  | { ok: false }

export async function verifyCode(rawEmail: string, rawCode: string): Promise<VerificationResult> {
  const email = normalizeEmail(rawEmail)
  const now = new Date()
  const code = await findLatestUsableCode(database, email)
  if (!code || code.expiresAt <= now || code.attempts >= 5) return { ok: false }

  const expected = Buffer.from(code.codeHash, 'hex')
  const received = Buffer.from(hash(rawCode), 'hex')
  const matches = expected.length === received.length && timingSafeEqual(expected, received)
  if (!matches) {
    await recordFailedAttempt(database, code.id)
    return { ok: false }
  }

  const token = randomBytes(32).toString('hex')
  const user = await completeVerification({
    codeId: code.id,
    email,
    now,
    tokenHash: hash(token),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  })
  if (!user) return { ok: false }
  return { ok: true, token, userId: user.id }
}

export async function resolveSession(token: string | undefined): Promise<{ userId: string } | null> {
  if (!token) return null
  return findActiveSession(database, hash(token), new Date())
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) await deleteSession(database, hash(token))
}
