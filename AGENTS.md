<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

| Task | Command |
| --- | --- |
| Install | `bun install` |
| Dev server | `bun run dev` |
| Production build | `bun run build` |
| Lint | `bun run lint` |
| Build SDK only | `bun run build --workspace packages/aba-payway-sdk` or `cd packages/aba-payway-sdk && npm run build` |

No test suite exists. There is no typecheck script — use `npx tsc --noEmit` to typecheck the root app.

## Workspace layout

npm workspace (`"workspaces": ["packages/*"]`). Two members:

- **Root** — Next.js 16 App Router app (React 19, Tailwind v4, TypeScript 5).
- **`packages/aba-payway-sdk`** — ESM-only package (`@hezos/aba-payway-sdk`). Single source file `src/index.ts`. Built with `tsc -p tsconfig.build.json` to `dist/`.

## Path aliases (tsconfig)

- `@/*` → `./*` (root)
- `@hezos/aba-payway-sdk` → `./packages/aba-payway-sdk/src/index.ts` (source-direct, no build needed for dev)

## Key conventions

- Tailwind v4: import via `@import "tailwindcss"` in CSS, PostCSS plugin is `@tailwindcss/postcss`. No `tailwind.config.*` file — use CSS-based `@theme` blocks.
- ESLint flat config (`eslint.config.mjs`) using `eslint-config-next` with `core-web-vitals` + `typescript` presets.
- All API routes are POST-only under `app/api/payway/`.
- `app/page.tsx` is a `'use client'` component containing all payment UI state.
- SDK uses `node:crypto` (server-side only) — do not import it in client components.
- Env var `PAYWAY_LINK_URL` is optional; the init route falls back to a hardcoded sandbox link.
