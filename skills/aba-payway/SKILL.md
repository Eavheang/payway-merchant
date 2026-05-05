---
name: aba-payway
description: Integrate the @hezos/aba-payway-sdk on the backend (Next.js App Router, Hono, Elysia, or Express). Use when adding ABA PayWay payment, generating QR codes, creating init or check-status endpoints, validating payway_link_url with fallback, mapping PayWayHttpError to upstream status codes, or building ABA mobile-bank deep links from a qr_string.
---

# ABA PayWay SDK Integration Skill

Use this skill when asked:
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

Current project implementation:

| Layer | File | Responsibility |
| --- | --- | --- |
| Next.js frontend | `app/page.tsx` | Collects amount, opens the payment dialog, displays QR/status, and polls the local backend routes. |
| Init backend route | `app/api/payway/init/route.ts` | Validates amount and PayWay URL, calls `initPayment`, adds mobile deep link when applicable, and returns the PayWay payment payload. |
| Status backend route | `app/api/payway/status/route.ts` | Validates status fields, calls `checkPaymentStatus`, and maps SDK/upstream errors to JSON responses. |
| SDK package | `@hezos/aba-payway-sdk` / `packages/aba-payway-sdk` | Contains PayWay link validation, initialization, status checking, errors, and mobile deep-link helpers. |
| Image config | `next.config.ts` | Allows `next/image` to render QR images from `pwapp.ababank.com`. |

Backend/frontend shape:

1. The browser does not call PayWay directly.
2. The browser posts JSON to local Next.js route handlers under `/api/payway/*`.
3. The route handlers run server-side inside the App Router `app` directory.
4. Route handlers use the Web `Request` API, read JSON with `await request.json()`, and return JSON with `NextResponse.json(...)`.
5. PayWay-specific validation, network calls, hashes, token headers, and upstream error mapping stay in the backend route/SDK layer.
6. The client only stores UI/session fields returned by the backend: `client_id`, `request_time`, `token`, `download_qr`, `qr_string`, `expire_in_sec`, and optional `mobile_deep_link`.

Request flow used by this project:

```text
app/page.tsx
  POST /api/payway/init
    -> app/api/payway/init/route.ts
      -> validate amount
      -> choose body.payway_link_url, PAYWAY_LINK_URL env, or default URL
      -> validatePaywayLinkUrl(...)
      -> initPayment({ amount, paywayLinkUrl })
      -> optionally build mobile_deep_link from qr_string + request headers
      -> return PayWay payment JSON to frontend

app/page.tsx
  POST /api/payway/status every 3 seconds after init succeeds
    -> app/api/payway/status/route.ts
      -> validate client_id, device_id, request_time, token
      -> checkPaymentStatus(...)
      -> return PayWay status JSON to frontend
```

Frontend state contract in `app/page.tsx`:

```ts
type PaymentData = {
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

type PaymentStatusData = {
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
```

Frontend init call:

```ts
const response = await fetch('/api/payway/init', {
  body: JSON.stringify({ amount: amount.trim() }),
  headers: {
    'content-type': 'application/json',
  },
  method: 'POST',
})
```

Device ID:

The status endpoint requires a `device_id`, but the SDK does not export a generator — the client must produce one. PayWay only requires that the same `device_id` is reused for status polls within a single payment session; it does not need to be persistent across sessions.

```ts
const generateDeviceId = () => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => characters[byte % characters.length]).join(
    '',
  )
}
```

Generate it **after `/init` succeeds**, not at page load. Status polling depends on `client_id`, `request_time`, `token` (all from `/init`) plus `device_id`, so deferring generation keeps the gating clean:

```ts
const data = await response.json()
setDeviceId(generateDeviceId())
setPaymentData(data)
```

Frontend status call:

```ts
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
```

Next.js route-handler rules for this project:

- Keep API handlers in `app/api/.../route.ts`; do not add `pages/api` routes.
- Export HTTP method handlers such as `export const POST = async (request: Request) => { ... }`.
- Use `NextResponse.json(data, { status })` for JSON responses.
- Route handlers do not participate in React layouts or client-side navigation.
- `POST` route handlers are request-time backend code and are not cached by default.
- Do not place a `route.ts` at the same route segment level as a `page.tsx`.

Security/architecture rule:

- Keep PayWay signing, token forwarding, URL validation, and PayWay network calls server-side.
- Do not expose PayWay internals or secret/configurable URLs as client-side `NEXT_PUBLIC_*` variables unless they are intentionally public.
- Allow only normalized data needed by the UI to cross from backend to frontend.

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
6. Add a client-side `device_id` generator (the SDK does not provide one) and pass it to every `/status` call.
