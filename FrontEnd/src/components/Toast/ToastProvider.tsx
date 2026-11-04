import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './Toast.module.css'

export type ToastType = 'success' | 'error'
type Toast = { id: number; message: string; type: ToastType; expiresAt: number }
type ToastApi = { success: (message: string) => void; error: (message: string) => void }
type ToastContextValue = { api: ToastApi; toasts: Toast[]; dismiss: (id: number) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback((type: ToastType, message: string) => {
    const id = ++nextId.current
    setToasts((current) => [...current, { id, type, message, expiresAt: Date.now() + 4000 }])
  }, [])

  useEffect(() => {
    const activeTimers = timers.current
    toasts.forEach((toast) => {
      activeTimers.set(toast.id, setTimeout(() => dismiss(toast.id), Math.max(0, toast.expiresAt - Date.now())))
    })
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer))
      activeTimers.clear()
    }
  }, [toasts, dismiss])

  const api = useMemo<ToastApi>(() => ({
    success: (message) => show('success', message),
    error: (message) => show('error', message),
  }), [show])
  const value = useMemo(() => ({ api, toasts, dismiss }), [api, toasts, dismiss])

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

function useToastContext() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('Toast notifications must be used inside ToastProvider.')
  return context
}

export function useToast(): ToastApi {
  return useToastContext().api
}

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const close = closeRef.current
    return () => {
      if (close === document.activeElement) {
        if (returnFocus.current?.isConnected) returnFocus.current.focus()
        else close?.parentElement?.parentElement?.focus()
      }
    }
  }, [])
  return <div className={`${styles.toast} ${styles[toast.type]}`}>
    <span className={styles.icon} aria-hidden="true">{toast.type === 'success' ? '✓' : '!'}</span>
    <div className={styles.content}><strong>{toast.type === 'success' ? 'Success' : 'Error'}</strong><span>{toast.message}</span></div>
    <button ref={closeRef} className={styles.close} type="button" aria-label={`Dismiss notification: ${toast.message}`} onFocus={(event) => { returnFocus.current = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null }} onClick={() => dismiss(toast.id)}>×</button>
  </div>
}

export function ToastViewport() {
  const { toasts, dismiss } = useToastContext()
  return <div className={styles.viewport} tabIndex={-1} aria-live="polite" aria-relevant="additions" aria-label="Notifications">
    {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />)}
  </div>
}