'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import type { PaymentFormValues, ToastState } from '@/interfaces/IPayment'
import {
  amountFormatter,
  generateDeviceId,
  isValidAmount,
  qrTtlSec,
} from '@/utils/payment'
import { createPayment } from '@/services/payment'
import { usePaymentPolling } from '@/hooks/usePaymentPolling'
import { useQrTimer } from '@/hooks/useQrTimer'
import { PaymentForm } from '@/app/_partials/paymentForm'
import { PaymentDialog } from '@/app/_partials/paymentDialog'
import { PaymentStatusSection } from '@/app/_partials/paymentStatusSection'
import { Toast } from '@/app/_partials/toast'

export const PaymentCheckout = () => {
  const form = useForm<PaymentFormValues>({ defaultValues: { amount: '' } })
  const amount = useWatch({ control: form.control, name: 'amount' })
  const paymentMutation = useMutation({ mutationFn: createPayment })
  const paymentData = paymentMutation.data ?? null

  const [deviceId, setDeviceId] = useState('')
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const [isQrSessionExpired, setIsQrSessionExpired] = useState(false)
  const [secondsUntilQrExpires, setSecondsUntilQrExpires] = useState<number | null>(null)
  const paymentDialogRef = useRef<HTMLDialogElement>(null)
  const qrTtlExpireSecRef = useRef(0)
  const paymentReceivedAtMsRef = useRef(0)
  const firstRqTimeRef = useRef<number | null>(null)
  const lastRqTimeRef = useRef<number | null>(null)
  const lastStatusPollAtMsRef = useRef<number | null>(null)
  const firstPollCompletedAtMsRef = useRef<number | null>(null)

  const formattedAmount = amountFormatter.format(
    isValidAmount(amount) ? Number(amount) : 0,
  )
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

  const { checkPaymentStatus, isCheckingStatus, statusData, statusError } =
    usePaymentPolling({
      paymentData,
      deviceId,
      isPaymentDialogOpen,
      isQrSessionExpired,
      canCheckStatus,
      secondsUntilQrExpires,
      qrTtlExpireSecRef,
      paymentReceivedAtMsRef,
      firstRqTimeRef,
      lastRqTimeRef,
      lastStatusPollAtMsRef,
      firstPollCompletedAtMsRef,
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
    setIsQrSessionExpired(false)
  }

  const handleAmountChange = () => {
    form.clearErrors('root')
    resetQrTTLClock()
    paymentMutation.reset()
    setSecondsUntilQrExpires(null)
  }

  const handleDialogClose = () => {
    setIsPaymentDialogOpen(false)
    resetQrTTLClock()
    setSecondsUntilQrExpires(null)
    setDeviceId('')
    paymentMutation.reset()
  }

  const handleProceed = async ({ amount }: PaymentFormValues) => {
    setIsPaymentDialogOpen(true)
    resetQrTTLClock()
    setSecondsUntilQrExpires(null)

    try {
      const data = await paymentMutation.mutateAsync(amount.trim())

      setDeviceId(generateDeviceId())
      qrTtlExpireSecRef.current = qrTtlSec(data)
      paymentReceivedAtMsRef.current = Date.now()

      const deepLink = data.mobile_deep_link
      if (deepLink) {
        showToastAction({
          message:
            'ABA Mobile is opening. Come back to this page after you pay.',
          title: 'Opening ABA Mobile',
          tone: 'success',
        })
        window.setTimeout(() => {
          window.location.href = deepLink
        }, 2000)
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to initialize PayWay payment.'
      form.setError('root.serverError', { message })
      setIsPaymentDialogOpen(false)
      showToastAction({
        message,
        title: 'Payment could not start',
        tone: 'error',
      })
    }
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        <FormProvider {...form}>
          <PaymentForm
            formattedAmount={formattedAmount}
            isLoading={paymentMutation.isPending}
            onAmountChange={handleAmountChange}
            onSubmit={(event) => form.handleSubmit(handleProceed)(event)}
          />
        </FormProvider>
        <PaymentStatusSection statusData={statusData} />
      </div>

      <PaymentDialog
        canCheckStatus={canCheckStatus}
        formattedAmount={formattedAmount}
        isCheckingStatus={isCheckingStatus}
        isLoading={paymentMutation.isPending}
        isQrSessionExpired={isQrSessionExpired}
        onClose={handleDialogClose}
        onCheckStatus={checkPaymentStatus}
        paymentData={paymentData}
        paymentDialogRef={paymentDialogRef}
        paywayInitTtlSec={paymentData ? qrTtlSec(paymentData) : null}
        secondsUntilQrExpires={secondsUntilQrExpires}
        statusData={statusData}
        statusError={statusError}
      />

      <div
        aria-atomic="true"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 flex justify-center"
      >
        {toast ? (
          <Toast onDismiss={() => setToast(null)} toast={toast} />
        ) : null}
      </div>
    </>
  )
}
