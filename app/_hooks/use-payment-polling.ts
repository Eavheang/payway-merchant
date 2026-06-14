'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PaymentData, PaymentStatusData } from '@/app/_types/payment'
import {
  getPollIntervalMs,
  paymentOutcome,
  paymentStatusMessage,
  qrSecondsRemaining,
  statusResponseErrorMessage,
} from '@/app/_helpers/payment-utils'

type UsePaymentPollingInput = {
  paymentData: PaymentData | null
  deviceId: string
  isQrSessionExpired: boolean
  canCheckStatus: boolean
  secondsUntilQrExpires: number | null
  qrTtlExpireSecRef: React.MutableRefObject<number>
  paymentReceivedAtMsRef: React.MutableRefObject<number>
  firstRqTimeRef: React.MutableRefObject<number | null>
  lastRqTimeRef: React.MutableRefObject<number | null>
  lastStatusPollAtMsRef: React.MutableRefObject<number | null>
  firstPollCompletedAtMsRef: React.MutableRefObject<number | null>
  sessionCounterRef: React.MutableRefObject<number>
  showToast: (toast: { message: string; title: string; tone: 'error' | 'success' }) => void
  setIsPaymentDialogOpen: (open: boolean) => void
  setIsQrSessionExpired: (expired: boolean) => void
  setSecondsUntilQrExpires: (sec: number | null) => void
}

export const usePaymentPolling = ({
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
  showToast,
  setIsPaymentDialogOpen,
  setIsQrSessionExpired,
  setSecondsUntilQrExpires,
}: UsePaymentPollingInput) => {
  const [statusData, setStatusData] = useState<PaymentStatusData | null>(null)
  const [statusError, setStatusError] = useState('')
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const statusRequestInFlight = useRef(false)
  const pollingIntervalRef = useRef<number | null>(null)
  const pollTimeoutRef = useRef<number | null>(null)
  const hasReachedTerminalState = useRef(false)

  const checkPaymentStatus = useCallback(async () => {
    if (
      !paymentData ||
      !canCheckStatus ||
      statusRequestInFlight.current ||
      isQrSessionExpired ||
      hasReachedTerminalState.current
    ) {
      return
    }

    const expectedSession = sessionCounterRef.current
    const currentPaymentData = paymentData
    if (!currentPaymentData) return
    const expectedClientId = currentPaymentData.client_id

    statusRequestInFlight.current = true
    setIsCheckingStatus(true)

    const isStaleSession = () =>
      sessionCounterRef.current !== expectedSession ||
      paymentData?.client_id !== expectedClientId

    try {
      const response = await fetch('/api/payway/status', {
        body: JSON.stringify({
          client_id: currentPaymentData.client_id,
          device_id: deviceId,
          request_time: currentPaymentData.request_time,
          token: currentPaymentData.token,
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
        hasReachedTerminalState.current = true
        setIsPaymentDialogOpen(false)
        showToast({
          message:
            'PayWay approved the transaction. The payment session is complete.',
          title: 'Payment Successful',
          tone: 'success',
        })
      } else if (outcome === 'failed') {
        hasReachedTerminalState.current = true
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

      setStatusError(
        error instanceof Error
          ? error.message
          : 'Unable to check payment status.',
      )
    } finally {
      statusRequestInFlight.current = false
      setIsCheckingStatus(false)
    }
  }, [
    canCheckStatus,
    deviceId,
    isQrSessionExpired,
    paymentData,
    showToast,
    sessionCounterRef,
    qrTtlExpireSecRef,
    paymentReceivedAtMsRef,
    firstRqTimeRef,
    lastRqTimeRef,
    lastStatusPollAtMsRef,
    firstPollCompletedAtMsRef,
    setIsPaymentDialogOpen,
    setIsQrSessionExpired,
    setSecondsUntilQrExpires,
  ])

  useEffect(() => {
    if (!canCheckStatus || isQrSessionExpired || hasReachedTerminalState.current) {
      return
    }

    const pollIntervalMs = getPollIntervalMs(secondsUntilQrExpires)

    const firstStatusCheck = window.setTimeout(() => {
      void checkPaymentStatus()
    }, 0)
    const statusInterval = window.setInterval(() => {
      void checkPaymentStatus()
    }, pollIntervalMs)

    pollingIntervalRef.current = statusInterval
    pollTimeoutRef.current = firstStatusCheck

    return () => {
      if (pollTimeoutRef.current) {
        window.clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
      if (pollingIntervalRef.current) {
        window.clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [
    canCheckStatus,
    checkPaymentStatus,
    isQrSessionExpired,
    secondsUntilQrExpires,
  ])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  const resetStatus = useCallback(() => {
    setStatusData(null)
    setStatusError('')
    setSecondsUntilQrExpires(null)
    hasReachedTerminalState.current = false
  }, [setSecondsUntilQrExpires])

  return {
    checkPaymentStatus,
    isCheckingStatus,
    resetStatus,
    statusData,
    statusError,
    stopPolling,
  }
}
