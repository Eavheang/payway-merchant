type FetchImpl = typeof fetch;
export declare class PayWayHttpError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status: number, data: unknown);
}
export declare class PayWayLinkParseError extends Error {
    constructor(htmlSnippet: string);
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
export declare const isMobileDevice: (input: {
    secChUaMobile?: string | null;
    userAgent?: string | null;
}) => boolean;
export declare const buildAbaMobileBankDeepLink: (qr: string) => string;
export declare const validatePaywayLinkUrl: (input: ValidatePaywayLinkUrlInput) => Promise<ValidatePaywayLinkUrlResult>;
export declare const initPayment: (input: InitPaymentInput) => Promise<InitPaymentResult>;
export declare const checkPaymentStatus: (input: CheckStatusInput) => Promise<unknown>;
export {};
