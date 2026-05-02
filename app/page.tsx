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

const generateDeviceId = () => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => characters[byte % characters.length]).join(
    '',
  )
}

const Page = () => {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [statusData, setStatusData] = useState<PaymentStatusData | null>(null)
  const [statusError, setStatusError] = useState('')
  const statusRequestInFlight = useRef(false)

  const amountValue = Number(amount)
  const hasValidAmount =
    amount.trim() !== '' && Number.isFinite(amountValue) && amountValue > 0
  const statusAction = statusData?.data?.action ?? statusData?.action
  const statusMessage =
    statusData?.data?.message?.message ??
    statusData?.status?.message ??
    statusData?.message
  const isPaymentApproved = statusAction === 'approved'
  const canCheckStatus =
    Boolean(paymentData?.client_id) &&
    Boolean(paymentData?.request_time) &&
    Boolean(paymentData?.token) &&
    Boolean(deviceId)

  const checkPaymentStatus = useCallback(async () => {
    if (!paymentData || !canCheckStatus || statusRequestInFlight.current) {
      return
    }

    statusRequestInFlight.current = true
    setIsCheckingStatus(true)

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

      if (!response.ok) {
        throw new Error(data.message ?? data.status?.message ?? 'Status failed.')
      }

      setStatusData(data)
      setStatusError('')
    } catch (error) {
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
  }, [canCheckStatus, deviceId, isPaymentApproved, paymentData])

  useEffect(() => {
    if (!canCheckStatus || isPaymentApproved) {
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
  }, [canCheckStatus, checkPaymentStatus, isPaymentApproved])

  const handleProceed = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hasValidAmount) {
      setError('Please enter an amount greater than 0 before continuing.')
      return
    }

    setError('')
    setIsLoading(true)
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
      setPaymentData(data)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to initialize PayWay payment.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 text-center shadow-2xl shadow-black/10 dark:border-white/10 dark:bg-zinc-950">
        <h1 className="text-3xl font-bold tracking-tight">Payway Testing</h1>

        <form className="mt-8 space-y-5" onSubmit={handleProceed}>
          <label className="block text-left text-sm font-medium" htmlFor="amount">
            Amount
          </label>
          <input
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-center text-lg outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 dark:border-white/10 dark:bg-zinc-900"
            id="amount"
            min="0"
            name="amount"
            onChange={(event) => {
              setAmount(event.target.value)
              setError('')
              setPaymentData(null)
              setStatusData(null)
              setStatusError('')
            }}
            placeholder="Enter amount"
            required
            step="0.01"
            type="number"
            value={amount}
          />
          {error ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Enter an amount to initialize the PayWay payment link with that
            value.
          </p>
          <button
            className="w-full rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-blue-300 disabled:hover:bg-blue-300"
            disabled={!hasValidAmount || isLoading}
            type="submit"
          >
            {isLoading ? 'Initializing payment...' : 'Proceed with payment'}
          </button>
        </form>
        {paymentData ? (
          <section
            aria-live="polite"
            className="mt-8 rounded-2xl border border-black/10 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">
              {isPaymentApproved ? 'Payment successful' : 'Payment initialized'}
            </h2>
            {paymentData.download_qr ? (
              <Image
                alt="PayWay payment QR code"
                className="mx-auto mt-4 h-70 w-56 rounded-xl bg-white p-3"
                height={280}
                src={paymentData.download_qr}
                width={224}
              />
            ) : null}
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
              {isPaymentApproved
                ? 'Your PayWay transaction has been approved.'
                : 'Scan the QR code with ABA Mobile or another KHQR-supported banking app.'}
            </p>
            {paymentData.expire_in_sec ? (
              <p className="mt-2 text-xs text-zinc-500">
                Expires in {paymentData.expire_in_sec} seconds.
              </p>
            ) : null}
            <button
              className="mt-4 w-full rounded-2xl border border-blue-600 px-5 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:border-blue-300 disabled:text-blue-300 dark:hover:bg-blue-950"
              disabled={!canCheckStatus || isCheckingStatus}
              onClick={() => void checkPaymentStatus()}
              type="button"
            >
              {isCheckingStatus ? 'Checking status...' : 'Check payment status'}
            </button>
            {statusError ? (
              <p className="mt-3 text-sm font-medium text-amber-600" role="status">
                {statusError}
              </p>
            ) : null}
            {statusData ? (
              <div className="mt-4 rounded-xl bg-white p-3 text-left text-sm dark:bg-zinc-950">
                <p>
                  <span className="font-semibold">Action:</span>{' '}
                  {statusAction ?? 'Unknown'}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">Status:</span>{' '}
                  {statusMessage ?? 'Waiting for payment update'}
                </p>
                {statusData.status?.tran_id ? (
                  <p className="mt-1 break-all text-xs text-zinc-500">
                    Transaction: {statusData.status.tran_id}
                  </p>
                ) : null}
                {statusData.data?.download_receipt ? (
                  <a
                    className="mt-3 inline-block font-semibold text-blue-600 hover:text-blue-700"
                    href={statusData.data.download_receipt}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Download receipt
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  )
}

export default Page