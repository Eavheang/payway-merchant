"use client";

import { useEffect } from "react";
import { qrSecondsRemaining } from "@/app/_helpers/payment-utils";

type UseQrTimerInput = {
  hasClientId: boolean;
  isQrSessionExpired: boolean;
  qrTtlExpireSecRef: React.MutableRefObject<number>;
  paymentReceivedAtMsRef: React.MutableRefObject<number>;
  firstRqTimeRef: React.MutableRefObject<number | null>;
  lastRqTimeRef: React.MutableRefObject<number | null>;
  lastStatusPollAtMsRef: React.MutableRefObject<number | null>;
  firstPollCompletedAtMsRef: React.MutableRefObject<number | null>;
  setSecondsUntilQrExpires: (sec: number) => void;
  setIsQrSessionExpired: (expired: boolean) => void;
  setIsPaymentDialogOpen: (open: boolean) => void;
  showToastAction: (toast: {
    message: string;
    title: string;
    tone: "error" | "success";
  }) => void;
};

export const useQrTimer = ({
  hasClientId,
  isQrSessionExpired,
  qrTtlExpireSecRef,
  paymentReceivedAtMsRef,
  firstRqTimeRef,
  lastRqTimeRef,
  lastStatusPollAtMsRef,
  firstPollCompletedAtMsRef,
  setSecondsUntilQrExpires,
  setIsQrSessionExpired,
  setIsPaymentDialogOpen,
  showToastAction,
}: UseQrTimerInput) => {
  useEffect(() => {
    if (!hasClientId || isQrSessionExpired) {
      return;
    }

    const tick = () => {
      const next = qrSecondsRemaining({
        expireSecBackend: qrTtlExpireSecRef.current,
        paymentReceivedAtMs: paymentReceivedAtMsRef.current,
        firstRqTime: firstRqTimeRef.current,
        lastRqTime: lastRqTimeRef.current,
        lastPollAtMs: lastStatusPollAtMsRef.current,
        firstPollCompletedAtMs: firstPollCompletedAtMsRef.current,
      });

      setSecondsUntilQrExpires(next);

      if (next <= 0) {
        setIsQrSessionExpired(true);
        setIsPaymentDialogOpen(false);
        showToastAction({
          message:
            "The QR code expired before PayWay approved the payment. Enter the amount again to create a fresh QR.",
          title: "Payment Expired",
          tone: "error",
        });
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);

    return () => window.clearInterval(id);
  }, [
    hasClientId,
    isQrSessionExpired,
    qrTtlExpireSecRef,
    paymentReceivedAtMsRef,
    firstRqTimeRef,
    lastRqTimeRef,
    lastStatusPollAtMsRef,
    firstPollCompletedAtMsRef,
    setSecondsUntilQrExpires,
    setIsQrSessionExpired,
    setIsPaymentDialogOpen,
    showToastAction,
  ]);
};
