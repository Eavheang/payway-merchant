'use client'

import type { PaymentStatusData } from '@/interfaces/IPayment'
import { paymentStatusLabel, transactionId } from '@/utils/payment'

type PaymentStatusSectionProps = {
  statusData: PaymentStatusData | null
}

export const PaymentStatusSection = ({
  statusData,
}: PaymentStatusSectionProps) => {
  if (!statusData) return null

  const statusMessage = paymentStatusLabel(statusData)
  const id = transactionId(statusData)
  const receipt = statusData.data?.download_receipt

  return (
    <section
      aria-labelledby="payment-status-heading"
      aria-live="polite"
      className="flex flex-col gap-3 border-t border-line pt-6"
    >
      <h2 className="text-base font-semibold text-ink" id="payment-status-heading">
        Payment status
      </h2>
      <p className="break-words text-sm leading-6 text-ink">
        {statusMessage}
      </p>
      {id ? (
        <p className="break-all text-sm text-muted">
          Transaction{' '}
          <span className="font-medium text-ink" translate="no">
            {id}
          </span>
        </p>
      ) : null}
      {receipt ? (
        <a
          className="w-fit text-sm font-semibold text-ink underline decoration-line underline-offset-4 transition-colors duration-150 hover:decoration-ink motion-reduce:transition-none"
          href={receipt}
          rel="noreferrer"
          target="_blank"
        >
          Download receipt
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
    </section>
  )
}
