"use client";

import type { FormEvent, RefObject } from "react";

type PaymentFormProps = {
  amount: string;
  error: string;
  isLoading: boolean;
  formattedAmount: string;
  amountInputRef: RefObject<HTMLInputElement | null>;
  onAmountChange: (amount: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export const PaymentForm = ({
  amount,
  error,
  isLoading,
  formattedAmount,
  amountInputRef,
  onAmountChange,
  onSubmit,
}: PaymentFormProps) => {
  return (
    <section
      aria-labelledby="payment-card-title"
      className="rounded-4xl border border-stone-950/10 bg-stone-950 p-3 shadow-2xl shadow-stone-950/20"
    >
      <div className="rounded-[1.65rem] border border-white/10 bg-[#fffaf0] p-6 shadow-inner shadow-white/40 sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-amber-700">
              Secure Checkout
            </p>
            <h2
              className="mt-3 text-3xl font-black tracking-[-0.04em] text-stone-950"
              id="payment-card-title"
            >
              PayWay Payment
            </h2>
          </div>
          <div className="rounded-2xl bg-emerald-900 px-3 py-2 text-right text-white">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-emerald-100">
              Total
            </p>
            <p className="font-mono text-lg font-black tabular-nums">
              {formattedAmount}
            </p>
          </div>
        </div>

        <form className="mt-8 space-y-5" id="payment-form" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label
              className="block text-sm font-bold text-stone-800"
              htmlFor="amount"
            >
              Amount
            </label>
            <div className="flex rounded-3xl border border-stone-950/15 bg-white shadow-sm focus-within:border-emerald-700 focus-within:ring-4 focus-within:ring-emerald-700/15">
              <span className="grid min-w-16 place-items-center rounded-l-3xl bg-stone-100 font-mono text-sm font-black text-stone-600">
                USD
              </span>
              <input
                aria-describedby="amount-help amount-error"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-r-3xl bg-white px-4 py-4 text-xl font-black text-stone-950 outline-none [appearance:textfield] placeholder:text-stone-400 focus-visible:outline-none"
                id="amount"
                inputMode="decimal"
                min="0"
                name="amount"
                onChange={(event) => onAmountChange(event.target.value)}
                placeholder="Example: 12.50…"
                ref={amountInputRef}
                required
                step="0.01"
                type="number"
                value={amount}
              />
            </div>
            {error ? (
              <p
                className="text-sm font-semibold text-red-700"
                id="amount-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <p className="text-sm leading-6 text-stone-600" id="amount-help">
              The QR opens in a dedicated dialog so the payment session is easy
              to follow.
            </p>
          </div>

          <button
            className="w-full rounded-3xl bg-stone-950 px-5 py-4 text-base font-black text-white shadow-lg shadow-stone-950/20 transition-colors duration-200 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/30 disabled:cursor-not-allowed disabled:bg-stone-400 motion-reduce:transition-none"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Preparing Payment…" : "Open Payment Dialog"}
          </button>
        </form>
      </div>
    </section>
  );
};
