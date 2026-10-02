import nodemailer from 'nodemailer'
import { config } from './config.js'

export function createMailerOptions() {
  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
  }
}

export const mailer = nodemailer.createTransport(createMailerOptions())

async function sendWithResend(apiKey: string, email: string, subject: string, text: string): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.MAIL_FROM,
      to: [email],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Resend request failed with status ${response.status}: ${details}`)
  }
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  const subject = 'Your Sales Tracker sign-in code'
  const text = `Your Sales Tracker sign-in code is ${code}. It expires in 10 minutes.`

  if (config.RESEND_API_KEY) {
    await sendWithResend(config.RESEND_API_KEY, email, subject, text)
    return
  }

  await mailer.sendMail({
    from: config.MAIL_FROM,
    to: email,
    subject,
    text,
  })
}