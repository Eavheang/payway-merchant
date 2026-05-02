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
