---
title: Application Architecture
description: App Router boundaries, where data is read and written, file placement, server/client rules, and naming.
read_when:

* Creating a route, layout, loading state, error state, Server Action, or route handler
* Deciding where a component, hook, type, utility, or service belongs
* Deciding whether code runs on the server or the client
---

# Application Architecture

Directory names are defined in `01-stack.md`.

## Placement

* Route-only code stays in the route's partial directory. Move it to the shared
  directory (`components/`, `hooks/`, `utils/`) when a second route needs it,
  not before.
* `utils/` holds pure, stateless functions: no network calls, no React.
* Services are named by domain (`invoices`), not by screen (`invoicePage`).
* Constants hold no secrets. Keep a constant next to its only consumer; move it
  to `constants/` once it is shared. No catch-all constants file.

## Routes and layouts

* `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, and `not-found.tsx`
  keep their reserved names.
* Pages are thin: they compose route partials and shared components. Layouts
  own the shell, navigation, max-width, and outer padding; pages never repeat
  them.
* Use route groups only when routes need a shared shell, loading boundary, or
  authorization boundary without changing the URL.
* Add `loading.tsx` and `error.tsx` where the route has a real loading or
  failure state.

## Server and client

* Components are Server Components by default. Add `'use client'` only to the
  smallest module that needs state, effects, event handlers, browser APIs, or a
  client-only library.
* Modules that read secrets or server request APIs start with
  `import 'server-only'`, so an accidental client import fails the build.
* Client components receive serializable props. They never import server-only
  modules.

## Reading and writing data

| Need | Use |
|---|---|
| Data only Server Components render | Fetch in a Server Component |
| Data a client component also reads | Prefetch in a Server Component, wrap in `HydrationBoundary`, read with `useQuery` (`05-data-and-state.md`) |
| Interactive client data (filters, polling, infinite lists, optimistic UI) | TanStack Query hooks from the data-access layer |
| Mutation triggered by this app's UI | A Server Action or `useMutation`; choose one per feature |
| Endpoint for external callers (webhooks, mobile apps, third parties) | Route handler |

* Do not fetch the same data in a Server Component and a `useQuery` hook
  without hydration. When you prefetch, do not also render the prefetched
  result in the Server Component; client refetches will not update it.
* Server Actions and route handlers are public HTTP endpoints. Authenticate,
  authorize, and validate input inside each one.

## Naming

* Shared component files use PascalCase; route partial files use camelCase.
* Hooks start with `use`.
* Use named exports, except where Next.js requires a default export.
