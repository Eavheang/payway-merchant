'use client'

import type { PaymentStatusData } from '@/app/_types/payment'
import { paymentStatusMessage, transactionId } from '@/app/_helpers/payment-utils'

type PaymentStatusSectionProps = {
  statusData: PaymentStatusData | null
}

export const PaymentStatusSection = ({ statusData }: PaymentStatusSectionProps) => {
  if (!statusData) return null

  const statusMessage = paymentStatusMessage(statusData)

  return (
    <section
      aria-live="polite"
      className="mt-6 rounded-3xl border border-stone-950/10 bg-white p-4 text-sm text-stone-700"
    >
      <p className="font-bold text-stone-950">
        Last Status: {statusMessage ?? 'Waiting for payment update'}
      </p>
      {transactionId(statusData) ? (
        <p className="mt-2 break-all font-mono text-xs text-stone-500">
          Transaction: {transactionId(statusData)}
        </p>
      ) : null}
      {statusData.data?.download_receipt ? (
        <a
          className="mt-3 inline-flex font-bold text-emerald-800 underline decoration-emerald-800/30 underline-offset-4 transition-colors duration-200 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 motion-reduce:transition-none"
          href={statusData.data.download_receipt}
          rel="noreferrer"
          target="_blank"
        >
          Download Receipt
        </a>
      ) : null}
    </section>
  )
}
