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
    <div className="grid min-h-screen place-items-center bg-[#f6f0e4] p-8">
      <div className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
        <h2 className="text-xl font-black text-red-900">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          className="mt-4 rounded-full bg-red-900 px-6 py-3 text-sm font-black text-white transition-colors duration-200 hover:bg-red-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-700/30 motion-reduce:transition-none"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
