import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex scroll-mt-4 flex-col gap-3" id="main">
      <h1 className="text-balance text-2xl font-semibold text-ink">
        Page not found
      </h1>
      <p className="text-pretty text-base leading-6 text-muted">
        This address does not match a page.
      </p>
      <Link className="button-primary w-fit" href="/">
        Back to payment
      </Link>
    </main>
  )
}
