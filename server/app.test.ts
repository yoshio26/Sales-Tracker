import { describe, expect, it, vi } from 'vitest'
import { app } from './app.js'
import { dashboardRouter } from './modules/dashboard/routes.js'

describe('application routes', () => {
  it('mounts the protected dashboard router at the client API path', () => {
    expect(app.router.stack.some((layer) => layer.handle === dashboardRouter)).toBe(true)
  })

  it('returns the safe internal-error envelope for unexpected request failures', () => {
    const errorHandler = app.router.stack.find((layer) => layer.handle.length === 4)?.handle
    if (!errorHandler) throw new Error('Application error handler is missing.')

    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    errorHandler(new Error('database unavailable'), {} as never, { status } as never, (() => undefined) as never)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
  })
})