---
title: Frontend Quality Baseline
description: Required UI states, accessibility, performance, and verification before delivery.
read_when:

* Adding a feature, form, table, async state, or interactive control
* Adding images, heavy libraries, or slow data
* Reviewing a change before commit or deployment
---

# Frontend Quality Baseline

## Required UI states

* Async screens define loading, error, empty, and success states. Repeated
  content uses its skeleton component (see `07-ui-design.md`); never a blank screen
  or a bare "Loading..." paragraph.
* Forms define labels, validation messages, pending and disabled behavior,
  submit-failure feedback, and success behavior.
* Keep entered values when a recoverable request fails.

## Accessibility

* Prefer semantic HTML and native controls.
* Every input has a label; icon-only buttons have an accessible name.
* Every interactive control works with the keyboard.
* Dialogs trap and restore focus and close on Escape. Destructive actions need
  clear confirmation.
* Never rely on color alone for status or errors.
* Respect `prefers-reduced-motion` for animation.
* Images have meaningful `alt` text, or `alt=""` when decorative.

## Performance

* Use `next/image` for content images, with explicit dimensions or a sized
  parent for `fill`.
* Load heavy client-only libraries (charts, editors, maps) with `next/dynamic`
  or dynamic `import()`.
* Keep `'use client'` boundaries low in the tree so less JavaScript ships.
* Wrap slow sections in `<Suspense>` so they stream instead of blocking the
  page.

## Verification

* Run the smallest relevant check after editing, then lint, typecheck, tests,
  and build through the repository's scripts.
* Run a production build after routing, environment, or build-config changes.
* Add one focused test for non-trivial parsing, permission, validation, or
  state-transition logic.
* Review the diff after auto-fix. Do not commit generated output, `.env` files,
  tokens, or unrelated formatting churn.
