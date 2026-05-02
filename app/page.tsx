'use client'

import Image from 'next/image'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'

type PaymentData = {
  client_id?: string
  download_qr?: string
  expire_in_sec?: string
  qr_string?: string
  request_time?: string
  status?: {
    message?: string
  }
  step?: string
  token?: string
}

type PaymentStatusData = {
  action?: string
  data?: {
    action?: string
    download_receipt?: string
    'rq-time'?: number
    message?: {
      code?: string
      message?: string
      tran_id?: string
    }
  }
  message?: string
  status?: {
    code?: string
    message?: string
    tran_id?: string
  }
}

type ToastState = {
  id: number
  message: string
  title: string
  tone: 'error' | 'success'
} | null

const amountFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const failedPaymentActions = new Set([
  'cancelled',
  'canceled',
  'declined',
  'error',
  'expired',
  'failed',
  'rejected',
  'timeout',
])

const generateDeviceId = () => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => characters[byte % characters.length]).join(
    '',
  )
}

const statusResponseErrorMessage = (data: PaymentStatusData): string => {
  if (typeof data.message === 'string') return data.message
  if (typeof data.status?.message === 'string') return data.status.message

  return 'Status failed.'
}

const paymentStatusAction = (data: PaymentStatusData | null): string | undefined =>
  data?.data?.action ?? data?.action

const paymentStatusMessage = (
  data: PaymentStatusData | null,
): string | undefined =>
  data?.data?.message?.message ?? data?.status?.message ?? data?.message

const transactionId = (data: PaymentStatusData | null): string | undefined =>
  data?.data?.message?.tran_id ?? data?.status?.tran_id

const paymentOutcome = (
  data: PaymentStatusData,
): 'failed' | 'success' | null => {
  const action = paymentStatusAction(data)?.trim().toLowerCase()

  if (action === 'approved') return 'success'
  if (action && failedPaymentActions.has(action)) return 'failed'

  return null
}

/** Seconds remaining until QR TTL from PayWay expire_in_sec, anchored when /init succeeds. After the first status includes rq-time, elapsed time blends init→first-poll locally with rq deltas so the window matches PayWay progression. */
const qrSecondsRemaining = (ctx: {
  expireSecBackend: number
  paymentReceivedAtMs: number
  firstRqTime: number | null
  lastRqTime: number | null
  lastPollAtMs: number | null
  firstPollCompletedAtMs: number | null
}): number => {
  const total = ctx.expireSecBackend
  if (total <= 0) return 0

  const localElapsedSinceInitSec = Math.max(
    0,
    (Date.now() - ctx.paymentReceivedAtMs) / 1000,
  )

  if (
    ctx.firstRqTime != null &&
    ctx.lastRqTime != null &&
    ctx.lastPollAtMs != null &&
    ctx.firstPollCompletedAtMs != null
  ) {
    const initToFirstPollSec = Math.max(
      0,
      (ctx.firstPollCompletedAtMs - ctx.paymentReceivedAtMs) / 1000,
    )
    const serverPollSpanSec = Math.max(0, ctx.lastRqTime - ctx.firstRqTime)
    const sinceLastPollSec = Math.max(0, (Date.now() - ctx.lastPollAtMs) / 1000)

    const elapsedApprox = Math.max(
      localElapsedSinceInitSec,
      initToFirstPollSec + serverPollSpanSec + sinceLastPollSec,
    )

    return Math.max(0, Math.floor(total - elapsedApprox))
  }

  return Math.max(0, Math.floor(total - localElapsedSinceInitSec))
}

const Page = () => {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [statusData, setStatusData] = useState<PaymentStatusData | null>(null)
  const [statusError, setStatusError] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const [secondsUntilQrExpires, setSecondsUntilQrExpires] = useState<
    number | null
  >(null)
  const [paywayInitTtlSec, setPaywayInitTtlSec] = useState<number | null>(null)
  const [isQrSessionExpired, setIsQrSessionExpired] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const paymentDialogRef = useRef<HTMLDialogElement>(null)
  const statusRequestInFlight = useRef(false)
  const paymentDataRef = useRef<PaymentData | null>(null)
  const qrTtlExpireSecRef = useRef(0)
  const paymentReceivedAtMsRef = useRef(0)
  const firstRqTimeRef = useRef<number | null>(null)
  const lastRqTimeRef = useRef<number | null>(null)
  const lastStatusPollAtMsRef = useRef<number | null>(null)
  const firstPollCompletedAtMsRef = useRef<number | null>(null)

  useEffect(() => {
    paymentDataRef.current = paymentData
  }, [paymentData])

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

  const amountValue = Number(amount)
  const hasValidAmount =
    amount.trim() !== '' && Number.isFinite(amountValue) && amountValue > 0
  const formattedAmount = hasValidAmount
    ? amountFormatter.format(amountValue)
    : '0.00'
  const statusAction = paymentStatusAction(statusData)
  const statusMessage = paymentStatusMessage(statusData)
  const isPaymentApproved = statusAction?.trim().toLowerCase() === 'approved'
  const canCheckStatus =
    Boolean(paymentData?.client_id) &&
    Boolean(paymentData?.request_time) &&
    Boolean(paymentData?.token) &&
    Boolean(deviceId)
  const dialogTitle = isLoading
    ? 'Preparing Secure Payment'
    : paymentData
      ? 'Scan & Confirm Payment'
      : 'Payment Session'

  const showToast = useCallback(
    (nextToast: Omit<NonNullable<ToastState>, 'id'>) => {
      setToast({ ...nextToast, id: Date.now() })
    },
    [],
  )

  useEffect(() => {
    if (!toast) return

    const id = window.setTimeout(() => {
      setToast(null)
    }, 5200)

    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!paymentData?.client_id || isPaymentApproved || isQrSessionExpired) {
      return
    }

    const tick = () => {
      const next = qrSecondsRemaining({
        expireSecBackend: qrTtlExpireSecRef.current,
        paymentReceivedAtMs: paymentReceivedAtMsRef.current,
        firstRqTime: firstRqTimeRef.current,
        lastRqTime: lastRqTimeRef.current,
        lastPollAtMs: lastStatusPollAtMsRef.current,
        firstPollCompletedAtMs: firstPollCompletedAtMsRef.current,
      })

      setSecondsUntilQrExpires(next)

      if (next <= 0) {
        setIsQrSessionExpired(true)
        setIsPaymentDialogOpen(false)
        showToast({
          message:
            'The QR code expired before PayWay approved the payment. Enter the amount again to create a fresh QR.',
          title: 'Payment Expired',
          tone: 'error',
        })
      }
    }

    tick()
    const id = window.setInterval(tick, 1000)

    return () => window.clearInterval(id)
  }, [isPaymentApproved, isQrSessionExpired, paymentData?.client_id, showToast])

  const resetQrTTLClock = () => {
    qrTtlExpireSecRef.current = 0
    paymentReceivedAtMsRef.current = 0
    firstRqTimeRef.current = null
    lastRqTimeRef.current = null
    lastStatusPollAtMsRef.current = null
    firstPollCompletedAtMsRef.current = null
    setSecondsUntilQrExpires(null)
    setPaywayInitTtlSec(null)
    setIsQrSessionExpired(false)
  }

  const checkPaymentStatus = useCallback(async () => {
    if (
      !paymentData ||
      !canCheckStatus ||
      statusRequestInFlight.current ||
      isQrSessionExpired
    ) {
      return
    }

    const expectedClientId = paymentData.client_id

    statusRequestInFlight.current = true
    setIsCheckingStatus(true)

    const isStaleSession = () =>
      paymentDataRef.current?.client_id !== expectedClientId

    try {
      const response = await fetch('/api/payway/status', {
        body: JSON.stringify({
          client_id: paymentData.client_id,
          device_id: deviceId,
          request_time: paymentData.request_time,
          token: paymentData.token,
        }),
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
      })
      const data = (await response.json()) as PaymentStatusData

      if (isStaleSession()) {
        return
      }

      if (!response.ok) {
        throw new Error(statusResponseErrorMessage(data))
      }

      const rqTime = data.data?.['rq-time']

      if (typeof rqTime === 'number') {
        if (firstRqTimeRef.current === null) {
          firstRqTimeRef.current = rqTime
          firstPollCompletedAtMsRef.current = Date.now()
        }

        lastRqTimeRef.current = rqTime
        lastStatusPollAtMsRef.current = Date.now()

        const synced = qrSecondsRemaining({
          expireSecBackend: qrTtlExpireSecRef.current,
          paymentReceivedAtMs: paymentReceivedAtMsRef.current,
          firstRqTime: firstRqTimeRef.current,
          lastRqTime: lastRqTimeRef.current,
          lastPollAtMs: lastStatusPollAtMsRef.current,
          firstPollCompletedAtMs: firstPollCompletedAtMsRef.current,
        })

        setSecondsUntilQrExpires(synced)

        if (synced <= 0) {
          setIsQrSessionExpired(true)
          setIsPaymentDialogOpen(false)
          showToast({
            message:
              'The QR code expired before PayWay approved the payment. Enter the amount again to create a fresh QR.',
            title: 'Payment Expired',
            tone: 'error',
          })
        }
      }

      setStatusData(data)
      setStatusError('')

      const outcome = paymentOutcome(data)
      if (outcome === 'success') {
        setIsPaymentDialogOpen(false)
        showToast({
          message:
            'PayWay approved the transaction. The payment session is complete.',
          title: 'Payment Successful',
          tone: 'success',
        })
      } else if (outcome === 'failed') {
        setIsPaymentDialogOpen(false)
        showToast({
          message:
            paymentStatusMessage(data) ??
            'PayWay did not approve this transaction. Try again with a new QR.',
          title: 'Payment Failed',
          tone: 'error',
        })
      }
    } catch (error) {
      if (isStaleSession()) {
        return
      }

      if (!isPaymentApproved) {
        setStatusError(
          error instanceof Error
            ? error.message
            : 'Unable to check payment status.',
        )
      }
    } finally {
      statusRequestInFlight.current = false
      setIsCheckingStatus(false)
    }
  }, [
    canCheckStatus,
    deviceId,
    isPaymentApproved,
    isQrSessionExpired,
    paymentData,
    showToast,
  ])

  useEffect(() => {
    if (!canCheckStatus || isPaymentApproved || isQrSessionExpired) {
      return
    }

    const firstStatusCheck = window.setTimeout(() => {
      void checkPaymentStatus()
    }, 0)
    const statusInterval = window.setInterval(() => {
      void checkPaymentStatus()
    }, 3000)

    return () => {
      window.clearTimeout(firstStatusCheck)
      window.clearInterval(statusInterval)
    }
  }, [
    canCheckStatus,
    checkPaymentStatus,
    isPaymentApproved,
    isQrSessionExpired,
  ])

  const handleAmountChange = (nextAmount: string) => {
    setAmount(nextAmount)
    setError('')
    resetQrTTLClock()
    setPaymentData(null)
    setStatusData(null)
    setStatusError('')
  }

  const handleProceed = async (event: FormEvent<HTMLFormElement>) => {
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
    setStatusData(null)
    setStatusError('')

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
          : 180
      paymentReceivedAtMsRef.current = Date.now()
      firstRqTimeRef.current = null
      lastRqTimeRef.current = null
      lastStatusPollAtMsRef.current = null
      firstPollCompletedAtMsRef.current = null
      setPaywayInitTtlSec(qrTtlExpireSecRef.current)
      setIsQrSessionExpired(false)
      setSecondsUntilQrExpires(
        qrSecondsRemaining({
          expireSecBackend: qrTtlExpireSecRef.current,
          paymentReceivedAtMs: paymentReceivedAtMsRef.current,
          firstRqTime: null,
          lastRqTime: null,
          lastPollAtMs: null,
          firstPollCompletedAtMs: null,
        }),
      )
      setPaymentData(data)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to initialize PayWay payment.'
      setError(message)
      setIsPaymentDialogOpen(false)
      showToast({
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

          <section
            aria-labelledby="payment-card-title"
            className="rounded-[2rem] border border-stone-950/10 bg-stone-950 p-3 shadow-2xl shadow-stone-950/20"
          >
            <div className="rounded-[1.65rem] border border-white/10 bg-[#fffaf0] p-6 shadow-inner shadow-white/40 sm:p-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.28em] text-amber-700">
                    Secure Checkout
                  </p>
                  <h2
                    className="mt-3 text-3xl font-black tracking-[-0.04em] text-stone-950"
                    id="payment-card-title"
                  >
                    PayWay Payment
                  </h2>
                </div>
                <div className="rounded-2xl bg-emerald-900 px-3 py-2 text-right text-white">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-emerald-100">
                    Total
                  </p>
                  <p className="font-mono text-lg font-black tabular-nums">
                    {formattedAmount}
                  </p>
                </div>
              </div>

              <form
                className="mt-8 space-y-5"
                id="payment-form"
                onSubmit={handleProceed}
              >
                <div className="space-y-2">
                  <label
                    className="block text-sm font-bold text-stone-800"
                    htmlFor="amount"
                  >
                    Amount
                  </label>
                  <div className="flex rounded-3xl border border-stone-950/15 bg-white shadow-sm focus-within:border-emerald-700 focus-within:ring-4 focus-within:ring-emerald-700/15">
                    <span className="grid min-w-16 place-items-center rounded-l-3xl bg-stone-100 font-mono text-sm font-black text-stone-600">
                      USD
                    </span>
                    <input
                      aria-describedby="amount-help amount-error"
                      autoComplete="off"
                      className="min-w-0 flex-1 rounded-r-3xl bg-white px-4 py-4 text-xl font-black text-stone-950 outline-none [appearance:textfield] placeholder:text-stone-400 focus-visible:outline-none"
                      id="amount"
                      inputMode="decimal"
                      min="0"
                      name="amount"
                      onChange={(event) => handleAmountChange(event.target.value)}
                      placeholder="Example: 12.50…"
                      ref={amountInputRef}
                      required
                      step="0.01"
                      type="number"
                      value={amount}
                    />
                  </div>
                  {error ? (
                    <p
                      className="text-sm font-semibold text-red-700"
                      id="amount-error"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                  <p className="text-sm leading-6 text-stone-600" id="amount-help">
                    The QR opens in a dedicated dialog so the payment session is
                    easy to follow.
                  </p>
                </div>

                <button
                  className="w-full rounded-3xl bg-stone-950 px-5 py-4 text-base font-black text-white shadow-lg shadow-stone-950/20 transition-colors duration-200 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/30 disabled:cursor-not-allowed disabled:bg-stone-400 motion-reduce:transition-none"
                  disabled={isLoading}
                  type="submit"
                >
                  {isLoading ? 'Preparing Payment…' : 'Open Payment Dialog'}
                </button>
              </form>

              {statusData ? (
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
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <dialog
        aria-labelledby="payment-dialog-title"
        className="fixed inset-0 m-auto h-fit max-h-[calc(100vh-2rem)] w-[min(calc(100vw-2rem),32rem)] rounded-[2rem] border border-white/20 bg-[#fffaf0] p-0 text-stone-950 shadow-2xl shadow-stone-950/35 backdrop:bg-stone-950/70 backdrop:backdrop-blur-sm open:motion-safe:animate-[fadeIn_160ms_ease-out]"
        onCancel={() => setIsPaymentDialogOpen(false)}
        ref={paymentDialogRef}
      >
        <div className="max-h-[min(44rem,calc(100vh-2rem))] overflow-y-auto overscroll-contain p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-700">
                Live Session
              </p>
              <h2
                className="mt-2 text-balance text-2xl font-black tracking-[-0.04em]"
                id="payment-dialog-title"
              >
                {dialogTitle}
              </h2>
            </div>
            <button
              aria-label="Close Payment Dialog"
              className="rounded-full border border-stone-950/10 bg-white px-3 py-2 text-sm font-black text-stone-700 transition-colors duration-200 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 motion-reduce:transition-none"
              onClick={() => setIsPaymentDialogOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="mt-6 rounded-[1.6rem] border border-stone-950/10 bg-white p-4 shadow-inner">
            <div className="flex items-center justify-between gap-4 border-b border-dashed border-stone-300 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                  Amount Due
                </p>
                <p className="font-mono text-3xl font-black tabular-nums text-stone-950">
                  {formattedAmount}
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-800">
                ABA
              </span>
            </div>

            {isLoading ? (
              <div
                aria-live="polite"
                className="grid min-h-80 place-items-center text-center"
              >
                <div>
                  <div
                    aria-hidden="true"
                    className="mx-auto h-14 w-14 rounded-full border-4 border-stone-200 border-t-emerald-700 motion-safe:animate-spin"
                  />
                  <p className="mt-5 font-bold text-stone-900">
                    Creating Your PayWay QR…
                  </p>
                  <p className="mt-2 text-sm text-stone-600">
                    Keep this dialog open while the payment session starts.
                  </p>
                </div>
              </div>
            ) : paymentData ? (
              <div className="pt-5 text-center">
                {paymentData.download_qr ? (
                  <Image
                    alt="PayWay payment QR code"
                    className="mx-auto h-[280px] w-56 rounded-3xl border border-stone-950/10 bg-white p-3 shadow-lg"
                    height={280}
                    src={paymentData.download_qr}
                    width={224}
                  />
                ) : (
                  <div className="grid min-h-64 place-items-center rounded-3xl bg-stone-100 p-6 text-sm font-semibold text-stone-600">
                    Waiting for PayWay QR data.
                  </div>
                )}

                <p className="mt-5 text-pretty text-sm leading-6 text-stone-700">
                  Scan with ABA Mobile or another KHQR-supported banking app.
                  This dialog closes automatically when PayWay returns a final
                  result.
                </p>

                <div className="mt-5 grid gap-3 rounded-3xl bg-stone-100 p-4 text-left sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                      Status
                    </p>
                    <p className="mt-1 font-bold text-stone-950">
                      {statusMessage ?? 'Waiting for confirmation'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                      Time Left
                    </p>
                    <p className="mt-1 font-mono font-black tabular-nums text-stone-950">
                      {secondsUntilQrExpires !== null
                        ? `${secondsUntilQrExpires}s`
                        : `${paywayInitTtlSec ?? 180}s`}
                    </p>
                  </div>
                </div>

                {statusError ? (
                  <p
                    className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900"
                    role="status"
                  >
                    {statusError}
                  </p>
                ) : null}

                <button
                  className="mt-5 w-full rounded-3xl border border-emerald-800 px-5 py-3 text-sm font-black text-emerald-900 transition-colors duration-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 disabled:cursor-not-allowed disabled:border-stone-300 disabled:text-stone-400 motion-reduce:transition-none"
                  disabled={
                    !canCheckStatus || isCheckingStatus || isQrSessionExpired
                  }
                  onClick={() => void checkPaymentStatus()}
                  type="button"
                >
                  {isCheckingStatus ? 'Checking Status…' : 'Check Status Now'}
                </button>
              </div>
            ) : (
              <div className="grid min-h-80 place-items-center text-center text-sm text-stone-600">
                Payment details will appear here after PayWay responds.
              </div>
            )}
          </div>
        </div>
      </dialog>

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-50 flex justify-center"
      >
        {toast ? (
          <div
            className={`pointer-events-auto w-full max-w-md rounded-3xl border p-4 shadow-2xl transition-opacity duration-200 motion-reduce:transition-none ${
              toast.tone === 'success'
                ? 'border-emerald-700/20 bg-emerald-950 text-white'
                : 'border-red-700/20 bg-red-950 text-white'
            }`}
            role="status"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-black">{toast.title}</p>
                <p className="mt-1 text-sm leading-6 text-white/80">
                  {toast.message}
                </p>
              </div>
              <button
                aria-label="Dismiss Notification"
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 motion-reduce:transition-none"
                onClick={() => setToast(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}

export default Page