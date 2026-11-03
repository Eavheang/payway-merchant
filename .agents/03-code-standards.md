---
title: Code Standards
description: TypeScript, types, errors, imports, lint, and simplicity rules.
read_when:

* Changing TypeScript types or interfaces
* Changing error handling or validation
* Changing imports or lint/typecheck behavior
avoid_when:

* Only changing layout, spacing, colors, cards, or responsive UI (see `07-ui-design.md`)
* Only changing component placement or route structure (see `02-architecture.md`)
---

# Code Standards

The formatter and linter (Oxfmt and Oxlint, or the project's existing tools;
see `01-stack.md`) own formatting, quote style, and import order. Do not
restate those as rules; run the tools.

## TypeScript

* No `any`. Use `unknown` at untrusted boundaries and narrow it before use.
* Use `import type` for type-only imports.
* Name types by domain (`Invoice`, `CreateInvoiceRequest`), not `Data`,
  `Item`, or `Response`.
* Keep API payload types separate from form state types when they differ (for
  example, the form holds strings and the API takes numbers or dates). When
  they match, use one type.
* A generic on an Axios call (`axios.get<Invoice>()`) is a type assertion, not
  validation. Validate the response with the schema library when a bad shape
  could break rendering or a security decision.

## Errors

* Never swallow errors. Re-throw, or return a typed failure the caller can
  render.
* Handle expected API failures in the UI (see `08-ui-quality.md`).
* Logs never contain tokens, credentials, cookies, or private payloads.

## Imports and lint

* Use the `@/*` alias instead of long relative paths.
* An inline lint disable needs a reason in the same comment.
* Run lint and typecheck through the repository's scripts when they exist.

## Simplicity

* Build the minimal version that works.
* One implementation does not need an interface. One product does not need a
  factory. One value does not need a constants file.
* Do not hardcode environment-dependent URLs or secrets (see `06-auth-i18n-env.md`).
