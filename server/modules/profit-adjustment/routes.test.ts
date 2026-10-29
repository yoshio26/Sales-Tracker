import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ deleteAdjustment: vi.fn(), getAdjustment: vi.fn(), saveAdjustment: vi.fn() }))
vi.mock('./service.js', () => mocks)

import { profitAdjustmentRouter } from './routes.ts'

type MockResponse = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> }
function response(): MockResponse {
  const json = vi.fn()
  return { status: vi.fn(() => ({ json, send: vi.fn() })), json, send: vi.fn() }
}
async function invoke(method: 'get' | 'put' | 'delete', req: Record<string, unknown>) {
  const layer = profitAdjustmentRouter.stack.find((candidate) => {
    const route = candidate.route as { path?: string; methods?: Record<string, boolean> } | undefined
    return route?.path === '/' && route.methods?.[method] === true
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

  it('returns an empty adjustment for an authenticated user', async () => {
    mocks.getAdjustment.mockResolvedValue(null)
    const res = await invoke('get', { userId: 'user-a', get: () => undefined })
    expect(mocks.getAdjustment).toHaveBeenCalledWith('user-a')
    expect(res.json).toHaveBeenCalledWith({ adjustment: null })
  })

  it('rejects invalid input and foreign origins', async () => {
    const invalid = await invoke('put', { userId: 'user-a', body: { ...validBody, amount: '0' }, get: () => 'http://localhost:5173' })
    const foreign = await invoke('put', { userId: 'user-a', body: validBody, get: () => 'https://attacker.example' })
    expect(invalid.status).toHaveBeenCalledWith(400)
    expect(foreign.status).toHaveBeenCalledWith(403)
    expect(mocks.saveAdjustment).not.toHaveBeenCalled()
  })

  it('saves an additive or deductive adjustment and handles stale edits', async () => {
    mocks.saveAdjustment.mockResolvedValue({ kind: 'saved', adjustment: { id: 'adjustment-a' } })
    const saved = await invoke('put', { userId: 'user-a', body: validBody, get: () => 'http://localhost:5173' })
    expect(mocks.saveAdjustment).toHaveBeenCalledWith('user-a', validBody)
    expect(saved.json).toHaveBeenCalledWith({ adjustment: { id: 'adjustment-a' } })

    mocks.saveAdjustment.mockResolvedValue({ kind: 'stale' })
    const stale = await invoke('put', { userId: 'user-a', body: { ...validBody, operation: 'deduct', updatedAt: '2026-10-29T00:00:00.000Z' }, get: () => 'http://localhost:5173' })
    expect(stale.status).toHaveBeenCalledWith(409)
  })

  it('soft-deletes the current adjustment', async () => {
    mocks.deleteAdjustment.mockResolvedValue({ kind: 'deleted' })
    const res = await invoke('delete', { userId: 'user-a', get: () => 'http://localhost:5173' })
    expect(mocks.deleteAdjustment).toHaveBeenCalledWith('user-a')
    expect(res.status).toHaveBeenCalledWith(204)
  })
})
