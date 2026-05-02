import { createHash } from 'crypto'
import { NextResponse } from 'next/server'

const paywayLinkUrl = 'https://link.payway.com.kh/ABAPAYWn438575v'
const paywayApiUrl =
  'https://pwapp.ababank.com/api/pw-app/v1/payment/gateway/list-payment-options'

const mobileUserAgentPattern =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Windows Phone/i

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isMobileDevice = (userAgent: string) =>
  mobileUserAgentPattern.test(userAgent)

const extractPaywayState = (html: string) => {
  const abaDataMatch = html.match(/p\.aba_data="([^"]+)"/)
  const requestTimeMatch = html.match(/request_time:"(\d+)"/)

  if (!abaDataMatch?.[1] || !requestTimeMatch?.[1]) {
    throw new Error('Unable to read PayWay payment link data.')
  }

  return {
    abaData: JSON.parse(`"${abaDataMatch[1]}"`) as string,
    requestTime: requestTimeMatch[1],
  }
}

const withDevicePaymentOption = (paymentData: unknown, isMobile: boolean) => {
  if (
    !isMobile ||
    !isRecord(paymentData) ||
    !isRecord(paymentData.payment_options)
  ) {
    return paymentData
  }

  const { abapay_khqr, ...paymentOptions } = paymentData.payment_options

  if (!abapay_khqr) {
    return paymentData
  }

  return {
    ...paymentData,
    payment_options: {
      ...paymentOptions,
      abapay_khqr_deeplink: abapay_khqr,
    },
  }
}

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as { amount?: unknown }
    const userAgent = request.headers.get('user-agent') ?? ''
    const isMobile = isMobileDevice(userAgent)
    const amount =
      typeof body.amount === 'string' ? body.amount.trim() : String(body.amount ?? '')
    const amountValue = Number(amount)

    if (!amount || !Number.isFinite(amountValue) || amountValue <= 0) {
      return NextResponse.json(
        { message: 'Please enter an amount greater than 0.' },
        { status: 400 },
      )
    }

    const linkResponse = await fetch(paywayLinkUrl, {
      cache: 'no-store',
      headers: userAgent ? { 'user-agent': userAgent } : undefined,
    })

    if (!linkResponse.ok) {
      throw new Error('Unable to load PayWay payment link.')
    }

    const { abaData, requestTime } = extractPaywayState(await linkResponse.text())
    const additionalFields = JSON.stringify({ amount })
    const hash = createHash('sha512')
      .update(requestTime + abaData + additionalFields)
      .digest('hex')

    const paywayResponse = await fetch(paywayApiUrl, {
      body: JSON.stringify({
        additional_fields: additionalFields,
        request_time: requestTime,
        aba_data: abaData,
        hash,
      }),
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        language: 'en',
        ...(userAgent ? { 'user-agent': userAgent } : {}),
      },
      method: 'POST',
    })

    const paymentData = withDevicePaymentOption(
      await paywayResponse.json(),
      isMobile,
    )

    if (!paywayResponse.ok) {
      return NextResponse.json(paymentData, { status: paywayResponse.status })
    }

    return NextResponse.json({
      ...(paymentData as Record<string, unknown>),
      request_time: requestTime,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to initialize payment.'

    return NextResponse.json({ message }, { status: 500 })
  }
}
