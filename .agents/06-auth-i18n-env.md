---
title: Authentication, Authorization, Localization, and Environment
description: Identity, access control, optional localization, and environment variables.
read_when:

* Adding authentication, authorization, roles, protected routes, or sessions
* Adding localization, translation resources, locale selection, or formatting
* Changing environment variables or request boundaries
---

# Authentication, Authorization, Localization, and Environment

## Authentication and authorization

* Keep identity-provider configuration in one server-side module.
* Protect routes at the earliest server boundary (`proxy.ts` or the server
  layout). Client-side guards improve UX; they are not authorization.
* The API, every Server Action, and every route handler enforce permissions
  themselves. Hidden navigation is not security.
* When the same permission rules drive navigation and route protection, define
  them once and derive both.
* Keep role names, route names, and provider claims in project configuration,
  not in these rules.
* Redirect after login only to relative paths or an explicit allowlist.
* Fail closed when an identity check cannot complete.
* Never log tokens, cookies, credentials, full sessions, or sensitive user
  data.

## Localization (optional)

If the project supports multiple languages:

* Define supported locales, default and fallback locale, detection, and
  persistence in one place.
* Initialize the translation client once, in one integration module.
* User-facing copy lives in translation resources, referenced by stable,
  intent-based keys.
* Do not translate identifiers, API enum values, route paths, or machine keys.
* Format dates, numbers, currency, and plurals through shared `Intl`-based
  formatters.
* Every locale provides all required keys or a deliberate fallback. Test long
  text, missing keys, interpolation, and right-to-left layout when relevant.
* Keep `<html lang>` and accessible labels in sync with the active locale.

## Environment

* Only `NEXT_PUBLIC_*` variables reach the browser. Never put secrets in them.
* List every variable with a safe placeholder in the example env file. Real
  values live in local or deployment secret storage.
* Validate required variables at startup or at their server boundary.
