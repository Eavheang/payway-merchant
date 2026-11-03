# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Commands

| Task | Command |
| --- | --- |
| Install | `bun install` |
| Dev server | `bun run dev` |
| Production build (builds SDK first) | `bun run build` |
| Build SDK only | `bun run build:sdk` |
| Lint | `bun run lint` |
| Typecheck | `bun run typecheck` |

No test suite exists. Verify changes with `lint` + `typecheck`, then drive the flow in the dev server.

## Workspace layout

npm workspace (`"workspaces": ["packages/*"]`). Two members:

- **Root** — Next.js 16.4 App Router app (React 19.3, Tailwind v4, TypeScript 5, TanStack Query 5, React Hook Form 7).
- **`packages/aba-payway-sdk`** — ESM-only package (`@hezos/aba-payway-sdk`). Single source file `src/index.ts`. Built with `tsc -p tsconfig.build.json` to `dist/`. `dist/` is committed — rebuild it (`bun run build:sdk`) whenever `src/index.ts` changes.

Other top-level dirs:

- `lib/` — server-only in-memory stores: `rate-limit.ts` (per-IP fixed window) and `transactions.ts` (idempotency-key → transaction record, TTL-cleaned). Both are process-local `Map`s; they reset on restart and do not share state across instances.
- `docs/payway-payment-integration-guide.md` — signing, response shapes, edge cases. Read before changing PayWay request/response handling.
- `skills/aba-payway/SKILL.md` — published (skills.sh) skill describing SDK usage. Keep in sync with SDK exports.

## Path aliases (tsconfig)

- `@/*` → `./*` (root)
- `@hezos/aba-payway-sdk` → `./packages/aba-payway-sdk/src/index.ts` (source-direct, no build needed for dev)

## Payment flow (spans client, routes, SDK)

1. `app/page.tsx` is a Server Component (static shell + hero). It renders `app/_partials/paymentCheckout.tsx` (`'use client'`, owns UI state), which owns the React Hook Form amount form and calls `createPayment` (`services/payment.ts`) through `useMutation` to POST to `/api/payway/init`.
2. `app/api/payway/init/route.ts`: rate-limits by IP, dedupes via `lib/transactions`, validates `PAYWAY_LINK_URL` with `validatePaywayLinkUrl` (falls back to hardcoded sandbox link), calls SDK `initPayment`, returns QR + token.
3. Client shows dialog (`app/_partials/paymentDialog.tsx`); on mobile UA it follows `buildAbaMobileBankDeepLink` instead of showing the QR.
4. `hooks/usePaymentPolling.ts` polls `/api/payway/status` with `useQuery(paymentStatusQueryOptions(...))` + `refetchInterval` (route calls SDK `checkPaymentStatus`). Polling runs only while the dialog is open and the QR is not expired. `hooks/useQrTimer.ts` anchors QR expiry on PayWay's `expire_in_sec` + `rq-time`.
5. Terminal state (approved / failure / expired) closes dialog and shows toast.

Directory layout (from `.agents/01-stack.md`):

- `app/_partials/` — route-only UI, camelCase files.
- `components/<Name>/<Name>.tsx` — shared UI (`QueryProvider`, wired in `app/layout.tsx`).
- `hooks/` — client hooks (`useX.ts`).
- `services/payment.ts` — fetchers, `useMutation` fns, and `queryOptions` factories. Components never call `fetch` directly.
- `utils/payment.ts` — pure helpers and `DEFAULT_QR_TTL_SEC`.
- `interfaces/IPayment.ts` — domain types.

## Key conventions

- Tailwind v4: import via `@import "tailwindcss"` in CSS, PostCSS plugin is `@tailwindcss/postcss`. No `tailwind.config.*` file — use CSS-based `@theme` blocks.
- ESLint flat config (`eslint.config.mjs`) using `eslint-config-next` with `core-web-vitals` + `typescript` presets.
- All API routes are POST-only under `app/api/payway/`.
- SDK uses `node:crypto` (server-side only) — do not import it in client components. `lib/` is server-only too.
- SDK throws `PayWayHttpError` (carries upstream status) and `PayWayLinkParseError`; routes map these to HTTP responses.
- Env var `PAYWAY_LINK_URL` is optional; the init route falls back to a hardcoded sandbox link.

## `.agents/` rule files

`.agents/` holds topic rule files. Each has frontmatter with `read_when` / `avoid_when` — read the matching file before that kind of change:

| File | Read when |
| --- | --- |
| `01-stack.md` | Choosing a library or directory |
| `02-architecture.md` | Adding routes, route handlers, deciding server vs client or file placement |
| `03-code-standards.md` | Types, error handling, validation, imports |
| `04-components.md` | Splitting or creating components and hooks |
| `05-data-and-state.md` | Data fetching, state choice, trust boundaries |
| `06-auth-i18n-env.md` | Env vars, auth, localization |
| `07-ui-design.md` | Layout, spacing, Tailwind classes, dark mode |
| `08-ui-quality.md` | UI states, accessibility, pre-delivery checks |

These are a generic house template. Where they conflict with this repo, **the repo wins**:

- The stack table lists libraries not installed here (HeroUI, Axios, Zod, NextAuth, i18next, Framer Motion, etc.). Do not add them unless asked; `package.json` is the source of truth. `01-stack.md` itself says do not add a second library for an existing concern and keep the existing lint tool (ESLint, not Oxlint).
- Native `fetch` replaces Axios in `services/`. Route groups, `proxy.ts`, `variables/`, and `i18n/` are not used. Server-only stores stay in `lib/`.
- The principles (no `any`, `unknown` at boundaries, `import type`, server/client split, colocate until shared, UI quality baseline) still apply.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
