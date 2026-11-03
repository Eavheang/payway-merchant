import { PaymentCheckout } from '@/app/_partials/paymentCheckout'

const Page = () => (
  <main className="flex scroll-mt-4 flex-col gap-8" id="main">
    <header className="flex flex-col gap-3">
      <h1 className="text-balance text-2xl font-semibold text-ink">
        Pay with <span translate="no">ABA PayWay</span>
      </h1>
      <p className="text-pretty text-base leading-6 text-muted">
        Enter a US dollar amount, then scan the QR with{' '}
        <span translate="no">ABA Mobile</span>. This sandbox does not make a
        live charge.
      </p>
    </header>
    <PaymentCheckout />
  </main>
)

export default Page
