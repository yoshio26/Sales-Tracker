---
title: 'Fix dashboard route test typing diagnostics'
type: 'bugfix'
created: '2026-10-01'
status: 'in-progress'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `server/modules/dashboard/routes.test.ts` has four TypeScript diagnostics because Express's internal `IRoute` type does not expose `methods` and the route property remains optional.

**Approach:** Add a small typed route helper that safely narrows the dashboard router layer, reads the HTTP method map through a local structural type, and returns a typed handler stack. Reuse it in both test paths without changing test behavior.

</frozen-after-approval>

## Implementation Notes

- Preserve all dashboard route assertions, request fixtures, middleware order, and runtime behavior.
- Do not use `@ts-ignore` or scatter independent casts across the test.
