import { NextResponse } from 'next/server'
import { checkPaymentStatus, PayWayHttpError } from '@hezos/aba-payway-sdk'
import { rateLimit } from '@/lib/rate-limit'

type StatusRequestBody = {
  client_id?: unknown
  device_id?: unknown
  request_time?: unknown
  token?: unknown
}

export const POST = async (request: Request) => {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = rateLimit(`status:${ip}`, 60, 60_000)

  if (!allowed) {
    return NextResponse.json(
      { message: 'Too many requests. Please wait a moment and try again.' },
      { status: 429 },
    )
  }

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

    if (
      clientId.length > 2000 ||
      deviceId.length > 2000 ||
      requestTime.length > 2000 ||
      token.length > 2000
    ) {
      return NextResponse.json(
        { message: 'One or more fields exceed the maximum length.' },
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

    const message =
      error instanceof Error ? error.message : 'Unable to check payment status.'

    return NextResponse.json({ message }, { status: 500 })
  }
}
