import type { PaymentStatusData, QrTimerContext } from "@/app/_types/payment";

export const amountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export const failedPaymentActions = new Set([
  "cancelled",
  "canceled",
  "declined",
  "error",
  "expired",
  "failed",
  "rejected",
  "timeout",
]);

export const generateDeviceId = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => characters[byte % characters.length]).join(
    "",
  );
};

export const statusResponseErrorMessage = (data: PaymentStatusData): string => {
  if (typeof data.message === "string") return data.message;
  if (typeof data.status?.message === "string") return data.status.message;

  return "Status failed.";
};

export const paymentStatusAction = (
  data: PaymentStatusData | null,
): string | undefined => data?.data?.action ?? data?.action;

export const paymentStatusMessage = (
  data: PaymentStatusData | null,
): string | undefined =>
  data?.data?.message?.message ?? data?.status?.message ?? data?.message;

export const transactionId = (
  data: PaymentStatusData | null,
): string | undefined => data?.data?.message?.tran_id ?? data?.status?.tran_id;

export const paymentOutcome = (
  data: PaymentStatusData,
): "failed" | "success" | null => {
  const action = paymentStatusAction(data)?.trim().toLowerCase();

  if (action === "approved") return "success";
  if (action && failedPaymentActions.has(action)) return "failed";

  return null;
};

export const qrSecondsRemaining = (ctx: QrTimerContext): number => {
  const total = ctx.expireSecBackend;
  if (total <= 0) return 0;

  const localElapsedSinceInitSec = Math.max(
    0,
    (Date.now() - ctx.paymentReceivedAtMs) / 1000,
  );

  if (
    ctx.firstRqTime != null &&
    ctx.lastRqTime != null &&
    ctx.lastPollAtMs != null &&
    ctx.firstPollCompletedAtMs != null
  ) {
    const initToFirstPollSec = Math.max(
      0,
      (ctx.firstPollCompletedAtMs - ctx.paymentReceivedAtMs) / 1000,
    );
    const serverPollSpanSec = Math.max(0, ctx.lastRqTime - ctx.firstRqTime);
    const sinceLastPollSec = Math.max(
      0,
      (Date.now() - ctx.lastPollAtMs) / 1000,
    );

    const elapsedApprox = Math.max(
      localElapsedSinceInitSec,
      initToFirstPollSec + serverPollSpanSec + sinceLastPollSec,
    );

    return Math.max(0, Math.floor(total - elapsedApprox));
  }

  return Math.max(0, Math.floor(total - localElapsedSinceInitSec));
};

export const getPollIntervalMs = (remainingSec: number | null): number => {
  if (remainingSec === null) return 3000;
  if (remainingSec > 60) return 5000;
  if (remainingSec > 20) return 3000;
  return 2000;
};
