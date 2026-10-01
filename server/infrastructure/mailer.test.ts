import { describe, expect, it, vi } from 'vitest'

const config = vi.hoisted(() => ({
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: 587,
  SMTP_USER: 'gmail@example.com',
  SMTP_PASSWORD: 'app-password',
}))
const createTransport = vi.hoisted(() => vi.fn())

vi.mock('nodemailer', () => ({ default: { createTransport } }))
vi.mock('./config.js', () => ({ config }))

import { createMailerOptions } from './mailer.js'

describe('mailer configuration', () => {
  it('uses authenticated STARTTLS configuration for Gmail port 587', () => {
    config.SMTP_PORT = 587

    expect(createMailerOptions()).toEqual({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: 'gmail@example.com', pass: 'app-password' },
    })
  })

  it('uses implicit TLS only for port 465', () => {
    config.SMTP_PORT = 465

    expect(createMailerOptions().secure).toBe(true)
  })
})