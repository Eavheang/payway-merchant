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
