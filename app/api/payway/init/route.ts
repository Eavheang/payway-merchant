import { createHash } from 'crypto'
import { NextResponse } from 'next/server'

const paywayLinkUrl = 'https://link.payway.com.kh/ABAPAYWn438575v'
const paywayApiUrl =
  'https://pwapp.ababank.com/api/pw-app/v1/payment/gateway/list-payment-options'

const mobileUserAgent =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i

const isMobileDeviceRequest = (request: Request) => {
  const secChUaMobile = request.headers.get('sec-ch-ua-mobile')?.trim()

  if (secChUaMobile === '?1') return true

  return mobileUserAgent.test(request.headers.get('user-agent') ?? '')
}

const abaMobileBankDeepLink = (qr: string) =>
  `abamobilebank://ababank.com?type=payway&qrcode=${encodeURIComponent(qr)}`

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

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as { amount?: unknown }
    const amount =
      typeof body.amount === 'string' ? body.amount.trim() : String(body.amount ?? '')
    const amountValue = Number(amount)

    if (!amount || !Number.isFinite(amountValue) || amountValue <= 0) {
      return NextResponse.json(
        { message: 'Please enter an amount greater than 0.' },
        { status: 400 },
      )
    }

    const linkResponse = await fetch(paywayLinkUrl, { cache: 'no-store' })

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
      },
      method: 'POST',
    })

    const paymentData = (await paywayResponse.json()) as unknown

    if (!paywayResponse.ok) {
      return NextResponse.json(paymentData, { status: paywayResponse.status })
    }

    const paymentPayload = paymentData as Record<string, unknown>
    const qrString =
      typeof paymentPayload.qr_string === 'string' ? paymentPayload.qr_string : ''
    const mobileDeepLink =
      qrString && isMobileDeviceRequest(request)
        ? abaMobileBankDeepLink(qrString)
        : undefined

    return NextResponse.json({
      ...paymentPayload,
      ...(mobileDeepLink ? { mobile_deep_link: mobileDeepLink } : {}),
      request_time: requestTime,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to initialize payment.'

    return NextResponse.json({ message }, { status: 500 })
  }
}
