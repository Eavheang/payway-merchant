import Image from 'next/image'
import type { RefObject } from 'react'
import type { PaymentData, PaymentStatusData } from '@/interfaces/IPayment'
import {
  DEFAULT_QR_TTL_SEC,
  formatSeconds,
  paymentStatusLabel,
} from '@/utils/payment'

type PaymentDialogProps = {
  isLoading: boolean
  paymentData: PaymentData | null
  formattedAmount: string
  secondsUntilQrExpires: number | null
  paywayInitTtlSec: number | null
  statusError: string
  canCheckStatus: boolean
  isCheckingStatus: boolean
  isQrSessionExpired: boolean
  statusData: PaymentStatusData | null
  paymentDialogRef: RefObject<HTMLDialogElement | null>
  onClose: () => void
  onCheckStatus: () => void
}

export const PaymentDialog = ({
  isLoading,
  paymentData,
  formattedAmount,
  secondsUntilQrExpires,
  paywayInitTtlSec,
  statusError,
  canCheckStatus,
  isCheckingStatus,
  isQrSessionExpired,
  statusData,
  paymentDialogRef,
  onClose,
  onCheckStatus,
}: PaymentDialogProps) => {
  const dialogTitle = isLoading
    ? 'Creating payment'
    : paymentData
      ? 'Scan to pay'
      : 'Payment'
  const statusMessage = paymentStatusLabel(statusData)
  const secondsLeft =
    secondsUntilQrExpires ?? paywayInitTtlSec ?? DEFAULT_QR_TTL_SEC

  return (
    <dialog
      aria-busy={isLoading}
      aria-labelledby="payment-dialog-title"
      className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),28rem)] overflow-hidden rounded-lg border border-line bg-surface p-0 text-ink shadow-lg open:motion-safe:animate-[fadeIn_160ms_ease-out]"
      onCancel={onClose}
      ref={paymentDialogRef}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col gap-5 overflow-y-auto overscroll-contain p-5">
        <div className="flex items-start justify-between gap-4">
          <h2
            className="min-w-0 text-balance text-xl font-semibold text-ink"
            id="payment-dialog-title"
          >
            {dialogTitle}
          </h2>
          <button className="button-quiet shrink-0 px-3 py-2" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <p className="text-3xl font-semibold tabular-nums text-ink">
          {formattedAmount}
        </p>

        {isLoading ? (
          <div aria-live="polite" className="flex flex-col gap-3 py-16">
            <div
              aria-hidden="true"
              className="h-8 w-8 rounded-full border-2 border-line border-t-ink motion-safe:animate-spin motion-reduce:hidden"
            />
            <p className="font-semibold text-ink">Creating payment…</p>
            <p className="text-sm leading-6 text-muted">
              Keep this dialog open until the QR code appears.
            </p>
          </div>
        ) : paymentData ? (
          <div className="flex flex-col gap-5">
            {paymentData.download_qr ? (
              <Image
                alt="PayWay payment QR code"
                className="h-56 w-56 self-center border border-line bg-surface p-2"
                height={224}
                src={paymentData.download_qr}
                unoptimized
                width={224}
              />
            ) : (
              <p className="border border-line px-4 py-10 text-sm text-muted">
                The QR code is not ready yet. Keep this dialog open.
              </p>
            )}

            <p className="text-pretty text-sm leading-6 text-muted">
              Scan this code with <span translate="no">ABA Mobile</span>. This
              dialog closes when <span translate="no">PayWay</span> returns a
              result.
            </p>

            <dl className="grid gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <dt className="text-muted">Time left</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {formatSeconds(secondsLeft)}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-muted">Status</dt>
                <dd className="break-words font-semibold text-ink">
                  {statusMessage}
                </dd>
              </div>
            </dl>

            {statusError ? (
              <p className="text-sm font-medium text-danger" role="status">
                {statusError.endsWith('.') ? statusError : `${statusError}.`}{' '}
                Try Check status again.
              </p>
            ) : null}

            <button
              className="button-quiet w-full"
              disabled={!canCheckStatus || isCheckingStatus || isQrSessionExpired}
              onClick={() => void onCheckStatus()}
              type="button"
            >
              {isCheckingStatus ? 'Checking status…' : 'Check status'}
            </button>
          </div>
        ) : (
          <p className="py-16 text-sm leading-6 text-muted">
            Payment details appear here after PayWay responds.
          </p>
        )}
      </div>
    </dialog>
  )
}
