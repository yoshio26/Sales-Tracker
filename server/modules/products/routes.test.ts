import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  archiveProduct: vi.fn(),
  createProduct: vi.fn(),
  listProducts: vi.fn(),
  permanentlyDeleteArchivedProduct: vi.fn(),
  restoreArchivedProduct: vi.fn(),
  updateProduct: vi.fn(),
}))

vi.mock('./service.js', () => mocks)

import { productsRouter } from './routes.ts'

const appOrigin = process.env.APP_ORIGIN ?? 'http://localhost:5173'

type MockResponse = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }

function response(): MockResponse {
  const json = vi.fn()
  return { status: vi.fn(() => ({ json })), json }
}

async function invoke(method: 'get' | 'post' | 'put' | 'delete', path: string, req: Record<string, unknown>) {
  const layer = productsRouter.stack.find((candidate) => {
    const route = candidate.route as { path?: string; methods?: Record<string, boolean> } | undefined
    return route?.path === path && route.methods?.[method] === true
  })
  const route = layer?.route as { stack: Array<{ handle: (...args: never[]) => unknown }> } | undefined
  if (!route) throw new Error(`Route ${method} ${path} is missing.`)
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

describe('product catalog routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects unauthenticated reads', async () => {
    const res = await invoke('get', '/', { query: {}, get: () => undefined })

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('lists only the authenticated user’s active catalog', async () => {
    mocks.listProducts.mockResolvedValue([{ id: 'product-id', name: 'widget', category: 'hardware', active: true, archivedAt: null, updatedAt: '2026-09-30T12:00:00.000Z' }])

    const res = await invoke('get', '/', { userId: 'user-a', query: {}, get: () => undefined })

    expect(mocks.listProducts).toHaveBeenCalledWith('user-a', 'active')
    expect(res.json).toHaveBeenCalledWith({ products: expect.arrayContaining([expect.objectContaining({ id: 'product-id' })]) })
  })

  it('does not return products from another tenant', async () => {
    mocks.listProducts.mockResolvedValue([])

    const res = await invoke('get', '/', { userId: 'user-a', query: {}, get: () => undefined })

    expect(mocks.listProducts).toHaveBeenCalledWith('user-a', 'active')
    expect(res.json).toHaveBeenCalledWith({ products: [] })
  })

  it('validates create DTOs before calling the service', async () => {
    const res = await invoke('post', '/', { userId: 'user-a', body: { name: '', category: '' }, get: () => appOrigin })

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mocks.createProduct).not.toHaveBeenCalled()
  })

  it('rejects foreign-origin mutations before calling the service', async () => {
    const res = await invoke('delete', '/:id', { userId: 'user-a', params: { id: 'product-id' }, body: { updatedAt: '2026-09-30T12:00:00.000Z' }, get: () => 'https://attacker.example' })

    expect(res.status).toHaveBeenCalledWith(403)
    expect(mocks.archiveProduct).not.toHaveBeenCalled()
  })

  it('returns a conflict for a stale update without reporting product data', async () => {
    mocks.updateProduct.mockResolvedValue({ kind: 'stale' })

    const res = await invoke('put', '/:id', {
      userId: 'user-a',
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      body: { name: 'widget', category: 'hardware', price: '10.00', updatedAt: '2026-09-30T12:00:00.000Z' },
      get: () => appOrigin,
    })

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'STALE_PRODUCT', message: 'This product changed. Refresh and try again.' } })
  })

  it('does not reveal a foreign product during mutation', async () => {
    mocks.updateProduct.mockResolvedValue({ kind: 'not-found' })

    const res = await invoke('put', '/:id', {
      userId: 'user-a',
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      body: { name: 'widget', category: 'hardware', price: '10.00', updatedAt: '2026-09-30T12:00:00.000Z' },
      get: () => appOrigin,
    })

    expect(mocks.updateProduct).toHaveBeenCalledWith('user-a', '123e4567-e89b-12d3-a456-426614174000', expect.anything())
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('restores an archived product for the authenticated tenant', async () => {
    mocks.restoreArchivedProduct.mockResolvedValue({ kind: 'restored', product: { id: 'product-id', name: 'widget' } })

    const res = await invoke('post', '/:id/restore', {
      userId: 'user-a',
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      body: {},
      get: () => appOrigin,
    })

    expect(mocks.restoreArchivedProduct).toHaveBeenCalledWith('user-a', '123e4567-e89b-12d3-a456-426614174000')
    expect(res.json).toHaveBeenCalledWith({ product: { id: 'product-id', name: 'widget' } })
  })
})