import type { Metadata, Viewport } from 'next'
import { Public_Sans } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/components/QueryProvider/QueryProvider'

const publicSans = Public_Sans({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-public-sans',
})

export const metadata: Metadata = {
  title: 'Pay with ABA PayWay',
  description:
    'Enter a US dollar amount and pay with ABA PayWay in the sandbox.',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f3f5f7',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html className={`${publicSans.variable} h-full antialiased`} lang="en">
      <body className="min-h-full bg-canvas font-sans text-ink">
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:text-ink"
          href="#main"
        >
          Skip to content
        </a>
        <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col pt-[max(2.5rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(3rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]">
          <QueryProvider>{children}</QueryProvider>
        </div>
      </body>
    </html>
  )
}
