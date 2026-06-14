import { createHash } from "node:crypto";

const defaultPaywayApiUrl =
  "https://pwapp.ababank.com/api/pw-app/v1/payment/gateway/list-payment-options";
const defaultPaywayStatusUrl =
  "https://pwapp.ababank.com/api/pw-app/v1/payment-link/check-payment-status";

type FetchImpl = typeof fetch;

export class PayWayHttpError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "PayWayHttpError";
    this.status = status;
    this.data = data;
  }
}

export class PayWayLinkParseError extends Error {
  constructor(htmlSnippet: string) {
    super(
      `PayWay link page format unexpected. Expected to find 'aba_data' and 'request_time' embedded in page. Got: ${htmlSnippet.slice(0, 200)}`,
    );
    this.name = "PayWayLinkParseError";
  }
}

export type InitPaymentInput = {
  amount: string;
  paywayLinkUrl: string;
  apiBaseUrl?: string;
  fetchImpl?: FetchImpl;
};

export type InitPaymentResult = Record<string, unknown> & {
  request_time: string;
};

export type CheckStatusInput = {
  clientId: string;
  deviceId: string;
  requestTime: string;
  token: string;
  apiBaseUrl?: string;
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
};

export type ValidatePaywayLinkUrlInput = {
  paywayLinkUrl: string;
  fetchImpl?: FetchImpl;
};

export type ValidatePaywayLinkUrlResult = {
  valid: boolean;
  status?: number;
  error?: string;
};

export const isMobileDevice = (input: {
  secChUaMobile?: string | null;
  userAgent?: string | null;
}) => {
  const mobileUserAgent =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const secChUaMobile = input.secChUaMobile?.trim();

  if (secChUaMobile === "?1") return true;

  return mobileUserAgent.test(input.userAgent ?? "");
};

export const buildAbaMobileBankDeepLink = (qr: string) =>
  `abamobilebank://ababank.com?type=payway&qrcode=${encodeURIComponent(qr)}`;

const extractPaywayState = (html: string) => {
  const abaDataMatch = html.match(/p\.aba_data="([^"]+)"/);
  const requestTimeMatch = html.match(/request_time:"(\d+)"/);

  if (!abaDataMatch?.[1] || !requestTimeMatch?.[1]) {
    throw new PayWayLinkParseError(html);
  }

  return {
    abaData: JSON.parse(`"${abaDataMatch[1]}"`) as string,
    requestTime: requestTimeMatch[1],
  };
};

const parseResponse = async (response: Response) => {
  const responseText = await response.text();

  if (!responseText) {
    return { message: "PayWay returned an empty response." };
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return {
      message: "PayWay returned a non-JSON response.",
      response: responseText,
    };
  }
};

export const validatePaywayLinkUrl = async (
  input: ValidatePaywayLinkUrlInput,
): Promise<ValidatePaywayLinkUrlResult> => {
  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(input.paywayLinkUrl, { cache: "no-store" });
    return {
      valid: response.status === 200,
      status: response.status,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unable to reach URL.",
    };
  }
};

export const initPayment = async (
  input: InitPaymentInput,
): Promise<InitPaymentResult> => {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.apiBaseUrl ?? defaultPaywayApiUrl;

  const linkResponse = await fetchImpl(input.paywayLinkUrl, { cache: "no-store" });

  if (!linkResponse.ok) {
    throw new Error("Unable to load PayWay payment link.");
  }

  const { abaData, requestTime } = extractPaywayState(await linkResponse.text());
  const additionalFields = JSON.stringify({ amount: input.amount });
  const hash = createHash("sha512")
    .update(requestTime + abaData + additionalFields)
    .digest("hex");

  const paywayResponse = await fetchImpl(baseUrl, {
    body: JSON.stringify({
      additional_fields: additionalFields,
      request_time: requestTime,
      aba_data: abaData,
      hash,
    }),
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      language: "en",
    },
    method: "POST",
  });

  const paymentData = await parseResponse(paywayResponse);

  if (!paywayResponse.ok) {
    throw new PayWayHttpError(
      "PayWay payment initialization failed.",
      paywayResponse.status,
      paymentData,
    );
  }

  return {
    ...(paymentData as Record<string, unknown>),
    request_time: requestTime,
  };
};

export const checkPaymentStatus = async (input: CheckStatusInput) => {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.apiBaseUrl ?? defaultPaywayStatusUrl;
  const hash = createHash("sha512")
    .update(input.clientId + input.deviceId + input.requestTime)
    .digest("hex");

  const paywayResponse = await fetchImpl(baseUrl, {
    body: JSON.stringify({
      device_id: input.deviceId,
      request_time: input.requestTime,
      client_id: input.clientId,
      hash,
    }),
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      language: "en",
      token: input.token,
    },
    method: "POST",
    signal: AbortSignal.timeout(input.timeoutMs ?? 8000),
  });

  const statusData = await parseResponse(paywayResponse);

  if (!paywayResponse.ok) {
    throw new PayWayHttpError(
      "PayWay status check failed.",
      paywayResponse.status,
      statusData,
    );
  }

  return statusData;
};
