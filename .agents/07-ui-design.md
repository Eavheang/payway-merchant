---
title: Frontend Design Standard
description: Layout, spacing, Tailwind usage, class composition, cards, interactive states, global CSS, fonts, and dark mode.
read_when:

* Changing page layout, spacing, colors, radius, typography, or responsive behavior
* Changing cards or skeletons
* Changing global CSS, fonts, or Tailwind theme configuration
avoid_when:

* Only changing API logic, TypeScript types, or business logic
---

# Frontend Design Standard

Existing routes that break these rules are tech debt. Fix them when you touch
them.

## Layout and spacing

* Layouts own outer padding and max-width; pages do not (see
  `02-architecture.md`).
* Space siblings with `gap-*` on the parent, not `space-*` or margins on each
  child.
* Mobile-first. Use the smaller breakpoints for component sizing and the larger
  ones for page layout. Add a breakpoint only for a design requirement.

## Tailwind

* Use the standard scale (`px-4`, `rounded-lg`, `text-sm`). Use an arbitrary
  value such as `rounded-[9px]` only for a brand value with no scale
  equivalent. If it repeats, add it to the theme.
* Colors, fonts, text sizes, radii, and breakpoints live in the Tailwind theme.
  Components use semantic tokens (`primary`, `danger`, `success`), not raw
  palette colors.
* Compose classes with `clsx`. Pass static classes as plain strings. Never use
  `[...].join(' ')` or string concatenation.

## Cards and skeletons

* Define primary and secondary surface styles once, in the theme or a shared
  component. Use strong treatments (gradients, heavy shadows) for emphasis
  only.
* Pressable cards have both hover and `focus-visible` states. Hover alone
  fails keyboard and touch users.
* Repeated content (card grids, lists) gets a sibling skeleton component in the
  shared skeleton directory. The skeleton matches the real layout so nothing
  shifts when data arrives.

## Interactive states

Interactive elements define hover, `focus-visible`, disabled, pending, and
error states where they apply. Never remove the focus outline without a
visible replacement.

## Global CSS and fonts

* Import global CSS once, from the root layout.
* Global CSS holds only resets, element defaults, third-party overrides, and
  truly global utilities.
* Scope third-party overrides to the library's selector. Comment why any
  `!important` or raised `z-index` is needed.
* Load fonts with `next/font`, expose them as CSS variables, and keep fallback
  fonts defined.

## Dark mode

When dark mode is enabled, define light and dark tokens once in the theme and
cover text, borders, surfaces, focus rings, and status colors.

## New page checklist

- The page does not repeat layout chrome.
- `Heading` and other shared primitives are reused.
- Surfaces, colors, and spacing come from theme tokens.
- Loading, empty, error, and success states exist (see `08-ui-quality.md`).
- Interactive states are complete.
