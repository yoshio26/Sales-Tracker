import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createExpense: vi.fn(),
  deleteExpense: vi.fn(),
  getExpense: vi.fn(),
  listExpenses: vi.fn(),
  updateExpense: vi.fn(),
}))

vi.mock('./service.js', () => mocks)

import { expensesRouter } from './routes.ts'

type MockResponse = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> }

function response(): MockResponse {
  const json = vi.fn()
  return { status: vi.fn(() => ({ json, send: vi.fn() })), json, send: vi.fn() }
}

async function invoke(method: 'get' | 'post' | 'put' | 'delete', path: string, req: Record<string, unknown>) {
  const layer = expensesRouter.stack.find((candidate) => candidate.route?.path === path && candidate.route.methods[method])
  if (!layer) throw new Error(`Route ${method} ${path} is missing.`)
  const res = response()
  const handlers = layer.route.stack.map((candidate) => candidate.handle)
  let index = 0
  const next = async (error?: unknown): Promise<void> => {
    if (error) throw error
    const handler = handlers[index++]
    if (handler) await handler(req as never, res as never, next as never)
  }
  await next()
  return res
}

const validBody = { productId: '123e4567-e89b-12d3-a456-426614174000', amount: '12.50', quantity: 1, note: '', spentAt: '2026-10-01T00:00:00.000Z' }

describe('expense routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects unauthenticated reads', async () => {
    const res = await invoke('get', '/', { query: {}, get: () => undefined })
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('lists expenses for the session user and validates filters', async () => {
    mocks.listExpenses.mockResolvedValue([])
    const res = await invoke('get', '/', { userId: 'user-a', query: {}, get: () => undefined })
    expect(mocks.listExpenses).toHaveBeenCalledWith('user-a', {})
    expect(res.json).toHaveBeenCalledWith({ expenses: [] })
  })

  it('requires same-origin protection and validates create DTOs', async () => {
    const invalid = await invoke('post', '/', { userId: 'user-a', body: { ...validBody, amount: '0' }, get: () => 'http://localhost:5173' })
    expect(invalid.status).toHaveBeenCalledWith(400)
    expect(mocks.createExpense).not.toHaveBeenCalled()

    const foreign = await invoke('post', '/', { userId: 'user-a', body: validBody, get: () => 'https://attacker.example' })
    expect(foreign.status).toHaveBeenCalledWith(403)
    expect(mocks.createExpense).not.toHaveBeenCalled()
  })

  it('returns a stale conflict without returning expense data', async () => {
    mocks.updateExpense.mockResolvedValue({ kind: 'stale' })
    const res = await invoke('put', '/:id', { userId: 'user-a', params: { id: '123e4567-e89b-12d3-a456-426614174000' }, body: { ...validBody, updatedAt: '2026-10-01T00:00:00.000Z' }, get: () => 'http://localhost:5173' })
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'STALE_EXPENSE', message: 'This expense changed. Refresh and try again.' } })
  })

  it('soft-deletes through an idempotent endpoint', async () => {
    mocks.deleteExpense.mockResolvedValue({ kind: 'deleted' })
    const res = await invoke('delete', '/:id', { userId: 'user-a', params: { id: '123e4567-e89b-12d3-a456-426614174000' }, get: () => 'http://localhost:5173' })
    expect(mocks.deleteExpense).toHaveBeenCalledWith('user-a', '123e4567-e89b-12d3-a456-426614174000')
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('does not reveal unknown expense IDs during deletion', async () => {
    mocks.deleteExpense.mockResolvedValue({ kind: 'not-found' })
    const res = await invoke('delete', '/:id', { userId: 'user-a', params: { id: '123e4567-e89b-12d3-a456-426614174000' }, get: () => 'http://localhost:5173' })
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
