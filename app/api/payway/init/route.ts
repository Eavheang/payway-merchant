import { NextResponse } from 'next/server'
import {
  buildAbaMobileBankDeepLink,
  initPayment,
  isMobileDevice,
  PayWayHttpError,
  validatePaywayLinkUrl,
} from '@hezos/aba-payway-sdk'

const defaultPaywayLinkUrl = 'https://link.payway.com.kh/ABAPAYWn438575v'

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as {
      amount?: unknown
      payway_link_url?: unknown
    }
    const amount =
      typeof body.amount === 'string' ? body.amount.trim() : String(body.amount ?? '')
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
