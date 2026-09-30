import 'dotenv/config'
import { z } from 'zod'

export const config = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ALLOWLIST_EMAIL: z.string().trim().email().optional(),
}).parse({ NODE_ENV: process.env.NODE_ENV, ALLOWLIST_EMAIL: process.env.ALLOWLIST_EMAIL })

export function normalizeSeedEmail(email: string | undefined): string | undefined {
  return email?.trim().toLowerCase()
}
