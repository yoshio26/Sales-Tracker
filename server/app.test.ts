import { describe, expect, it } from 'vitest'
import { app } from './app.js'
import { dashboardRouter } from './modules/dashboard/routes.js'

describe('application routes', () => {
  it('mounts the protected dashboard router at the client API path', () => {
    expect(app.router.stack.some((layer) => layer.handle === dashboardRouter)).toBe(true)
  })
})