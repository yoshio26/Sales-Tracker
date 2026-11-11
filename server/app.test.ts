import { describe, expect, it, vi } from 'vitest'
import { app } from './app.js'
import { dashboardRouter } from './modules/dashboard/routes.js'
import { ImageError } from './infrastructure/images.js'

describe('application routes', () => {
  it('allows only the targeted Cloudinary external image origin in CSP', async () => {
    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    try {
      const { port } = server.address() as { port: number }
      const response = await fetch(`http://127.0.0.1:${port}/healthz`)
      const csp = response.headers.get('content-security-policy')!
      const imagePolicy = csp.split(';').find((directive) => directive.startsWith('img-src'))
      expect(imagePolicy).toBe("img-src 'self' data: blob: https://res.cloudinary.com")
      expect(imagePolicy).not.toContain('*')
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
  })

  it.each([400, 413, 503])('returns clear photo errors with status %i', (code) => {
    const handler = app.router.stack.find((layer) => layer.handle.length === 4)!.handle
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    handler(new ImageError(code, 'PHOTO_ERROR', 'Photo validation failed.'), {} as never, { status } as never, vi.fn())
    expect(status).toHaveBeenCalledWith(code)
    expect(json).toHaveBeenCalledWith({ error: { code: 'PHOTO_ERROR', message: 'Photo validation failed.' } })
  })
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