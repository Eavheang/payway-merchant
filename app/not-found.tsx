import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f0e4] p-8">
      <div className="rounded-3xl border border-stone-900/10 bg-white p-8 text-center shadow-xl">
        <p className="font-mono text-5xl font-black text-stone-950">404</p>
        <h2 className="mt-3 text-xl font-black text-stone-900">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          The page you are looking for does not exist.
        </p>
        <Link
          className="mt-4 inline-block rounded-full bg-stone-950 px-6 py-3 text-sm font-black text-white transition-colors duration-200 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/30 motion-reduce:transition-none"
          href="/"
        >
          Back to Payment
        </Link>
      </div>
    </div>
  )
}
