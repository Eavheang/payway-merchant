'use client'

import type { FormEvent } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import type { PaymentFormValues } from '@/interfaces/IPayment'
import { isValidAmount } from '@/utils/payment'

type PaymentFormProps = {
  isLoading: boolean
  formattedAmount: string
  onAmountChange: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export const PaymentForm = ({
  isLoading,
  formattedAmount,
  onAmountChange,
  onSubmit,
}: PaymentFormProps) => {
  const {
    formState: { errors },
    register,
  } = useFormContext<PaymentFormValues>()
  const amount = useWatch<PaymentFormValues, 'amount'>({ name: 'amount' })
  const error = errors.amount?.message ?? errors.root?.serverError?.message
  const buttonLabel = isLoading
    ? 'Creating payment…'
    : isValidAmount(amount ?? '')
      ? `Pay ${formattedAmount}`
      : 'Pay'

  return (
    <form
      className="flex flex-col gap-5"
      id="payment-form"
      noValidate
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-ink" htmlFor="amount">
          Amount
          <span className="sr-only"> in US dollars</span>
        </label>
        <div className="flex min-w-0 rounded-md border border-line bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
          <span className="grid shrink-0 place-items-center px-3 text-sm font-semibold text-muted">
            USD
          </span>
          <input
            aria-describedby={error ? 'amount-error' : undefined}
            aria-invalid={Boolean(error)}
            autoComplete="off"
            className="min-w-0 flex-1 bg-surface py-3 pr-3 text-3xl font-semibold tabular-nums text-ink outline-none placeholder:font-medium placeholder:text-hint [appearance:textfield]"
            id="amount"
            inputMode="decimal"
            min="0"
            placeholder="12.50…"
            required
            step="0.01"
            type="number"
            {...register('amount', {
              onChange: onAmountChange,
              validate: (value) =>
                isValidAmount(value) || 'Enter an amount greater than 0.',
            })}
          />
        </div>
        {error ? (
          <p className="text-sm font-medium text-danger" id="amount-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <button className="button-primary w-full" disabled={isLoading} type="submit">
        {buttonLabel}
      </button>
    </form>
  )
}
