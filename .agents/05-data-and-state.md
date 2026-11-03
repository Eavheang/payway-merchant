---
title: Data Access and State
description: Axios clients, query and mutation hooks, cache behavior, state choice, and trust boundaries.
read_when:

* Adding or changing an API call, query, mutation, upload, or download
* Handling request errors, auth refresh, caching, or invalidation
* Choosing between local state, global client state, and server state
* Rendering data that came from users or external systems
---

# Data Access and State

When to fetch on the server vs the client is defined in `02-architecture.md`.

## Layers

* The data-access layer owns domain API calls. Components never build requests
  or create Axios instances.
* Use separate Axios clients for authenticated and public requests when both
  exist. Token attachment and refresh live in the client's interceptors.
* Query and mutation hooks return typed domain data, never raw Axios response
  objects.

## Choosing state

| State | Where |
|---|---|
| Remote data | TanStack Query |
| Form input | React Hook Form (see `04-components.md`) |
| Ephemeral UI (dialog open, selected tab) | Local component state |
| Shareable view state (filters, sort, page, active tab) | URL search params |
| Cross-route client state with no server source | Global client store, only when the above do not fit |

Never copy query data into local state or a store. Read it from the query.

## Query client

* On the server, create a new `QueryClient` per request. Never share one
  across requests.
* In the browser, create one `QueryClient` for the app's lifetime inside the
  root provider.

## Queries

* Each domain service exports `queryOptions(...)` factories. Components and
  server prefetches use the same factory, so keys and fetchers never drift.
* Query keys are stable arrays, start with the domain name, and include every
  input that changes the response.
* Use `enabled` to wait until required identifiers exist.
* Pass the `signal` from the `queryFn` context to Axios so stale requests are
  cancelled.
* Set `staleTime` explicitly for expensive or user-specific data instead of
  relying on the default of zero.

## Mutations

* Type mutation variables and responses separately from form state when they
  differ (see `03-code-standards.md`).
* After success, call `invalidateQueries` with the smallest affected key.
* Use optimistic updates only with defined rollback in `onError`; otherwise
  invalidate and refetch.
* Disable duplicate submissions while `isPending` is true.
* Show user-safe messages for expected failures.

## Trust boundaries

* Validate user input at the form boundary with the schema library.
* Treat URL params, search params, file metadata, API responses, and decoded
  tokens as untrusted.
* Never render untrusted HTML with `dangerouslySetInnerHTML`. If it is
  unavoidable, sanitize it with a maintained sanitizer first.
* Uploads and downloads enforce size and type limits and revoke object URLs
  when done.
