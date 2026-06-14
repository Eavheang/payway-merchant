import Image from "next/image";
import type { RefObject } from "react";
import type { PaymentData } from "@/app/_types/payment";
import { paymentStatusMessage } from "@/app/_helpers/payment-utils";
import { DEFAULT_QR_TTL_SEC } from "@/app/_constants/payment";

type PaymentDialogProps = {
  isLoading: boolean;
  paymentData: PaymentData | null;
  formattedAmount: string;
  secondsUntilQrExpires: number | null;
  paywayInitTtlSec: number | null;
  statusError: string;
  canCheckStatus: boolean;
  isCheckingStatus: boolean;
  isQrSessionExpired: boolean;
  statusData: {
    data?: { message?: { message?: string } };
    message?: string;
    status?: { message?: string };
  } | null;
  paymentDialogRef: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  onCheckStatus: () => void;
};

export const PaymentDialog = ({
  isLoading,
  paymentData,
  formattedAmount,
  secondsUntilQrExpires,
  paywayInitTtlSec,
  statusError,
  canCheckStatus,
  isCheckingStatus,
  isQrSessionExpired,
  statusData,
  paymentDialogRef,
  onClose,
  onCheckStatus,
}: PaymentDialogProps) => {
  const dialogTitle = isLoading
    ? "Preparing Secure Payment"
    : paymentData
      ? "Scan & Confirm Payment"
      : "Payment Session";

  const statusMessage = paymentStatusMessage(
    statusData as Parameters<typeof paymentStatusMessage>[0],
  );

  return (
    <dialog
      aria-labelledby="payment-dialog-title"
      className="fixed inset-0 m-auto h-fit max-h-[calc(100vh-2rem)] w-[min(calc(100vw-2rem),32rem)] rounded-[2rem] border border-white/20 bg-[#fffaf0] p-0 text-stone-950 shadow-2xl shadow-stone-950/35 backdrop:bg-stone-950/70 backdrop:backdrop-blur-sm open:motion-safe:animate-[fadeIn_160ms_ease-out]"
      onCancel={onClose}
      ref={paymentDialogRef}
    >
      <div className="max-h-[min(44rem,calc(100vh-2rem))] overflow-y-auto overscroll-contain p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-700">
              Live Session
            </p>
            <h2
              className="mt-2 text-balance text-2xl font-black tracking-[-0.04em]"
              id="payment-dialog-title"
            >
              {dialogTitle}
            </h2>
          </div>
          <button
            aria-label="Close Payment Dialog"
            className="rounded-full border border-stone-950/10 bg-white px-3 py-2 text-sm font-black text-stone-700 transition-colors duration-200 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 motion-reduce:transition-none"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-6 rounded-[1.6rem] border border-stone-950/10 bg-white p-4 shadow-inner">
          <div className="flex items-center justify-between gap-4 border-b border-dashed border-stone-300 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                Amount Due
              </p>
              <p className="font-mono text-3xl font-black tabular-nums text-stone-950">
                {formattedAmount}
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-800">
              ABA
            </span>
          </div>

          {isLoading ? (
            <div
              aria-live="polite"
              className="grid min-h-80 place-items-center text-center"
            >
              <div>
                <div
                  aria-hidden="true"
                  className="mx-auto h-14 w-14 rounded-full border-4 border-stone-200 border-t-emerald-700 motion-safe:animate-spin"
                />
                <p className="mt-5 font-bold text-stone-900">
                  Creating Your PayWay QR…
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  Keep this dialog open while the payment session starts.
                </p>
              </div>
            </div>
          ) : paymentData ? (
            <div className="pt-5 text-center">
              {paymentData.download_qr ? (
                <Image
                  alt="PayWay payment QR code"
                  className="mx-auto h-[280px] w-56 rounded-3xl border border-stone-950/10 bg-white p-3 shadow-lg"
                  height={280}
                  src={paymentData.download_qr}
                  width={224}
                />
              ) : (
                <div className="grid min-h-64 place-items-center rounded-3xl bg-stone-100 p-6 text-sm font-semibold text-stone-600">
                  Waiting for PayWay QR data.
                </div>
              )}

              <p className="mt-5 text-pretty text-sm leading-6 text-stone-700">
                Scan with ABA Mobile or another KHQR-supported banking app. This
                dialog closes automatically when PayWay returns a final result.
              </p>

              <div className="mt-5 grid gap-3 rounded-3xl bg-stone-100 p-4 text-left sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                    Status
                  </p>
                  <p className="mt-1 font-bold text-stone-950">
                    {statusMessage ?? "Waiting for confirmation"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                    Time Left
                  </p>
                  <p className="mt-1 font-mono font-black tabular-nums text-stone-950">
                    {secondsUntilQrExpires !== null
                      ? `${secondsUntilQrExpires}s`
                      : `${paywayInitTtlSec ?? DEFAULT_QR_TTL_SEC}s`}
                  </p>
                </div>
              </div>

              {statusError ? (
                <p
                  className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900"
                  role="status"
                >
                  {statusError}
                </p>
              ) : null}

              <button
                className="mt-5 w-full rounded-3xl border border-emerald-800 px-5 py-3 text-sm font-black text-emerald-900 transition-colors duration-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 disabled:cursor-not-allowed disabled:border-stone-300 disabled:text-stone-400 motion-reduce:transition-none"
                disabled={
                  !canCheckStatus || isCheckingStatus || isQrSessionExpired
                }
                onClick={() => void onCheckStatus()}
                type="button"
              >
                {isCheckingStatus ? "Checking Status…" : "Check Status Now"}
              </button>
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center text-center text-sm text-stone-600">
              Payment details will appear here after PayWay responds.
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
