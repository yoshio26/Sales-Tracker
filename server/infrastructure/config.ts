import 'dotenv/config'
import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  MAIL_FROM: z.string().email().default('no-reply@example.test'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  RATE_LIMIT_EMAIL_MAX: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_IP_MAX: z.coerce.number().int().positive().default(20),
  ALLOWLIST_EMAIL: z.string().email().optional(),
})

export const config = configSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  MAIL_FROM: process.env.MAIL_FROM,
  COOKIE_SECURE: process.env.COOKIE_SECURE,
  RATE_LIMIT_EMAIL_MAX: process.env.RATE_LIMIT_EMAIL_MAX,
  RATE_LIMIT_IP_MAX: process.env.RATE_LIMIT_IP_MAX,
  ALLOWLIST_EMAIL: process.env.ALLOWLIST_EMAIL,
})
