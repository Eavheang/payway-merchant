import { queryOptions } from '@tanstack/react-query'
import type { PaymentData, PaymentStatusData } from '@/interfaces/IPayment'
import { statusResponseErrorMessage } from '@/utils/payment'

export const createPayment = async (amount: string): Promise<PaymentData> => {
  const response = await fetch('/api/payway/init', {
    body: JSON.stringify({ amount }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  const data = (await response.json()) as PaymentData & { message?: string }

  if (!response.ok) {
    throw new Error(data.message ?? data.status?.message ?? 'Payment failed.')
  }

  return data
}

export const paymentStatusQueryOptions = (
  paymentData: PaymentData | null,
  deviceId: string,
) =>
  queryOptions({
    queryKey: [
      'payment',
      'status',
      paymentData?.client_id,
      paymentData?.request_time,
      paymentData?.token,
      deviceId,
    ],
    queryFn: async ({ signal }): Promise<PaymentStatusData> => {
      const response = await fetch('/api/payway/status', {
        body: JSON.stringify({
          client_id: paymentData?.client_id,
          device_id: deviceId,
          request_time: paymentData?.request_time,
          token: paymentData?.token,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        signal,
      })
      const data = (await response.json()) as PaymentStatusData

      if (!response.ok) {
        throw new Error(statusResponseErrorMessage(data))
      }

      return data
    },
    // Polling drives refreshes; focus/mount refetches would re-fire result toasts.
    staleTime: Infinity,
    retry: false,
  })
