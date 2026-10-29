import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createAdjustment: vi.fn(), deleteAdjustment: vi.fn(), listAdjustments: vi.fn() }))
vi.mock('./service.js', () => mocks)

import { profitAdjustmentRouter } from './routes.ts'

type MockResponse = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> }
function response(): MockResponse {
  const json = vi.fn()
  return { status: vi.fn(() => ({ json, send: vi.fn() })), json, send: vi.fn() }
}
async function invoke(method: 'get' | 'post' | 'delete', req: Record<string, unknown>) {
  const layer = profitAdjustmentRouter.stack.find((candidate) => {
    const route = candidate.route as { path?: string; methods?: Record<string, boolean> } | undefined
    return route?.path === (method === 'delete' ? '/:id' : '/') && route.methods?.[method] === true
  })
  const route = layer?.route as { stack: Array<{ handle: (...args: never[]) => unknown }> } | undefined
  if (!route) throw new Error(`Route ${method} / is missing.`)
  const res = response()
  const handlers = route.stack.map((candidate) => candidate.handle)
  let index = 0
  const next = async (error?: unknown): Promise<void> => {
    if (error) throw error
    const handler = handlers[index++]
    if (handler) await handler(req as never, res as never, next as never)
  }
  await next()
  return res
}

const validBody = { amount: '12.50', operation: 'add', note: 'Correction' }

describe('profit adjustment routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns adjustment history for an authenticated user', async () => {
    mocks.listAdjustments.mockResolvedValue([])
    const res = await invoke('get', { userId: 'user-a', get: () => undefined })
    expect(mocks.listAdjustments).toHaveBeenCalledWith('user-a')
    expect(res.json).toHaveBeenCalledWith({ adjustments: [] })
  })

  it('rejects invalid input and foreign origins', async () => {
    const invalid = await invoke('post', { userId: 'user-a', body: { ...validBody, amount: '0' }, get: () => 'http://localhost:5173' })
    const foreign = await invoke('post', { userId: 'user-a', body: validBody, get: () => 'https://attacker.example' })
    expect(invalid.status).toHaveBeenCalledWith(400)
    expect(foreign.status).toHaveBeenCalledWith(403)
    expect(mocks.createAdjustment).not.toHaveBeenCalled()
  })

  it('creates an additive or deductive history entry', async () => {
    mocks.createAdjustment.mockResolvedValue({ id: 'adjustment-a' })
    const saved = await invoke('post', { userId: 'user-a', body: validBody, get: () => 'http://localhost:5173' })
    expect(mocks.createAdjustment).toHaveBeenCalledWith('user-a', validBody)
    expect(saved.json).toHaveBeenCalledWith({ adjustment: { id: 'adjustment-a' } })
  })

  it('soft-deletes the selected history entry', async () => {
    mocks.deleteAdjustment.mockResolvedValue({ kind: 'deleted' })
    const res = await invoke('delete', { userId: 'user-a', params: { id: '123e4567-e89b-12d3-a456-426614174000' }, get: () => 'http://localhost:5173' })
    expect(mocks.deleteAdjustment).toHaveBeenCalledWith('user-a', '123e4567-e89b-12d3-a456-426614174000')
    expect(res.status).toHaveBeenCalledWith(204)
  })
})
