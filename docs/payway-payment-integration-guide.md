# PayWay Payment Link Integration Implementation Guide

**Document name:** PayWay Payment Link Integration Implementation Guide  
**Version:** 1.0  
**Date:** 2026-05-02  
**Intended audience:** Software engineers implementing ABA PayWay payment link initialization and status checking in a web application

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Intended Audience](#2-intended-audience)
3. [Integration Overview](#3-integration-overview)
4. [Required PayWay Endpoints](#4-required-payway-endpoints)
5. [Step-by-Step Implementation](#5-step-by-step-implementation)
6. [Frontend Payment Flow](#6-frontend-payment-flow)
7. [Status Check Flow](#7-status-check-flow)
8. [Validation and Testing](#8-validation-and-testing)
9. [Troubleshooting](#9-troubleshooting)
10. [Assumptions and Dependencies](#10-assumptions-and-dependencies)
11. [Constraints and Limitations](#11-constraints-and-limitations)
12. [Open Questions / Client Decisions Required](#12-open-questions--client-decisions-required)
13. [Revision and Change Notes](#13-revision-and-change-notes)

## 1. Purpose and Scope

This document explains how to implement the ABA PayWay payment link flow used in this project.

The flow uses a PayWay hosted payment link that already contains PayWay's tokenized payment context. The application only provides a dynamic amount, initializes the PayWay payment, displays the QR code, and checks the payment status until PayWay returns an approved transaction.

This document covers:

1. Fetching the PayWay hosted payment link.
2. Extracting `aba_data` and `request_time`.
3. Creating the `additional_fields` payload with the user-entered amount.
4. Generating the PayWay initialization hash.
5. Calling PayWay's `list-payment-options` endpoint.
6. Displaying the returned QR code.
7. Generating a `device_id`.
8. Calling PayWay's `check-payment-status` endpoint.
9. Detecting successful payment using `data.action: "approved"`.

This document does not cover:

1. Creating or managing PayWay merchant accounts.
2. Creating PayWay payment links from the PayWay dashboard.
3. Card payment flows.
4. Refunds, reconciliation, settlement, or accounting workflows.
5. Production deployment infrastructure.

## 2. Intended Audience

This document is intended for:

| Audience | Required background |
| --- | --- |
| Frontend engineers | React, form handling, client-side polling |
| Backend engineers | HTTP APIs, request signing, server-side fetch |
| Full-stack engineers | Next.js App Router route handlers |
| QA engineers | Payment test execution and response validation |

## 3. Integration Overview

The PayWay link is used as the source of truth for the payment session.

Example PayWay payment link:

```text
https://link.payway.com.kh/ABAPAYWn438575v
```

The application does not directly edit the PayWay link URL. Instead, it performs this sequence:

1. User enters an amount in the web app.
2. Server fetches the PayWay hosted link HTML.
3. Server extracts:
   - `aba_data`
   - `request_time`
4. Server builds:

```json
{"amount":"2"}
```

5. Server sends that JSON string as `additional_fields`.
6. Server creates the initialization hash:

```text
sha512(request_time + aba_data + additional_fields)
```

7. Server posts to PayWay's initialization endpoint.
8. PayWay returns QR/payment data, including:
   - `token`
   - `client_id`
   - `qr_string`
   - `download_qr`
   - `expire_in_sec`
9. Browser displays the QR code.
10. Browser polls the local status API.
11. Server creates the status hash:

```text
sha512(client_id + device_id + request_time)
```

12. Server posts to PayWay's status endpoint using the `token` header.
13. When PayWay returns `data.action: "approved"`, the UI shows payment success.

## 4. Required PayWay Endpoints

| Purpose | Method | Endpoint |
| --- | --- | --- |
| Hosted payment link | `GET` | `https://link.payway.com.kh/ABAPAYWn438575v` |
| Initialize payment options | `POST` | `https://pwapp.ababank.com/api/pw-app/v1/payment/gateway/list-payment-options` |
| Check payment status | `POST` | `https://pwapp.ababank.com/api/pw-app/v1/payment-link/check-payment-status` |

## 5. Step-by-Step Implementation

### 5.1 Create the Initialization API Route

Create a Next.js route handler:

```text
app/api/payway/init/route.ts
```

This route receives the amount from the browser, fetches the PayWay link, extracts PayWay state, signs the initialization request, and returns PayWay's QR response.

```ts
import { createHash } from 'crypto'
import { NextResponse } from 'next/server'

const paywayLinkUrl = 'https://link.payway.com.kh/ABAPAYWn438575v'
const paywayApiUrl =
  'https://pwapp.ababank.com/api/pw-app/v1/payment/gateway/list-payment-options'

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
```

### 5.2 Initialization Request Payload

The local frontend calls:

```http
POST /api/payway/init
Content-Type: application/json
```

Example request body:

```json
{
  "amount": "2"
}
```

The server sends this payload to PayWay:

```json
{
  "additional_fields": "{\"amount\":\"2\"}",
  "request_time": "20260502030151",
  "aba_data": "PAYWAY_ABA_DATA_FROM_HOSTED_LINK",
  "hash": "SHA512_HASH"
}
```

The hash formula is:

```text
sha512(request_time + aba_data + additional_fields)
```

### 5.3 Expected Initialization Response

PayWay returns a response similar to:

```json
{
  "step": "abapay_khqr_request_qr",
  "token": "PAYWAY_TRANSACTION_TOKEN",
  "client_id": "2245513-438575-15883134",
  "expire_in_sec": "180",
  "qr_string": "000201010212...",
  "download_qr": "https://pwapp.ababank.com/api/pw-app/v1/payment/gateway/download-qr?...",
  "aba_data": "UPDATED_ABA_DATA"
}
```

The local route should also return `request_time` to the frontend because the status check requires it.

## 6. Frontend Payment Flow

### 6.1 Define Response Types

Use TypeScript types to track the fields needed for initialization and status checking.

```ts
type PaymentData = {
  client_id?: string
  download_qr?: string
  expire_in_sec?: string
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

### 6.2 Generate a Device ID

PayWay status checks require a `device_id`. The PayWay frontend generates a 10-character ID. The application can generate a stable random value per payment attempt.

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

### 6.3 Initialize Payment From the Form

When the user submits an amount, call the local initialization route.

```ts
const handleProceed = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()

  if (!hasValidAmount) {
    setError('Please enter an amount greater than 0 before continuing.')
    return
  }

  setError('')
  setIsLoading(true)
  setPaymentData(null)
  setStatusData(null)
  setStatusError('')

  try {
    const response = await fetch('/api/payway/init', {
      body: JSON.stringify({ amount: amount.trim() }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    })
    const data = (await response.json()) as PaymentData & { message?: string }

    if (!response.ok) {
      throw new Error(data.message ?? data.status?.message ?? 'Payment failed.')
    }

    setDeviceId(generateDeviceId())
    setPaymentData(data)
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : 'Unable to initialize PayWay payment.',
    )
  } finally {
    setIsLoading(false)
  }
}
```

### 6.4 Display the QR Code

If the app uses Next.js `next/image`, configure the PayWay remote host first.

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 'pwapp.ababank.com',
        pathname: '/api/pw-app/v1/payment/gateway/download-qr',
        protocol: 'https',
      },
    ],
  },
}

export default nextConfig
```

Then render the QR code:

```tsx
{paymentData.download_qr ? (
  <Image
    alt="PayWay payment QR code"
    className="mx-auto mt-4 h-70 w-56 rounded-xl bg-white p-3"
    height={280}
    src={paymentData.download_qr}
    width={224}
  />
) : null}
```

## 7. Status Check Flow

### 7.1 Create the Status API Route

Create:

```text
app/api/payway/status/route.ts
```

This route receives `client_id`, `device_id`, `request_time`, and `token` from the browser. It signs the status request and calls PayWay.

```ts
import { createHash } from 'crypto'
import { NextResponse } from 'next/server'

const paywayStatusUrl =
  'https://pwapp.ababank.com/api/pw-app/v1/payment-link/check-payment-status'

type StatusRequestBody = {
  client_id?: unknown
  device_id?: unknown
  request_time?: unknown
  token?: unknown
}

const parsePaywayResponse = async (response: Response) => {
  const responseText = await response.text()

  if (!responseText) {
    return { message: 'PayWay returned an empty status response.' }
  }

  try {
    return JSON.parse(responseText) as unknown
  } catch {
    return {
      message: 'PayWay returned a non-JSON status response.',
      response: responseText,
    }
  }
}

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as StatusRequestBody
    const clientId =
      typeof body.client_id === 'string' ? body.client_id.trim() : ''
    const deviceId =
      typeof body.device_id === 'string' ? body.device_id.trim() : ''
    const requestTime =
      typeof body.request_time === 'string' ? body.request_time.trim() : ''
    const token = typeof body.token === 'string' ? body.token.trim() : ''

    if (!clientId || !deviceId || !requestTime || !token) {
      return NextResponse.json(
        { message: 'Missing PayWay status check data.' },
        { status: 400 },
      )
    }

    const hash = createHash('sha512')
      .update(clientId + deviceId + requestTime)
      .digest('hex')

    const paywayResponse = await fetch(paywayStatusUrl, {
      body: JSON.stringify({
        device_id: deviceId,
        request_time: requestTime,
        client_id: clientId,
        hash,
      }),
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        language: 'en',
        token,
      },
      method: 'POST',
      signal: AbortSignal.timeout(8000),
    })

    const statusData = await parsePaywayResponse(paywayResponse)

    if (!paywayResponse.ok) {
      return NextResponse.json(statusData, { status: paywayResponse.status })
    }

    return NextResponse.json(statusData)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return NextResponse.json(
        { message: 'PayWay status check timed out. Please try again.' },
        { status: 504 },
      )
    }

    const message =
      error instanceof Error ? error.message : 'Unable to check payment status.'

    return NextResponse.json({ message }, { status: 500 })
  }
}
```

### 7.2 Status Request Payload

The frontend calls:

```http
POST /api/payway/status
Content-Type: application/json
```

Example local request body:

```json
{
  "client_id": "2245513-438575-15881868",
  "device_id": "KWVWzVh2Eg",
  "request_time": "20260502030151",
  "token": "PAYWAY_TRANSACTION_TOKEN"
}
```

The server sends this payload to PayWay:

```json
{
  "device_id": "KWVWzVh2Eg",
  "request_time": "20260502030151",
  "client_id": "2245513-438575-15881868",
  "hash": "SHA512_HASH"
}
```

The status hash formula is:

```text
sha512(client_id + device_id + request_time)
```

The PayWay request must include the token header:

```http
token: PAYWAY_TRANSACTION_TOKEN
```

### 7.3 Pending Status Response

Before payment approval, PayWay can return:

```json
{
  "status": {
    "code": "00",
    "message": "Success!",
    "tran_id": "1777691150481579"
  },
  "data": {
    "rq-time": 1777691150,
    "action": "request_qr",
    "message": {
      "code": "00",
      "message": "Success!",
      "tran_id": "177769112249860"
    },
    "cache": 1
  }
}
```

The frontend should continue polling while:

```text
data.action !== "approved"
```

### 7.4 Approved Status Response

After successful payment, PayWay returns:

```json
{
  "status": {
    "code": "00",
    "message": "Success!",
    "tran_id": "1777692874160774"
  },
  "data": {
    "rq-time": 1777692874,
    "action": "approved",
    "message": {
      "code": "00",
      "message": "Success!",
      "tran_id": "15883427"
    },
    "cache": 1,
    "download_receipt": "https://pwapp.ababank.com/api/payment-gateway/v1/payments/download-receipt?file=..."
  }
}
```

The frontend should treat this as payment success:

```ts
const statusAction = statusData?.data?.action ?? statusData?.action
const isPaymentApproved = statusAction === 'approved'
```

### 7.5 Poll Without Overlapping Requests

Avoid starting a new status request while the previous request is still in flight. This prevents late timeout errors from overwriting an already successful payment state.

```ts
const statusRequestInFlight = useRef(false)

const checkPaymentStatus = useCallback(async () => {
  if (!paymentData || !canCheckStatus || statusRequestInFlight.current) {
    return
  }

  statusRequestInFlight.current = true
  setIsCheckingStatus(true)

  try {
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
    const data = (await response.json()) as PaymentStatusData

    if (!response.ok) {
      throw new Error(data.message ?? data.status?.message ?? 'Status failed.')
    }

    setStatusData(data)
    setStatusError('')
  } catch (error) {
    if (!isPaymentApproved) {
      setStatusError(
        error instanceof Error
          ? error.message
          : 'Unable to check payment status.',
      )
    }
  } finally {
    statusRequestInFlight.current = false
    setIsCheckingStatus(false)
  }
}, [canCheckStatus, deviceId, isPaymentApproved, paymentData])
```

Start polling after initialization succeeds:

```ts
useEffect(() => {
  if (!canCheckStatus || isPaymentApproved) {
    return
  }

  const firstStatusCheck = window.setTimeout(() => {
    void checkPaymentStatus()
  }, 0)
  const statusInterval = window.setInterval(() => {
    void checkPaymentStatus()
  }, 3000)

  return () => {
    window.clearTimeout(firstStatusCheck)
    window.clearInterval(statusInterval)
  }
}, [canCheckStatus, checkPaymentStatus, isPaymentApproved])
```

### 7.6 Display Success and Receipt

Show a success state once PayWay returns `approved`.

```tsx
<h2 className="text-lg font-semibold">
  {isPaymentApproved ? 'Payment successful' : 'Payment initialized'}
</h2>

<p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
  {isPaymentApproved
    ? 'Your PayWay transaction has been approved.'
    : 'Scan the QR code with ABA Mobile or another KHQR-supported banking app.'}
</p>

{statusData.data?.download_receipt ? (
  <a
    className="mt-3 inline-block font-semibold text-blue-600 hover:text-blue-700"
    href={statusData.data.download_receipt}
    rel="noreferrer"
    target="_blank"
  >
    Download receipt
  </a>
) : null}
```

## 8. Validation and Testing

### 8.1 Local Validation Commands

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

### 8.2 Manual Test Steps

1. Start the app locally.
2. Enter a valid amount, for example `2`.
3. Submit the payment form.
4. Confirm that the QR code is displayed.
5. Scan the QR code with ABA Mobile or another supported banking app.
6. Complete payment.
7. Confirm that the UI changes to `Payment successful`.
8. Confirm that the status response contains:

```json
{
  "data": {
    "action": "approved"
  }
}
```

9. Confirm that the receipt link appears if PayWay returns `download_receipt`.

### 8.3 Status Endpoint Test Scenario

If status checking works, the local terminal should show:

```text
POST /api/payway/status 200
```

If PayWay is slow, the route can return:

```text
POST /api/payway/status 504
```

This should be treated as a retryable status check error unless the payment is already approved.

## 9. Troubleshooting

| Issue | Likely cause | Resolution |
| --- | --- | --- |
| `Unable to read PayWay payment link data.` | PayWay hosted page changed the embedded state format | Re-check the PayWay HTML and update the extraction logic |
| Initialization returns PayWay error | Invalid amount, stale link, or invalid hash input | Confirm `additional_fields` is exactly JSON stringified and hash formula is correct |
| Status returns 400 locally | Missing `client_id`, `device_id`, `request_time`, or `token` | Confirm these fields are returned from init and passed to status route |
| Status returns 500 or 504 | PayWay status endpoint timed out or returned unexpected response | Retry status check and prevent overlapping polling requests |
| Success payment not shown | UI is checking wrong field | Use `statusData.data.action === "approved"` |
| QR image fails in Next.js | Remote image host not configured | Add `pwapp.ababank.com` to `next.config.ts` image remote patterns |

## 10. Assumptions and Dependencies

### 10.1 Technical Assumptions

1. The PayWay payment link remains valid.
2. The PayWay hosted page continues embedding `aba_data` and `request_time`.
3. `additional_fields` must be a JSON string, not a nested object.
4. The amount can be submitted as a string.
5. The initialization hash uses SHA-512 with this exact concatenation:

```text
request_time + aba_data + additional_fields
```

6. The status hash uses SHA-512 with this exact concatenation:

```text
client_id + device_id + request_time
```

7. The status endpoint requires the PayWay transaction `token` header.

### 10.2 Operational Dependencies

| Dependency | Purpose |
| --- | --- |
| PayWay hosted link | Provides payment context |
| PayWay initialization endpoint | Creates QR/payment session |
| PayWay status endpoint | Confirms payment approval |
| Browser Web Crypto API | Generates random `device_id` |
| Next.js route handlers | Protect server-side PayWay calls and hash logic |

## 11. Constraints and Limitations

1. This implementation depends on the current PayWay hosted link HTML structure.
2. If PayWay changes field names or removes embedded `aba_data`, the extractor must be updated.
3. The implementation does not create a new PayWay payment link. It reuses an existing PayWay link.
4. The implementation does not persist transactions in a database.
5. The implementation does not verify payment status through a webhook.
6. Polling can miss final status if the browser tab is closed before approval.
7. The current code is suitable as an integration reference. For production, add transaction persistence, audit logs, retry policy, and server-side reconciliation.

## 12. Open Questions / Client Decisions Required

| Item | Client Decision Required |
| --- | --- |
| Payment link ownership | Confirm whether one static PayWay link should be reused or generated per merchant/order |
| Transaction storage | Decide whether to store `client_id`, amount, status, receipt URL, and timestamps in a database |
| Receipt handling | Decide whether receipt links should be displayed only, downloaded, or stored |
| Timeout policy | Decide how long the UI should poll before showing an expired or retry state |
| Production verification | Decide whether webhook or server-side reconciliation is required in addition to polling |
| Error messaging | Decide final user-facing messages for failed, expired, cancelled, and timed-out payments |

## 13. Revision and Change Notes

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-05-02 | Initial implementation guide for PayWay payment link initialization, QR display, polling status check, and approved payment handling |
