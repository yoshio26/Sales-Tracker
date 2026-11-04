// @vitest-environment jsdom
import { act, StrictMode, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, ToastViewport, useToast } from './ToastProvider'

function Controls() {
  const toast = useToast()
  return <><button onClick={() => toast.success('Stock added.')}>Success</button><button onClick={() => toast.error('Unable to save stock.')}>Error</button></>
}

function EffectNotification() {
  const toast = useToast()
  useEffect(() => { toast.success('Effect notification.') }, [toast])
  return null
}

describe('toast notifications', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root.render(<StrictMode><ToastProvider><Controls /><ToastViewport /></ToastProvider></StrictMode>))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function click(label: string) {
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent === label)
    act(() => button!.click())
  }

  it('announces success and error messages politely with explicit status labels', () => {
    const region = container.querySelector('[aria-live="polite"]')
    expect(region).not.toBeNull()
    click('Success')
    click('Error')
    expect(region!.textContent).toContain('Success')
    expect(region!.textContent).toContain('Stock added.')
    expect(region!.textContent).toContain('Error')
    expect(region!.textContent).toContain('Unable to save stock.')
  })

  it('dismisses each toast after exactly four seconds without resetting earlier timers', () => {
    click('Success')
    act(() => vi.advanceTimersByTime(2000))
    click('Error')
    act(() => vi.advanceTimersByTime(1999))
    expect(container.textContent).toContain('Stock added.')
    act(() => vi.advanceTimersByTime(1))
    expect(container.textContent).not.toContain('Stock added.')
    expect(container.textContent).toContain('Unable to save stock.')
    act(() => vi.advanceTimersByTime(2000))
    expect(container.textContent).not.toContain('Unable to save stock.')
  })

  it('manually closes only the selected toast and clears timers on unmount', () => {
    click('Success')
    click('Error')
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification: Stock added."]')!.click())
    expect(container.textContent).not.toContain('Stock added.')
    expect(container.textContent).toContain('Unable to save stock.')
    act(() => root.render(<div />))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('dismisses notifications created by mount effects during StrictMode replay', () => {
    act(() => root.render(<StrictMode><ToastProvider key="effect"><EffectNotification /><ToastViewport /></ToastProvider></StrictMode>))
    expect(container.textContent).toContain('Effect notification.')
    act(() => vi.advanceTimersByTime(4000))
    expect(container.textContent).not.toContain('Effect notification.')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns keyboard focus to the previous control when a focused toast expires', () => {
    const trigger = container.querySelector<HTMLButtonElement>('button')!
    trigger.focus()
    click('Success')
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification: Stock added."]')!.focus())
    act(() => vi.advanceTimersByTime(4000))
    expect(document.activeElement).toBe(trigger)
  })
})