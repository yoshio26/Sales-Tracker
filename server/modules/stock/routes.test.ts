import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createPurchase: vi.fn(), listPurchases: vi.fn(), listStock: vi.fn(), replenishStock: vi.fn() }))
vi.mock('./service.js', () => mocks)

import { stockRouter } from './routes.js'

function response() {
  const json = vi.fn()
  return { status: vi.fn(() => ({ json })), json }
}

type Route = { path?: string; methods?: Record<string, boolean>; stack: Array<{ handle: (...args: never[]) => unknown }> }

function handlers(path: string, method: string) {
  const layer = stockRouter.stack.find((candidate) => {
    const route = candidate.route as Pick<Route, 'path' | 'methods'> | undefined
    return route?.path === path && route.methods?.[method] === true
  })
  const route = layer?.route as Route | undefined
  if (!route) throw new Error(`Route ${method} ${path} is missing.`)
  return route.stack.map((candidate) => candidate.handle)
}

async function invoke(path: string, method: string, req: Record<string, unknown>) {
  const res = response()
  const routeHandlers = handlers(path, method)
  let index = 0
  const next = async (error?: unknown): Promise<void> => {
    if (error) throw error
    const handler = routeHandlers[index++]
    if (handler) await handler(req as never, res as never, next as never)
  }
  await next()
  return res
}

describe('stock routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects unauthenticated stock and history reads', async () => {
    expect((await invoke('/', 'get', { get: () => undefined })).status).toHaveBeenCalledWith(401)
    expect((await invoke('/purchases', 'get', { get: () => undefined })).status).toHaveBeenCalledWith(401)
  })

  it('scopes reads to the authenticated user', async () => {
    mocks.listStock.mockResolvedValue([])
    mocks.listPurchases.mockResolvedValue([])
    await invoke('/', 'get', { userId: 'user-a', get: () => undefined })
    await invoke('/purchases', 'get', { userId: 'user-a', get: () => undefined })
    expect(mocks.listStock).toHaveBeenCalledWith('user-a')
    expect(mocks.listPurchases).toHaveBeenCalledWith('user-a')
  })

  it('validates input and protects mutations with same-origin checks', async () => {
    const invalid = await invoke('/purchases', 'post', { userId: 'user-a', body: { productId: 'bad', quantity: -1, totalCost: '0' }, get: () => 'http://localhost:5173' })
    expect(invalid.status).toHaveBeenCalledWith(400)
    expect(mocks.createPurchase).not.toHaveBeenCalled()

    const foreign = await invoke('/replenish', 'post', { userId: 'user-a', body: { productId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }, get: () => 'https://attacker.example' })
    expect(foreign.status).toHaveBeenCalledWith(403)
    expect(mocks.replenishStock).not.toHaveBeenCalled()
  })

  it('returns an insufficient-stock conflict without a purchase response', async () => {
    mocks.createPurchase.mockResolvedValue({ kind: 'insufficient-stock' })
    const res = await invoke('/purchases', 'post', { userId: 'user-a', body: { productId: '123e4567-e89b-12d3-a456-426614174000', quantity: 3, totalCost: '12.50' }, get: () => 'http://localhost:5173' })
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INSUFFICIENT_STOCK', message: 'Purchase quantity exceeds available stock.' } })
  })
})