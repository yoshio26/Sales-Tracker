import { createNote as createNoteRecord, deleteNote as deleteNoteRecord, listNotes as listNoteRecords, notesDatabase, updateNote as updateNoteRecord } from './data-access.js'

export type NoteResponse = { id: string; content: string; createdAt: string; updatedAt: string }

type NoteRecord = { id: string; content: string; createdAt: Date; updatedAt: Date }

function toResponse(note: NoteRecord): NoteResponse {
  return { id: note.id, content: note.content, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() }
}

export async function listNotes(userId: string) {
  return (await listNoteRecords(notesDatabase, userId)).map(toResponse)
}

export async function createNote(userId: string, content: string) {
  return toResponse(await createNoteRecord(notesDatabase, userId, content))
}

export async function updateNote(userId: string, id: string, content: string) {
  const note = await updateNoteRecord(notesDatabase, userId, id, content)
  return note ? toResponse(note) : null
}

export function deleteNote(userId: string, id: string) {
  return deleteNoteRecord(notesDatabase, userId, id)
}
