---
title: 'Fix current TypeScript diagnostics'
type: 'bugfix'
created: '2026-10-01'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current TypeScript diagnostics prevent the server project from type-checking. They affect Prisma expense data-access types, authenticated request typing in expense routes, and Express router introspection in product route tests.

**Approach:** Refresh the generated Prisma client and apply minimal type-safe corrections so the existing expense and product behavior remains unchanged while the full project typecheck and tests pass.

**Boundaries & Constraints**

**Always:** Preserve the Prisma schema, route behavior, tenant scoping, soft deletion, and existing test semantics. Keep fixes limited to generated-client refresh and TypeScript type declarations/helpers.

**Never:** Change database models or migrations, alter API responses, weaken runtime validation, or use broad compiler suppression.

</frozen-after-approval>

## Implementation Notes

- Prisma generation initially hit `EPERM` because active Node/esbuild development processes were locking the Windows query-engine binary; stop those processes before retrying generation.
- Diagnostics to resolve: missing generated `Expense` Prisma types/client delegate, missing `Request.userId` augmentation in expense routes, and Express route helper narrowing errors in `server/modules/products/routes.test.ts`.
- Regenerated Prisma Client after stopping the locking development processes.
- Added explicit `server/**/*.d.ts` inclusion to `tsconfig.server.json` and narrowed Express route internals in `server/modules/products/routes.test.ts` without changing runtime behavior.
- Verification passed: editor diagnostics are clean for all affected files; `npm run typecheck`, `npm test` (53 passed, 1 skipped), and `git diff --check` passed.

## Review Triage Log

- `defer` — The server compiler excludes `server/**/*.test.ts`; this predates the fix and would require a separate test-typecheck configuration rather than changing production compilation scope.
- `defer` — The route test uses boundary casts because Express does not expose its internal router-layer members; replacing the helper with fully typed Express internals is unrelated to the reported diagnostics.
- `false` — The spec was finalized with status `done`, implementation notes, affected-file evidence, and verification results.
- `defer` — Automating Prisma generation during every build is a separate clean-install/tooling concern; the current generated client was refreshed and the requested diagnostics are resolved.
