# ABA PayWay SDK Integration Skill

Use this guide when asked:
- "How do I integrate `@hezos/aba-payway-sdk`?"
- "Set up PayWay payment API routes for me."
- "Create init/check-status endpoints."

Goal:
- Generate two backend endpoints:
1. Initialize payment (`init`)
2. Check payment status (`status`)

Package:
- `@hezos/aba-payway-sdk`

Exports used:
- `initPayment`
- `checkPaymentStatus`
- `validatePaywayLinkUrl`
- `buildAbaMobileBankDeepLink`
- `isMobileDevice`
- `PayWayHttpError`

---

## 1) Install

```bash
npm install @hezos/aba-payway-sdk
# or
bun add @hezos/aba-payway-sdk
```

---

## 2) Required endpoint behavior

For `init` endpoint:
- Accept `amount`
- Accept optional `payway_link_url`
- Validate requested URL with `validatePaywayLinkUrl`
- If invalid: fallback to default URL
- If both requested URL and default URL invalid: return `400`
- Return warning when fallback is used
- Build mobile deep link when request is mobile and `qr_string` exists

For `status` endpoint:
- Accept `client_id`, `device_id`, `request_time`, `token`
- Call `checkPaymentStatus`
- Map `PayWayHttpError` to upstream status code

---

## 3) Next.js example (current project style)

Create file: `app/api/payway/init/route.ts`

```ts
import { NextResponse } from 'next/server'
import {
  buildAbaMobileBankDeepLink,
  initPayment,
  isMobileDevice,
  PayWayHttpError,
  validatePaywayLinkUrl,
} from '@hezos/aba-payway-sdk'

// Parse your URL here
const defaultPaywayLinkUrl = 'https://link.payway.com.kh/ABAPAYWn'

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
    let warning: string | undefined

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
      warning = 'Provided payway_link_url is invalid. Fallback default URL was used.'
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
      ...(warning ? { warning } : {}),
    })
  } catch (error) {
    if (error instanceof PayWayHttpError) {
      return NextResponse.json(error.data, { status: error.status })
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to initialize payment.' },
      { status: 500 },
    )
  }
}
```

Create file: `app/api/payway/status/route.ts`

```ts
import { NextResponse } from 'next/server'
import { checkPaymentStatus, PayWayHttpError } from '@hezos/aba-payway-sdk'

type StatusRequestBody = {
  client_id?: unknown
  device_id?: unknown
  request_time?: unknown
  token?: unknown
}

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as StatusRequestBody
    const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : ''
    const deviceId = typeof body.device_id === 'string' ? body.device_id.trim() : ''
    const requestTime =
      typeof body.request_time === 'string' ? body.request_time.trim() : ''
    const token = typeof body.token === 'string' ? body.token.trim() : ''

    if (!clientId || !deviceId || !requestTime || !token) {
      return NextResponse.json(
        { message: 'Missing PayWay status check data.' },
        { status: 400 },
      )
    }

    const statusData = await checkPaymentStatus({
      clientId,
      deviceId,
      requestTime,
      token,
    })

    return NextResponse.json(statusData)
  } catch (error) {
    if (error instanceof PayWayHttpError) {
      return NextResponse.json(error.data, { status: error.status })
    }

    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return NextResponse.json(
        { message: 'PayWay status check timed out. Please try again.' },
        { status: 504 },
      )
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to check payment status.' },
      { status: 500 },
    )
  }
}
```

---

## 4) Hono example

```ts
import { Hono } from 'hono'
import {
  checkPaymentStatus,
  initPayment,
  PayWayHttpError,
  validatePaywayLinkUrl,
} from '@hezos/aba-payway-sdk'

const app = new Hono()
const defaultPaywayLinkUrl = 'https://link.payway.com.kh/ABAPAYWn438575v'

app.post('/api/payway/init', async (c) => {
  try {
    const body = await c.req.json()
    const amount = String(body.amount ?? '').trim()
    const requested =
      typeof body.payway_link_url === 'string' && body.payway_link_url.trim()
        ? body.payway_link_url.trim()
        : defaultPaywayLinkUrl

    const amountValue = Number(amount)
    if (!amount || !Number.isFinite(amountValue) || amountValue <= 0) {
      return c.json({ message: 'Please enter an amount greater than 0.' }, 400)
    }

    const requestedValidation = await validatePaywayLinkUrl({ paywayLinkUrl: requested })
    let paywayLinkUrl = requested
    let warning: string | undefined

    if (!requestedValidation.valid) {
      const fallbackValidation = await validatePaywayLinkUrl({
        paywayLinkUrl: defaultPaywayLinkUrl,
      })
      if (!fallbackValidation.valid) {
        return c.json({ message: 'Requested and default PayWay URL are invalid.' }, 400)
      }
      paywayLinkUrl = defaultPaywayLinkUrl
      warning = 'Provided payway_link_url is invalid. Fallback default URL was used.'
    }

    const data = await initPayment({ amount, paywayLinkUrl })
    return c.json({ ...data, ...(warning ? { warning } : {}) })
  } catch (error) {
    if (error instanceof PayWayHttpError) return c.json(error.data, error.status as 400)
    return c.json({ message: error instanceof Error ? error.message : 'Unable to initialize payment.' }, 500)
  }
})

app.post('/api/payway/status', async (c) => {
  try {
    const body = await c.req.json()
    const clientId = String(body.client_id ?? '').trim()
    const deviceId = String(body.device_id ?? '').trim()
    const requestTime = String(body.request_time ?? '').trim()
    const token = String(body.token ?? '').trim()

    if (!clientId || !deviceId || !requestTime || !token) {
      return c.json({ message: 'Missing PayWay status check data.' }, 400)
    }

    const data = await checkPaymentStatus({ clientId, deviceId, requestTime, token })
    return c.json(data)
  } catch (error) {
    if (error instanceof PayWayHttpError) return c.json(error.data, error.status as 400)
    return c.json({ message: error instanceof Error ? error.message : 'Unable to check payment status.' }, 500)
  }
})
```

---

## 5) Elysia example

```ts
import { Elysia } from 'elysia'
import {
  checkPaymentStatus,
  initPayment,
  PayWayHttpError,
  validatePaywayLinkUrl,
} from '@hezos/aba-payway-sdk'

const app = new Elysia()
const defaultPaywayLinkUrl = 'https://link.payway.com.kh/ABAPAYWn438575v'

app.post('/api/payway/init', async ({ body, set }) => {
  try {
    const amount = String((body as any).amount ?? '').trim()
    const requested =
      typeof (body as any).payway_link_url === 'string' &&
      (body as any).payway_link_url.trim()
        ? (body as any).payway_link_url.trim()
        : defaultPaywayLinkUrl

    const amountValue = Number(amount)
    if (!amount || !Number.isFinite(amountValue) || amountValue <= 0) {
      set.status = 400
      return { message: 'Please enter an amount greater than 0.' }
    }

    const requestedValidation = await validatePaywayLinkUrl({ paywayLinkUrl: requested })
    let paywayLinkUrl = requested
    let warning: string | undefined

    if (!requestedValidation.valid) {
      const fallbackValidation = await validatePaywayLinkUrl({
        paywayLinkUrl: defaultPaywayLinkUrl,
      })
      if (!fallbackValidation.valid) {
        set.status = 400
        return { message: 'Requested and default PayWay URL are invalid.' }
      }
      paywayLinkUrl = defaultPaywayLinkUrl
      warning = 'Provided payway_link_url is invalid. Fallback default URL was used.'
    }

    const data = await initPayment({ amount, paywayLinkUrl })
    return { ...data, ...(warning ? { warning } : {}) }
  } catch (error) {
    if (error instanceof PayWayHttpError) {
      set.status = error.status as 400
      return error.data
    }
    set.status = 500
    return { message: error instanceof Error ? error.message : 'Unable to initialize payment.' }
  }
})

app.post('/api/payway/status', async ({ body, set }) => {
  try {
    const clientId = String((body as any).client_id ?? '').trim()
    const deviceId = String((body as any).device_id ?? '').trim()
    const requestTime = String((body as any).request_time ?? '').trim()
    const token = String((body as any).token ?? '').trim()

    if (!clientId || !deviceId || !requestTime || !token) {
      set.status = 400
      return { message: 'Missing PayWay status check data.' }
    }

    return await checkPaymentStatus({ clientId, deviceId, requestTime, token })
  } catch (error) {
    if (error instanceof PayWayHttpError) {
      set.status = error.status as 400
      return error.data
    }
    set.status = 500
    return { message: error instanceof Error ? error.message : 'Unable to check payment status.' }
  }
})
```

---

## 6) Express example

```ts
import express from 'express'
import {
  checkPaymentStatus,
  initPayment,
  PayWayHttpError,
  validatePaywayLinkUrl,
} from '@hezos/aba-payway-sdk'

const app = express()
app.use(express.json())
const defaultPaywayLinkUrl = 'https://link.payway.com.kh/ABAPAYWn438575v'

app.post('/api/payway/init', async (req, res) => {
  try {
    const amount = String(req.body?.amount ?? '').trim()
    const requested =
      typeof req.body?.payway_link_url === 'string' && req.body.payway_link_url.trim()
        ? req.body.payway_link_url.trim()
        : defaultPaywayLinkUrl

    const amountValue = Number(amount)
    if (!amount || !Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).json({ message: 'Please enter an amount greater than 0.' })
    }

    const requestedValidation = await validatePaywayLinkUrl({ paywayLinkUrl: requested })
    let paywayLinkUrl = requested
    let warning: string | undefined

    if (!requestedValidation.valid) {
      const fallbackValidation = await validatePaywayLinkUrl({
        paywayLinkUrl: defaultPaywayLinkUrl,
      })
      if (!fallbackValidation.valid) {
        return res.status(400).json({ message: 'Requested and default PayWay URL are invalid.' })
      }
      paywayLinkUrl = defaultPaywayLinkUrl
      warning = 'Provided payway_link_url is invalid. Fallback default URL was used.'
    }

    const data = await initPayment({ amount, paywayLinkUrl })
    return res.json({ ...data, ...(warning ? { warning } : {}) })
  } catch (error) {
    if (error instanceof PayWayHttpError) return res.status(error.status).json(error.data)
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Unable to initialize payment.',
    })
  }
})

app.post('/api/payway/status', async (req, res) => {
  try {
    const clientId = String(req.body?.client_id ?? '').trim()
    const deviceId = String(req.body?.device_id ?? '').trim()
    const requestTime = String(req.body?.request_time ?? '').trim()
    const token = String(req.body?.token ?? '').trim()

    if (!clientId || !deviceId || !requestTime || !token) {
      return res.status(400).json({ message: 'Missing PayWay status check data.' })
    }

    const data = await checkPaymentStatus({ clientId, deviceId, requestTime, token })
    return res.json(data)
  } catch (error) {
    if (error instanceof PayWayHttpError) return res.status(error.status).json(error.data)
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Unable to check payment status.',
    })
  }
})
```

---

## 7) Agent execution checklist

When user asks integration:
1. Install package.
2. Create two routes (`init` and `status`) for the target framework.
3. Include URL validation + fallback behavior.
4. Return consistent `400/500/504` responses.
5. Keep default URL configurable via env when possible (`PAYWAY_LINK_URL`).

