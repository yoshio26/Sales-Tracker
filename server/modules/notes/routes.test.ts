import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createNote: vi.fn(), deleteNote: vi.fn(), listNotes: vi.fn(), updateNote: vi.fn() }))
vi.mock('./service.js', () => mocks)

import { notesRouter } from './routes.ts'
import { config } from '../../infrastructure/config.js'

type MockResponse = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> }
function response(): MockResponse { const json = vi.fn(); return { status: vi.fn(() => ({ json, send: vi.fn() })), json, send: vi.fn() } }
async function invoke(method: 'get' | 'post' | 'put' | 'delete', path: string, req: Record<string, unknown>) {
  const layer = notesRouter.stack.find((candidate) => { const route = candidate.route as { path?: string; methods?: Record<string, boolean> } | undefined; return route?.path === path && route.methods?.[method] === true })
  const route = layer?.route as { stack: Array<{ handle: (...args: never[]) => unknown }> } | undefined
  if (!route) throw new Error(`Route ${method} ${path} is missing.`)
  const res = response(); const handlers = route.stack.map((candidate) => candidate.handle); let index = 0
  const next = async (error?: unknown): Promise<void> => { if (error) throw error; const handler = handlers[index++]; if (handler) await handler(req as never, res as never, next as never) }
  await next(); return res
}

describe('notes routes', () => {
  beforeEach(() => vi.clearAllMocks())
  it('lists notes for the signed-in user', async () => { mocks.listNotes.mockResolvedValue([]); const res = await invoke('get', '/', { userId: 'user-a', get: () => undefined }); expect(mocks.listNotes).toHaveBeenCalledWith('user-a'); expect(res.json).toHaveBeenCalledWith({ notes: [] }) })
  it('validates note content before creating', async () => { const res = await invoke('post', '/', { userId: 'user-a', body: { content: 'x'.repeat(5001) }, get: () => config.APP_ORIGIN }); expect(res.status).toHaveBeenCalledWith(400); expect(mocks.createNote).not.toHaveBeenCalled() })
  it('creates a note', async () => { const note = { id: 'note-a', content: 'Remember this', createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T00:00:00.000Z' }; mocks.createNote.mockResolvedValue(note); const res = await invoke('post', '/', { userId: 'user-a', body: { content: note.content }, get: () => config.APP_ORIGIN }); expect(mocks.createNote).toHaveBeenCalledWith('user-a', note.content); expect(res.status).toHaveBeenCalledWith(201) })
})
