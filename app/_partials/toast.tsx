'use client'

import { useEffect } from 'react'
import type { ToastState } from '@/interfaces/IPayment'

type ToastProps = {
  toast: NonNullable<ToastState>
  onDismiss: () => void
}

export const Toast = ({ toast, onDismiss }: ToastProps) => {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 5000)

    return () => window.clearTimeout(id)
  }, [toast.id, onDismiss])

  return (
    <div
      className="pointer-events-auto w-full max-w-md border border-line border-l-4 bg-surface p-4 text-ink shadow-lg data-[tone=error]:border-l-danger data-[tone=success]:border-l-ok"
      data-tone={toast.tone}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-semibold text-ink">{toast.title}</p>
          <p className="break-words text-sm leading-6 text-muted">
            {toast.message}
          </p>
        </div>
        <button
          className="button-quiet shrink-0 px-3 py-1.5"
          onClick={onDismiss}
          type="button"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
