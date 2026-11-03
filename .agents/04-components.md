---
title: Component Organization
description: Shared vs route-local components, leaf/orchestrator split, hooks, and form components.
read_when:

* Creating, moving, or refactoring a component
* Changing shared component props
* Changing form component structure
avoid_when:

* Only changing visual design (see `07-ui-design.md`)
* Only changing API logic or TypeScript types
---

# Component Organization

Where files go is defined in `02-architecture.md`. Class composition is defined in
`07-ui-design.md`.

## Shared components

* Contain props, types, and render logic only. No route-local hooks, no data
  fetching, no route-specific translation keys.
* Keep props minimal. Prefer one `variant` prop over several booleans that can
  conflict.
* Page titles use the shared `Heading` component, not an inline `<h1>` + `<p>`.

Route-local components may use route hooks, data hooks, and translation hooks.

## Leaf and orchestrator

* Leaf components (for example `Card`) expose events through callbacks only.
  They do not touch stores, dialogs, or APIs.
* The nearest orchestrating parent (for example `Shell`) reads stores and
  context, opens dialogs, and calls actions.
* Do not drill callbacks through components that do not use them. The
  orchestrator reads context directly.
* Follow the Rules of Hooks: never call a hook inside a loop, condition, or
  `.map()` callback. If each list item needs its own hook, extract an item
  component and call the hook there.
* A context value is only stable if the provider keeps it stable. The React
  Compiler memoizes provider values; do not add manual `useMemo` or
  `useCallback` unless profiling shows a need.

## Forms

Forms use React Hook Form.

* `useForm` sets `defaultValues` for every field.
* Native inputs use `register`. Custom or third-party inputs use a shared field
  component built on `useController`. Do not repeat label, error, and
  accessibility wiring in every form.
* Nested form sections read the form with `useFormContext` under a
  `FormProvider` instead of receiving `control` through intermediate
  components.
* Field components render the label, error, required, disabled, and
  `aria-describedby` semantics. They never submit forms or call APIs.
* The route-level form owns the schema resolver, the submit mutation, and
  success and error feedback. Map server validation errors to fields with
  `setError`, and other server failures to `setError('root.serverError', ...)`.
* Disable submit while the mutation is pending.

## Hooks

* `hooks/` holds reusable browser behavior. A hook must not hide unrelated API
  calls, navigation, or global side effects.
* Pure parsing and formatting go in `utils/` so they run without React.
