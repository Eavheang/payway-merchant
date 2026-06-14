'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PaymentData, ToastState } from '@/app/_types/payment'
import { amountFormatter, generateDeviceId } from '@/app/_helpers/payment-utils'
import { usePaymentPolling } from '@/app/_hooks/use-payment-polling'
import { useQrTimer } from '@/app/_hooks/use-qr-timer'
import { PaymentForm } from '@/app/_components/payment-form'
import { PaymentDialog } from '@/app/_components/payment-dialog'
import { PaymentStatusSection } from '@/app/_components/payment-status-section'
import { Toast } from '@/app/_components/toast'
import { DEFAULT_QR_TTL_SEC } from '@/app/_constants/payment'

const Page = () => {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [paywayInitTtlSec, setPaywayInitTtlSec] = useState<number | null>(null)
  const [isQrSessionExpired, setIsQrSessionExpired] = useState(false)
  const [secondsUntilQrExpires, setSecondsUntilQrExpires] = useState<number | null>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const paymentDialogRef = useRef<HTMLDialogElement>(null)
  const qrTtlExpireSecRef = useRef(0)
  const paymentReceivedAtMsRef = useRef(0)
  const firstRqTimeRef = useRef<number | null>(null)
  const lastRqTimeRef = useRef<number | null>(null)
  const lastStatusPollAtMsRef = useRef<number | null>(null)
  const firstPollCompletedAtMsRef = useRef<number | null>(null)
  const sessionCounterRef = useRef(0)

  const amountValue = Number(amount)
  const hasValidAmount =
    amount.trim() !== '' && Number.isFinite(amountValue) && amountValue > 0
  const formattedAmount = hasValidAmount
    ? amountFormatter.format(amountValue)
    : '0.00'
  const canCheckStatus =
    Boolean(paymentData?.client_id) &&
    Boolean(paymentData?.request_time) &&
    Boolean(paymentData?.token) &&
    Boolean(deviceId)

  const showToastAction = useCallback(
    (nextToast: Omit<NonNullable<ToastState>, 'id'>) => {
      setToast({ ...nextToast, id: Date.now() })
    },
    [],
  )

  const {
    checkPaymentStatus,
    isCheckingStatus,
    resetStatus,
    statusData,
    statusError,
    stopPolling,
  } = usePaymentPolling({
    paymentData,
    deviceId,
    isQrSessionExpired,
    canCheckStatus,
    secondsUntilQrExpires,
    qrTtlExpireSecRef,
    paymentReceivedAtMsRef,
    firstRqTimeRef,
    lastRqTimeRef,
    lastStatusPollAtMsRef,
    firstPollCompletedAtMsRef,
    sessionCounterRef,
    showToastAction,
    setIsPaymentDialogOpen,
    setIsQrSessionExpired,
    setSecondsUntilQrExpires,
  })

  useQrTimer({
    hasClientId: Boolean(paymentData?.client_id),
    isQrSessionExpired,
    qrTtlExpireSecRef,
    paymentReceivedAtMsRef,
    firstRqTimeRef,
    lastRqTimeRef,
    lastStatusPollAtMsRef,
    firstPollCompletedAtMsRef,
    setSecondsUntilQrExpires,
    setIsQrSessionExpired,
    setIsPaymentDialogOpen,
    showToastAction,
  })

  useEffect(() => {
    const dialog = paymentDialogRef.current
    if (!dialog) return

    if (isPaymentDialogOpen && !dialog.open) {
      dialog.showModal()
      return
    }

    if (!isPaymentDialogOpen && dialog.open) {
      dialog.close()
    }
  }, [isPaymentDialogOpen])

  const resetQrTTLClock = () => {
    qrTtlExpireSecRef.current = 0
    paymentReceivedAtMsRef.current = 0
    firstRqTimeRef.current = null
    lastRqTimeRef.current = null
    lastStatusPollAtMsRef.current = null
    firstPollCompletedAtMsRef.current = null
    setPaywayInitTtlSec(null)
    setIsQrSessionExpired(false)
  }

  const handleAmountChange = (nextAmount: string) => {
    setAmount(nextAmount)
    setError('')
    resetQrTTLClock()
    setPaymentData(null)
    resetStatus()
  }

  const handleDialogClose = useCallback(() => {
    setIsPaymentDialogOpen(false)
    resetQrTTLClock()
    stopPolling()
  }, [stopPolling])

  const handleProceed = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hasValidAmount) {
      setError('Enter an amount greater than 0 to create a payment QR.')
      amountInputRef.current?.focus()
      return
    }

    setError('')
    setIsLoading(true)
    setIsPaymentDialogOpen(true)
    resetQrTTLClock()
    setPaymentData(null)
    resetStatus()
    stopPolling()
    sessionCounterRef.current += 1

    try {
      const response = await fetch('/api/payway/init', {
        body: JSON.stringify({ amount: amount.trim() }),
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
      })
      const data = (await response.json()) as PaymentData & { message?: string }

      if (!response.ok) {
        throw new Error(data.message ?? data.status?.message ?? 'Payment failed.')
      }

      setDeviceId(generateDeviceId())
      const backendTtlSec = Number(data.expire_in_sec)

      qrTtlExpireSecRef.current =
        Number.isFinite(backendTtlSec) && backendTtlSec > 0
          ? backendTtlSec
          : DEFAULT_QR_TTL_SEC
      paymentReceivedAtMsRef.current = Date.now()
      firstRqTimeRef.current = null
      lastRqTimeRef.current = null
      lastStatusPollAtMsRef.current = null
      firstPollCompletedAtMsRef.current = null
      setPaywayInitTtlSec(qrTtlExpireSecRef.current)
      setIsQrSessionExpired(false)
      setPaymentData(data)

      if (data.mobile_deep_link) {
        showToastAction({
          message:
            'ABA Mobile is opening now. Return here after payment to follow the status.',
          title: 'Opening ABA Mobile',
          tone: 'success',
        })
        window.setTimeout(() => {
          window.location.href = data.mobile_deep_link!
        }, 2000)
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to initialize PayWay payment.'
      setError(message)
      setIsPaymentDialogOpen(false)
      showToastAction({
        message,
        title: 'Payment Could Not Start',
        tone: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <a
        className="sr-only rounded-full bg-stone-950 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
        href="#payment-form"
      >
        Skip to Payment Form
      </a>

      <main
        className="relative min-h-screen overflow-x-hidden bg-[#f6f0e4] px-5 py-8 text-stone-950 sm:px-8 lg:px-12"
        id="main-content"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(217,119,6,0.22),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(6,95,70,0.18),transparent_28%),linear-gradient(135deg,rgba(68,64,60,0.09)_0_1px,transparent_1px_18px)]"
        />
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-stone-900/10 bg-white/70 px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm backdrop-blur">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full bg-emerald-600 shadow-[0_0_0_5px_rgba(5,150,105,0.12)]"
              />
              ABA PayWay Sandbox
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-balance text-5xl font-black leading-[0.95] tracking-[-0.06em] text-stone-950 sm:text-6xl lg:text-7xl">
                A calmer way to test payments.
              </h1>
              <p className="max-w-2xl text-pretty text-lg leading-8 text-stone-700">
                Enter an amount, open a focused PayWay session, and keep the QR,
                countdown, and payment status in one clear dialog.
              </p>
            </div>

            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {['Amount first', 'QR in dialog', 'Toast on result'].map(
                (item, index) => (
                  <div
                    className="rounded-3xl border border-stone-900/10 bg-white/70 p-4 shadow-sm backdrop-blur"
                    key={item}
                  >
                    <p className="font-mono text-xs font-bold text-emerald-700">
                      0{index + 1}
                    </p>
                    <p className="mt-2 text-sm font-bold text-stone-900">
                      {item}
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>

          <div className="space-y-0">
            <PaymentForm
              amount={amount}
              amountInputRef={amountInputRef}
              error={error}
              formattedAmount={formattedAmount}
              isLoading={isLoading}
              onAmountChange={handleAmountChange}
              onSubmit={handleProceed}
            />
            <PaymentStatusSection statusData={statusData} />
          </div>
        </div>
      </main>

      <PaymentDialog
        canCheckStatus={canCheckStatus}
        formattedAmount={formattedAmount}
        isCheckingStatus={isCheckingStatus}
        isLoading={isLoading}
        isQrSessionExpired={isQrSessionExpired}
        onClose={handleDialogClose}
        onCheckStatus={checkPaymentStatus}
        paymentData={paymentData}
        paymentDialogRef={paymentDialogRef}
        paywayInitTtlSec={paywayInitTtlSec}
        secondsUntilQrExpires={secondsUntilQrExpires}
        statusData={statusData}
        statusError={statusError}
      />

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-50 flex justify-center"
      >
        {toast ? (
          <Toast onDismiss={() => setToast(null)} toast={toast} />
        ) : null}
      </div>
    </>
  )
}

export default Page
