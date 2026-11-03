---
title: Stack and Project Conventions
description: The concrete tools and directory names every other rule file refers to.
read_when:

* Always: read before any other rule file
* Adding, replacing, or removing a library
---

# Stack and Project Conventions

The other rule files name these tools and directories directly. When a choice
changes, update this file and every rule that mentions the old choice.

## Tools

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19, React Compiler enabled |
| Language | TypeScript, `strict: true` |
| Styling | Tailwind CSS 4 |
| UI component library | HeroUI (`@heroui/react`) |
| Class composition | `clsx` |
| Theme switching | `next-themes` |
| HTTP client | Axios |
| Server state | TanStack Query 5 |
| Forms | React Hook Form |
| Schema validation | Zod (connect to React Hook Form with `@hookform/resolvers`) |
| Global client state | None. Use React context scoped to the feature that needs it |
| Authentication | NextAuth.js v4 |
| Localization | i18next, `react-i18next` |
| Dates | `date-fns` |
| Charts | Recharts |
| Icons | `react-icons` |
| Animation | Framer Motion |
| Lint and format | Oxlint, Oxfmt |
| Git hooks | Husky |
| Package manager | Bun, Node.js 24+ |
| Import alias | `@/*` maps to the project root |

Do not add a second library for a concern already listed here.

Bun, Oxlint, and Oxfmt are the defaults for new projects only. An existing
project keeps the tools it already uses:

* Package manager: follow the lockfile (`bun.lock`, `pnpm-lock.yaml`,
  `package-lock.json`, `yarn.lock`). Never add a second lockfile.
* Lint and format: follow the existing config (for example ESLint, Prettier,
  or Biome). Do not migrate to Oxlint or Oxfmt unless asked.

## Directories

| Concern | Location |
|---|---|
| Routes and layouts | `app/`, grouped by access: `(landing)`, `(public)`, `(public-protected)`, `(protected)` |
| Route-only UI | `app/<group>/<route>/_partials/` |
| Route protection | `proxy.ts`, with protected routes in `variables/routes.ts` |
| Auth API route | `app/api/auth/` |
| Shared UI | `components/<Name>/` |
| Shared form fields | `components/Form/` |
| Shared skeletons | `components/Skeleton/` |
| Reusable client hooks | `hooks/` |
| Domain services (API calls, query and mutation hooks) | `services/<domain>.ts` |
| Axios clients | `utils/axios.ts` (authenticated), `utils/publicAxios.ts` (public) |
| Pure helpers | `utils/` |
| Domain types | `interfaces/I<Domain>.ts` |
| Ambient and module types | `types/*.d.ts` |
| Constants | `constants/` |
| Route and language metadata | `variables/` |
| App, font, and theme configuration | `config/` |
| Localization setup and resources | `i18n/` |
| Global CSS | `styles/globals.css` |
