import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../../infrastructure/prisma.js'

export type Database = PrismaClient | Prisma.TransactionClient
export const database = prisma

export function findAllowedEmail(db: Database, email: string) {
  return db.allowedEmail.findUnique({ where: { email } })
}

export function countRecentCodes(db: Database, email: string, since: Date) {
  return db.loginCode.count({ where: { email, createdAt: { gte: since } } })
}

export function createLoginCode(db: Database, input: { email: string; codeHash: string; expiresAt: Date }) {
  return db.loginCode.create({ data: input })
}

export function findLatestUsableCode(db: Database, email: string) {
  return db.loginCode.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

export function consumeCode(db: Database, id: string, now: Date) {
  return db.loginCode.updateMany({
    where: { id, usedAt: null, attempts: { lt: 5 }, expiresAt: { gt: now } },
    data: { usedAt: now },
  })
}

export function recordFailedAttempt(db: Database, id: string) {
  return db.loginCode.updateMany({ where: { id, usedAt: null, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } })
}

export function upsertUser(db: Database, email: string) {
  return db.user.upsert({ where: { email }, create: { email }, update: {} })
}

export function createSession(db: Database, input: { userId: string; tokenHash: string; expiresAt: Date }) {
  return db.session.create({ data: input })
}

export function findActiveSession(db: Database, tokenHash: string, now: Date) {
  return db.session.findFirst({ where: { tokenHash, expiresAt: { gt: now } }, select: { userId: true } })
}

export function deleteSession(db: Database, tokenHash: string) {
  return db.session.deleteMany({ where: { tokenHash } })
}

export function completeVerification(input: { codeId: string; email: string; now: Date; tokenHash: string; expiresAt: Date }) {
  return prisma.$transaction(async (tx) => {
    const consumed = await consumeCode(tx, input.codeId, input.now)
    if (consumed.count !== 1) return null
    const user = await upsertUser(tx, input.email)
    await createSession(tx, { userId: user.id, tokenHash: input.tokenHash, expiresAt: input.expiresAt })
    return user
  })
}
