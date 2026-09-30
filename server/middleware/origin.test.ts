import { describe, expect, it, vi } from 'vitest'
import { requireSameOrigin } from './origin.js'

describe('same-origin protection', () => {
  it('rejects a missing or foreign origin', () => {
    const json = vi.fn()
    const res = { status: vi.fn(() => ({ json })) } as never
    const next = vi.fn()

    requireSameOrigin({ get: () => 'https://attacker.example' } as never, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(json).toHaveBeenCalledWith({ error: { code: 'FORBIDDEN_ORIGIN', message: 'Request origin is not allowed.' } })
  })

  it('passes the configured application origin', () => {
    const next = vi.fn()

    requireSameOrigin({ get: () => 'http://localhost:5173' } as never, {} as never, next)

    expect(next).toHaveBeenCalledOnce()
  })
})