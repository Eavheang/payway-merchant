'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error.message, 'digest:', error.digest)
  }, [error])

  return (
    <main className="flex scroll-mt-4 flex-col gap-3" id="main">
      <h1 className="text-balance text-2xl font-semibold text-ink">
        Something went wrong
      </h1>
      <p className="break-words text-pretty text-base leading-6 text-muted">
        {error.message || 'The page failed to load.'}
      </p>
      <button className="button-primary w-fit" onClick={reset} type="button">
        Try again
      </button>
    </main>
  )
}
