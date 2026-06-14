export type PaymentData = {
  client_id?: string
  download_qr?: string
  expire_in_sec?: string
  mobile_deep_link?: string
  qr_string?: string
  request_time?: string
  status?: {
    message?: string
  }
  step?: string
  token?: string
}

export type PaymentStatusData = {
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

export type ToastState = {
  id: number
  message: string
  title: string
  tone: 'error' | 'success'
} | null

export type QrTimerContext = {
  expireSecBackend: number
  paymentReceivedAtMs: number
  firstRqTime: number | null
  lastRqTime: number | null
  lastPollAtMs: number | null
  firstPollCompletedAtMs: number | null
}
