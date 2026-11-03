"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RefObject } from "react";
import type { PaymentData, ToastState } from "@/interfaces/IPayment";
import {
  getPollIntervalMs,
  paymentOutcome,
  paymentStatusMessage,
  qrSecondsRemaining,
} from "@/utils/payment";
import { paymentStatusQueryOptions } from "@/services/payment";

type UsePaymentPollingInput = {
  paymentData: PaymentData | null;
  deviceId: string;
  isPaymentDialogOpen: boolean;
  isQrSessionExpired: boolean;
  canCheckStatus: boolean;
  secondsUntilQrExpires: number | null;
  qrTtlExpireSecRef: RefObject<number>;
  paymentReceivedAtMsRef: RefObject<number>;
  firstRqTimeRef: RefObject<number | null>;
  lastRqTimeRef: RefObject<number | null>;
  lastStatusPollAtMsRef: RefObject<number | null>;
  firstPollCompletedAtMsRef: RefObject<number | null>;
  showToastAction: (toast: Omit<NonNullable<ToastState>, "id">) => void;
  setIsPaymentDialogOpen: (open: boolean) => void;
  setIsQrSessionExpired: (expired: boolean) => void;
  setSecondsUntilQrExpires: (sec: number | null) => void;
};

export const usePaymentPolling = ({
  paymentData,
  deviceId,
  isPaymentDialogOpen,
  isQrSessionExpired,
  canCheckStatus,
  secondsUntilQrExpires,
  qrTtlExpireSecRef,
  paymentReceivedAtMsRef,
  firstRqTimeRef,
  lastRqTimeRef,
  lastStatusPollAtMsRef,
  firstPollCompletedAtMsRef,
  showToastAction,
  setIsPaymentDialogOpen,
  setIsQrSessionExpired,
  setSecondsUntilQrExpires,
}: UsePaymentPollingInput) => {
  // Terminal results close the dialog, which disables polling.
  const isPolling = canCheckStatus && isPaymentDialogOpen && !isQrSessionExpired;

  const { data, dataUpdatedAt, error, isFetching, refetch } = useQuery({
    ...paymentStatusQueryOptions(paymentData, deviceId),
    enabled: isPolling,
    refetchInterval: getPollIntervalMs(secondsUntilQrExpires),
  });

  useEffect(() => {
    if (!data) return;

    const rqTime = data.data?.["rq-time"];

    if (typeof rqTime === "number") {
      if (firstRqTimeRef.current === null) {
        firstRqTimeRef.current = rqTime;
        firstPollCompletedAtMsRef.current = Date.now();
      }

      lastRqTimeRef.current = rqTime;
      lastStatusPollAtMsRef.current = Date.now();

      const synced = qrSecondsRemaining({
        expireSecBackend: qrTtlExpireSecRef.current,
        paymentReceivedAtMs: paymentReceivedAtMsRef.current,
        firstRqTime: firstRqTimeRef.current,
        lastRqTime: lastRqTimeRef.current,
        lastPollAtMs: lastStatusPollAtMsRef.current,
        firstPollCompletedAtMs: firstPollCompletedAtMsRef.current,
      });

      setSecondsUntilQrExpires(synced);

      if (synced <= 0) {
        setIsQrSessionExpired(true);
        setIsPaymentDialogOpen(false);
        showToastAction({
          message:
            "The QR code expired before PayWay approved the payment. Enter the amount again to create a fresh QR.",
          title: "Payment expired",
          tone: "error",
        });
      }
    }

    const outcome = paymentOutcome(data);
    if (outcome === "success") {
      setIsPaymentDialogOpen(false);
      showToastAction({
        message:
          "PayWay approved the transaction. The payment session is complete.",
          title: "Payment successful",
        tone: "success",
      });
    } else if (outcome === "failed") {
      setIsPaymentDialogOpen(false);
      showToastAction({
        message:
          paymentStatusMessage(data) ??
          "PayWay did not approve this transaction. Try again with a new QR.",
          title: "Payment failed",
        tone: "error",
      });
    }
  }, [
    data,
    dataUpdatedAt,
    firstPollCompletedAtMsRef,
    firstRqTimeRef,
    lastRqTimeRef,
    lastStatusPollAtMsRef,
    paymentReceivedAtMsRef,
    qrTtlExpireSecRef,
    setIsPaymentDialogOpen,
    setIsQrSessionExpired,
    setSecondsUntilQrExpires,
    showToastAction,
  ]);

  const checkPaymentStatus = () => {
    if (isPolling) void refetch();
  };

  return {
    checkPaymentStatus,
    isCheckingStatus: isFetching,
    statusData: data ?? null,
    statusError: error?.message ?? "",
  };
};
