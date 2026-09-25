'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle2, CircleAlert, TriangleAlert, X } from 'lucide-react'
import { useStore } from '@/lib/store.ts'
import { useRoute } from '@/lib/router.ts'
import { cn } from '@/lib/cn.ts'

const ICONS = {
  ok: CheckCircle2,
  warn: TriangleAlert,
  error: CircleAlert,
}

const TONES = {
  ok: 'border-ok/40 text-ok',
  warn: 'border-medium/40 text-medium',
  error: 'border-critical/40 text-critical',
}

export function Toast() {
  const toast = useStore((state) => state.toast)
  const dismiss = useStore((state) => state.dismissToast)
  const undo = useStore((state) => state.undo)
  const notify = useStore((state) => state.notify)
  const [route] = useRoute()

  // Moving to another view leaves a toast about the last one behind, over
  // whatever the new view put in that corner. One raised by the move itself,
  // as an assistant's is, is news about the new view and stays.
  const view = useRef(route.view)
  useEffect(() => {
    if (view.current === route.view) return
    view.current = route.view
    const current = useStore.getState().toast
    if (current && Date.now() - current.id > 500) dismiss()
  }, [route.view, dismiss])

  useEffect(() => {
    if (!toast) return
    // Errors carry an explanation worth reading; successes do not.
    const timeout = window.setTimeout(dismiss, toast.tone === 'ok' ? 4000 : 12000)
    return () => window.clearTimeout(timeout)
  }, [toast, dismiss])

  if (!toast) return null
  const Icon = ICONS[toast.tone]

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] no-print"
    >
      <div className={cn('panel flex gap-3 p-3', TONES[toast.tone])}>
        <Icon className="mt-0.5 size-4 flex-none" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-strong">{toast.message}</p>
          {toast.detail ? (
            <p className="mt-1 text-xs leading-snug text-muted">{toast.detail}</p>
          ) : null}
        </div>
        {toast.undoable ? (
          <button
            type="button"
            onClick={() => {
              undo()
              notify({ tone: 'ok', message: 'Undone' })
            }}
            className="self-center rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium text-strong transition-colors hover:border-accent hover:text-accent"
          >
            Undo
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-faint transition-colors hover:text-strong"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
