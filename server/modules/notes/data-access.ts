import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../../infrastructure/prisma.js'

export type NotesDatabase = PrismaClient | Prisma.TransactionClient
export const notesDatabase = prisma

const noteSelection = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NoteSelect

export function listNotes(db: NotesDatabase, userId: string) {
  return db.note.findMany({
    where: { userId },
    select: noteSelection,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  })
}

export function createNote(db: PrismaClient, userId: string, content: string) {
  return db.note.create({ data: { userId, content }, select: noteSelection })
}

export async function updateNote(db: PrismaClient, userId: string, id: string, content: string) {
  const updatedAt = new Date()
  const changed = await db.note.updateMany({ where: { id, userId }, data: { content, updatedAt } })
  if (changed.count !== 1) return null
  return db.note.findFirstOrThrow({ where: { id, userId }, select: noteSelection })
}

export async function deleteNote(db: PrismaClient, userId: string, id: string) {
  const deleted = await db.note.deleteMany({ where: { id, userId } })
  return deleted.count === 1
}
