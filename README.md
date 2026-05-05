# payway-merchant

[![skills.sh](https://skills.sh/b/Eavheang/payway-merchant)](https://skills.sh/Eavheang/payway-merchant)

A Next.js demo merchant that takes an amount, opens an ABA PayWay payment session, and tracks the result through QR scan or ABA mobile deep link until PayWay returns a final status.

The repo is a workspace: the Next.js app lives at the root and the reusable PayWay helpers live in [`packages/aba-payway-sdk`](packages/aba-payway-sdk).

## Stack

- Next.js 16 (App Router) and React 19
- TypeScript and Tailwind CSS v4
- [`@hezos/aba-payway-sdk`](packages/aba-payway-sdk) — local workspace package wrapping PayWay payment-link init, status, deep-link, and URL validation

## Getting started

```bash
bun install
bun run dev
```

Open <http://localhost:3000>, enter an amount, and follow the payment dialog. On a mobile user agent the app redirects to the ABA Mobile deep link; on desktop it shows the KHQR image so any KHQR-supported banking app can scan it.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `PAYWAY_LINK_URL` | No | PayWay hosted payment link, e.g. `https://link.payway.com.kh/ABAPAYWxxxxxxxx`. Falls back to a sandbox link if unset or invalid. |

The `/api/payway/init` route validates the configured link before each session and falls back to the default sandbox link if it cannot reach the configured one.

## Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start the dev server. |
| `bun run build` | Production build. |
| `bun run start` | Run the production build. |
| `bun run lint` | ESLint via `eslint-config-next`. |

## Project layout

```
app/
  page.tsx                  Payment UI (amount form, QR dialog, status toast)
  api/payway/init/route.ts  Server-side PayWay init (signs and forwards)
  api/payway/status/route.ts Server-side status check
packages/aba-payway-sdk/    Reusable PayWay helpers (initPayment, checkPaymentStatus, …)
docs/payway-payment-integration-guide.md  Detailed integration guide
```

## How the payment flow works

1. The browser POSTs the amount to `/api/payway/init`.
2. The server fetches the PayWay hosted link, signs the request via the SDK, and returns the QR plus session token.
3. The browser opens a dialog with the QR (or follows the ABA mobile deep link) and polls `/api/payway/status` every few seconds, anchoring the QR TTL on PayWay's `expire_in_sec` and `rq-time`.
4. The dialog closes and a toast announces the outcome when PayWay returns `approved`, a failure action, or the QR window expires.

For the request signing, response shapes, and edge cases, see [`docs/payway-payment-integration-guide.md`](docs/payway-payment-integration-guide.md).
