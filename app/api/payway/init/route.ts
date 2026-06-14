import { NextResponse } from 'next/server'
import {
  buildAbaMobileBankDeepLink,
  initPayment,
  isMobileDevice,
  PayWayHttpError,
  validatePaywayLinkUrl,
} from '@hezos/aba-payway-sdk'
import { rateLimit } from '@/lib/rate-limit'
import {
  createTransaction,
  findTransactionByKey,
} from '@/lib/transactions'

const defaultPaywayLinkUrl = 'https://link.payway.com.kh/ABAPAYWn438575v'

export const POST = async (request: Request) => {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = rateLimit(`init:${ip}`, 20, 60_000)

  if (!allowed) {
    return NextResponse.json(
      { message: 'Too many requests. Please wait a moment and try again.' },
      { status: 429 },
    )
  }

  try {
    const body = (await request.json()) as {
      amount?: unknown
      idempotency_key?: unknown
      payway_link_url?: unknown
    }
    const amount =
      typeof body.amount === 'string' ? body.amount.trim() : String(body.amount ?? '')
    const idempotencyKey =
      typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : ''
    const requestedPaywayLinkUrl =
      typeof body.payway_link_url === 'string' && body.payway_link_url.trim()
        ? body.payway_link_url.trim()
        : process.env.PAYWAY_LINK_URL?.trim() || defaultPaywayLinkUrl
    const amountValue = Number(amount)

    if (!amount || !Number.isFinite(amountValue) || amountValue <= 0) {
      return NextResponse.json(
        { message: 'Please enter an amount greater than 0.' },
        { status: 400 },
      )
    }

    if (amount.length > 20) {
      return NextResponse.json(
        { message: 'Amount is too large.' },
        { status: 400 },
      )
    }

    const decimalPlaces = amount.includes('.') ? amount.split('.')[1].length : 0
    if (decimalPlaces > 2) {
      return NextResponse.json(
        { message: 'Amount cannot have more than 2 decimal places.' },
        { status: 400 },
      )
    }

    if (idempotencyKey) {
      const existing = findTransactionByKey(idempotencyKey)
      if (existing) {
        return NextResponse.json({
          message: 'Duplicate request detected. Returning original result.',
          idempotency_key: idempotencyKey,
          replay: true,
        })
      }
    }

    const requestedValidation = await validatePaywayLinkUrl({
      paywayLinkUrl: requestedPaywayLinkUrl,
    })

    let paywayLinkUrl = requestedPaywayLinkUrl
    let paywayLinkWarning: string | undefined

    if (!requestedValidation.valid) {
      const fallbackValidation = await validatePaywayLinkUrl({
        paywayLinkUrl: defaultPaywayLinkUrl,
      })

      if (!fallbackValidation.valid) {
        return NextResponse.json(
          {
            message: 'Requested PayWay URL is invalid and default fallback URL is unavailable.',
            requested_payway_link_url: requestedPaywayLinkUrl,
            requested_status: requestedValidation.status,
            default_payway_link_url: defaultPaywayLinkUrl,
            default_status: fallbackValidation.status,
          },
          { status: 400 },
        )
      }

      paywayLinkUrl = defaultPaywayLinkUrl
      paywayLinkWarning = 'Provided payway_link_url is invalid. Fallback default URL was used.'
    }

    const paymentPayload = await initPayment({ amount, paywayLinkUrl })
    const qrString =
      typeof paymentPayload.qr_string === 'string' ? paymentPayload.qr_string : ''
    const mobileDeepLink =
      qrString &&
      isMobileDevice({
        secChUaMobile: request.headers.get('sec-ch-ua-mobile'),
        userAgent: request.headers.get('user-agent'),
      })
        ? buildAbaMobileBankDeepLink(qrString)
        : undefined

    if (idempotencyKey && typeof paymentPayload.client_id === 'string') {
      createTransaction({
        amount,
        clientId: paymentPayload.client_id,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000,
        idempotencyKey,
        status: 'init',
        token: typeof paymentPayload.token === 'string' ? paymentPayload.token : '',
      })
    }

    return NextResponse.json({
      ...paymentPayload,
      ...(mobileDeepLink ? { mobile_deep_link: mobileDeepLink } : {}),
      payway_link_url: paywayLinkUrl,
      ...(paywayLinkWarning ? { warning: paywayLinkWarning } : {}),
    })
  } catch (error) {
    if (error instanceof PayWayHttpError) {
      return NextResponse.json(error.data, { status: error.status })
    }

    const message =
      error instanceof Error ? error.message : 'Unable to initialize payment.'

    return NextResponse.json({ message }, { status: 500 })
  }
}
