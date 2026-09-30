import nodemailer from 'nodemailer'
import { config } from './config.js'

export const mailer = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: false,
  auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
})

export async function sendLoginCode(email: string, code: string): Promise<void> {
  await mailer.sendMail({
    from: config.MAIL_FROM,
    to: email,
    subject: 'Your Sales Tracker sign-in code',
    text: `Your Sales Tracker sign-in code is ${code}. It expires in 10 minutes.`,
  })
}
