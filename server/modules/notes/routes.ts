import { Router } from 'express'
import { z } from 'zod'
import { requireSameOrigin } from '../../middleware/origin.js'
import { requireSession } from '../../middleware/session.js'
import { createNote, deleteNote, listNotes, updateNote } from './service.js'

const idSchema = z.object({ id: z.uuid() })
const noteSchema = z.object({ content: z.string().max(5000) })

function invalidInput(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Note text must be 5,000 characters or fewer.' } })
}

function notFound(res: { status: (code: number) => { json: (body: unknown) => unknown } }) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Note not found.' } })
}

export const notesRouter = Router()

notesRouter.get('/', requireSession, async (req, res, next) => {
  try {
    res.json({ notes: await listNotes(req.userId!) })
  } catch (error) {
    next(error)
  }
})

notesRouter.post('/', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const note = await createNote(req.userId!, noteSchema.parse(req.body).content)
    res.status(201).json({ note })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

notesRouter.put('/:id', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    const note = await updateNote(req.userId!, id, noteSchema.parse(req.body).content)
    if (!note) return notFound(res)
    res.json({ note })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})

notesRouter.delete('/:id', requireSession, requireSameOrigin, async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params)
    if (!await deleteNote(req.userId!, id)) return notFound(res)
    res.status(204).send()
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(res)
    next(error)
  }
})
