---
title: 'Fix expense route request typing diagnostics'
type: 'bugfix'
created: '2026-10-01'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The editor reports six identical TypeScript errors because `server/modules/expenses/routes.ts` does not resolve the ambient `Express.Request.userId` augmentation, even though the server compiler succeeds.

**Approach:** Explicitly anchor the existing Express declaration file from the expense routes module so the editor and compiler use the same authenticated-request type without changing route behavior.

</frozen-after-approval>

## Implementation Notes

- No database, API, runtime, or irreversible changes are required.
- Preserve `server/types/express.d.ts` and all existing authentication, tenant-scoping, validation, and route behavior.
- Added a file-local declaration reference in `server/modules/expenses/routes.ts`; this is intentionally scoped to the module where the editor reported diagnostics and avoids changing global request behavior or weakening compiler settings.
- Verification passed: the affected file reports no editor diagnostics, `npm run typecheck` passed, `npm test` passed with 53 tests and 1 skipped, and `git diff --check` passed.

## Review Triage Log

- `false` — The spec does not require a separate acceptance-criteria section for this oneshot route; the frozen intent and implementation notes define the single diagnostic outcome.
- `false` — Completion evidence is recorded above and the spec is now marked `done`.
- `false` — The file-local reference is the smallest fix for the editor-only resolution gap; other route modules have no remaining diagnostics and no broader declaration change is justified.
