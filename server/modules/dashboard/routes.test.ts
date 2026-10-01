import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDashboard = vi.hoisted(() => vi.fn())
vi.mock('./service.js', () => ({ getDashboard }))

import { dashboardRouter } from './routes.js'

function response() {
  const json = vi.fn()
  return { status: vi.fn(() => ({ json })), json }
}

async function invoke(query: Record<string, unknown>, userId?: string) {
  const layer = dashboardRouter.stack.find((candidate) => candidate.route?.path === '/' && candidate.route.methods.get)
  if (!layer) throw new Error('Dashboard route is missing.')
  const res = response()
  const handlers = layer.route.stack.map((candidate) => candidate.handle)
  let index = 0
  const next = async (error?: unknown): Promise<void> => {
    if (error) throw error
    const handler = handlers[index++]
    if (handler) await handler({ query, userId } as never, res as never, next as never)
  }
  await next()
  return res
}

describe('dashboard routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects unauthenticated requests', async () => {
    const res = await invoke({})
    expect(res.status).toHaveBeenCalledWith(401)
    expect(getDashboard).not.toHaveBeenCalled()
  })

  it('passes the session user to the dashboard service', async () => {
    getDashboard.mockResolvedValue({ currentMonth: {}, allTime: {} })
    const res = await invoke({}, 'user-a')
    expect(getDashboard).toHaveBeenCalledWith('user-a', expect.any(Date), {})
    expect(res.json).toHaveBeenCalledWith({ currentMonth: {}, allTime: {} })
  })

  it('passes a valid half-open range to the service', async () => {
    getDashboard.mockResolvedValue({ currentMonth: {}, allTime: {} })
    await invoke({ from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }, 'user-a')
    expect(getDashboard).toHaveBeenCalledWith('user-a', expect.any(Date), { from: new Date('2026-10-01T00:00:00.000Z'), to: new Date('2026-11-01T00:00:00.000Z') })
  })

  it('rejects incomplete and reversed date ranges', async () => {
    const incomplete = await invoke({ from: '2026-10-01T00:00:00.000Z' }, 'user-a')
    const reversed = await invoke({ from: '2026-10-02T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' }, 'user-a')
    expect(incomplete.status).toHaveBeenCalledWith(400)
    expect(reversed.status).toHaveBeenCalledWith(400)
    expect(incomplete.json).toHaveBeenCalledWith({ error: { code: 'INVALID_INPUT', message: 'Enter a valid reporting date range.' } })
    expect(reversed.json).toHaveBeenCalledWith({ error: { code: 'INVALID_INPUT', message: 'Enter a valid reporting date range.' } })
    expect(getDashboard).not.toHaveBeenCalled()
  })

  it('rejects malformed date ranges with the safe validation envelope', async () => {
    const malformedFrom = await invoke({ from: 'not-a-date', to: '2026-10-01T00:00:00.000Z' }, 'user-a')
    const malformedTo = await invoke({ from: '2026-10-01T00:00:00.000Z', to: '2026-13-01T00:00:00.000Z' }, 'user-a')

    expect(malformedFrom.status).toHaveBeenCalledWith(400)
    expect(malformedTo.status).toHaveBeenCalledWith(400)
    expect(malformedFrom.json).toHaveBeenCalledWith({ error: { code: 'INVALID_INPUT', message: 'Enter a valid reporting date range.' } })
    expect(malformedTo.json).toHaveBeenCalledWith({ error: { code: 'INVALID_INPUT', message: 'Enter a valid reporting date range.' } })
    expect(getDashboard).not.toHaveBeenCalled()
  })

  it('forwards dashboard failures to the application error envelope', async () => {
    const failure = new Error('database unavailable')
    getDashboard.mockRejectedValue(failure)
    const next = vi.fn()
    const layer = dashboardRouter.stack.find((candidate) => candidate.route?.path === '/' && candidate.route.methods.get)
    if (!layer) throw new Error('Dashboard route is missing.')
    const handlers = layer.route.stack.map((candidate) => candidate.handle)
    let index = 0
    const req = { query: {}, userId: 'user-a' }
    const res = response()
    const invokeNext = async (error?: unknown): Promise<void> => {
      if (error) next(error)
      const handler = handlers[index++]
      if (handler) await handler(req as never, res as never, invokeNext as never)
    }

    await invokeNext()

    expect(next).toHaveBeenCalledWith(failure)
  })
})