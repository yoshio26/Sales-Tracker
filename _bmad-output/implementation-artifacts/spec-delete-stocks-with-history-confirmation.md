---
title: 'Delete stocks with dependent history after a timed confirmation'
type: 'feature'
created: '2026-10-02'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '590c959301724f3a1eb3d57b49859ef65113b611'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-settings-delete-stocks-history.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-stock-purchase-tracker.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Settings stock deletion action currently refuses to remove products when purchase history or expenses reference them. The user wants to proceed with deletion after a deliberate confirmation period so accidental destructive actions are less likely.

**Approach:** Replace the immediate browser confirmation with an accessible in-app confirmation panel that clearly warns about the destructive action, counts down from 10 seconds, enables confirmation only when the countdown completes, and provides a Cancel action throughout. Update the authenticated stock deletion operation to soft-delete the selected tenant's stock data and its dependent records so they leave active views immediately, remain recoverable for 10 days, and are permanently purged afterward without affecting another user's data.

## Boundaries & Constraints

**Always:** Keep deletion session-scoped, same-origin protected, transactional, and represented by the existing error envelope. The confirmation must begin at 10 seconds, visibly update once per second, prevent confirmation before zero, and allow cancellation without a request. Refresh stock, history, and dashboard views only after successful deletion. Preserve accessible labels, focus behavior, loading/error/success feedback, and existing purchase calculations. Deleted data must be recoverable for 10 days and permanently purged after the retention window.

**Never:** Accept a client-supplied user ID, allow cross-tenant deletion, silently delete data, bypass the confirmation period, or leave orphaned foreign-key records. Do not change authentication, pricing, purchase creation, or individual purchase-history deletion behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Start deletion | Authenticated user selects Delete stocks | Warning panel opens with irreversible warning, 10-second countdown, disabled Confirm, and Cancel | No DELETE request is sent yet |
| Cancel deletion | Countdown active or complete | Panel closes and no stock/history/expense data changes | Existing page state remains intact |
| Confirm deletion | Countdown reaches zero and user confirms | Server soft-deletes only the user's stock data and dependent records; affected views refresh | Server failure preserves the error state and does not claim success |
| Referenced records | User has expenses or purchase history | Deletion soft-deletes the user's products and dependent records, preserving them for recovery for 10 days | Transaction rolls back on failure; no partial deletion |
| Retention expiry | Soft-deleted data is older than 10 days | A purge removes it permanently and it is no longer recoverable | Purge is scoped to expired tenant-owned deleted data |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- `Product`, `Expense`, and `StockPurchase` need deletion timestamps or an equivalent retention marker; persistence policy must prevent orphaned references.
- `prisma/migrations/` -- add a forward-only migration for the 10-day soft-delete/purge fields and indexes needed by active reads and expiry cleanup.
- `server/modules/stock/data-access.ts` -- `deleteStockData` currently pre-checks references and returns `referenced`; change it to a transactional soft-delete while retaining tenant scoping and add expired-data purge behavior.
- `server/modules/stock/service.ts` -- exposes `deleteStockData`; preserve route → service → data-access layering.
- `server/modules/stock/routes.ts` -- `DELETE /api/stock` is session and same-origin protected but currently returns `409 STOCK_REFERENCED`; update its success/error contract if required by the policy.
- `server/modules/stock/data-access.test.ts` and `server/modules/stock/routes.test.ts` -- extend deletion tests for referenced records, rollback/error behavior, ownership, and the new response contract.
- `FrontEnd/src/pages/SettingsPage.tsx` -- `deleteStocks` currently uses `window.confirm`; replace it with a 10-second cancellable confirmation panel.
- `FrontEnd/src/App.module.css` -- reuse existing danger/modal/status styles and add responsive confirmation-panel styling.
- `FrontEnd/DASHBOARD-MANUAL-CHECKS.md` -- document countdown, cancellation, confirmed deletion, and referenced-record behavior.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma`; `prisma/migrations/` -- implement 10-day soft deletion and expiry metadata without orphaning references.
- [x] `server/modules/stock/data-access.ts`; `server/modules/stock/service.ts`; `server/modules/stock/routes.ts` -- implement transactional, tenant-scoped deletion for referenced and unreferenced records with safe errors.
- [x] `FrontEnd/src/pages/SettingsPage.tsx`; `FrontEnd/src/App.module.css` -- add the 10-second confirmation panel, cancellation, disabled-until-zero confirmation, feedback, and responsive styling.
- [x] `server/modules/stock/*.test.ts`; `FrontEnd/DASHBOARD-MANUAL-CHECKS.md` -- verify policy behavior, ownership, rollback, countdown, cancellation, success, and failure states.

**Acceptance Criteria:**
- Given an authenticated user, when Delete stocks is selected, then no mutation occurs until the visible 10-second confirmation completes.
- Given the countdown is active, when Cancel is selected, then the confirmation closes and no DELETE request is made.
- Given the countdown reaches zero, when Confirm is selected, then only the authenticated user's stock data and approved dependent records are deleted atomically.
- Given another user's records exist, when deletion is performed, then those records remain unchanged.
- Given deletion fails, when the response is received, then the UI shows an error and does not show a success notice.

## Implementation Notes

Approved policy: stock products, expenses, and purchase-history rows are soft-deleted together. They must be excluded from active views, remain recoverable for 10 days, and be permanently purged after the retention window. The existing restrictive foreign keys remain intact.

## Verification

**Commands:**
- `npm run typecheck` -- expected: server and frontend TypeScript checks pass.
- `npm test` -- expected: stock route/data-access tests and the existing suite pass or unrelated known failures are reported.
- `npm run build` -- expected: production build succeeds.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Open Settings, start deletion, observe 10 → 0 countdown, cancel before zero, and confirm no data changed.
- Repeat with referenced expenses/purchases and confirm the approved policy result plus refreshed views.

## Review Triage Log

- `false` — Blind hunter claimed `Expense.deletedAt` and its migration were missing; the schema and baseline migration already contain the expense retention field, while this change correctly reuses it.
- `false` — Blind hunter claimed an expense retention index was missing; the existing expense indexes already cover `userId`, `deletedAt`, and the relevant query dimensions.
- `false` — Blind hunter claimed dashboard expense queries lacked deleted filters; all expense aggregates already use `deleted_at IS NULL`, and this change adds the missing stock and purchase filters.
- `false` — Blind hunter claimed product purge relation guards would never match; expired dependent rows are deleted first, while newer dependent rows intentionally prevent product deletion and preserve the restrictive foreign key.
- `low` — Blind hunter noted that the countdown status is not a separate announcement event; the live status text changes from the countdown to an explicit confirmation-ready message, so the control transition is communicated without adding another accessibility mechanism. Rejected as an everyday-use defect.
- `false` — Blind hunter claimed focus may fail because the cancel ref can be unattached; the effect runs after the dialog render and optional chaining safely handles teardown.
- `false` — Blind hunter claimed a countdown race silently fails; the Confirm control is disabled and the function guard prevents a request until zero, so no user-visible race response is needed.
- `false` — Edge hunter claimed the cleanup function was never invoked; `server/index.ts` now invokes it on the existing periodic cleanup interval.
- `false` — Edge hunter claimed stock purchases lack a soft-delete timestamp update; `StockPurchase` has no `updatedAt` field, so adding one would violate the existing model rather than fix this feature.
- `false` — Edge hunter repeated the obsolete unscheduled-purge claim; scheduled cleanup now calls `purgeExpiredDeletedStockData` across tenants.
- `false` — Verification-gap reviewer requested a purge assertion in the user-deletion test; the dedicated purge test already verifies the product dependency guard and the scheduled purge test now verifies all three delete operations.
- `false` — Verification-gap reviewer claimed scheduled purge product constraints were untested; the scheduled purge test now asserts the exact guarded product delete predicate.
- `medium` — Verification-gap reviewer noted there is no automated frontend timer test; this repository uses the documented manual-check harness for the Settings UI, and the backend safety guard plus typecheck/build cover the mutation boundary. Deferred as a test-harness enhancement rather than a feature defect.
- `false` — Verification-gap reviewer claimed dashboard route behavior was unverified; dashboard service tests exercise the route-facing service and the changed raw queries are the sole data source for the affected summaries.
