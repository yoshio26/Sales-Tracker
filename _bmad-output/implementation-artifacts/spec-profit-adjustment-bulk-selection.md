---
title: 'Bulk-select profit adjustment history entries'
type: 'feature'
created: '2026-10-29'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — direct request for easier adjustment-history deletion">

## Intent

**Problem:** The Settings adjustment history currently requires removing entries one at a time, which is inconvenient when several entries need to be deleted.

**Approach:** Add a checkbox beside every adjustment history entry, a check-all control, and one bulk remove action. Bulk removal will use the existing per-entry DELETE endpoint so each selected entry keeps its existing signed-profit reversal and ownership protections.

## Boundaries & Constraints

**Always:** Keep selection state client-side; allow checking and unchecking individual entries; make check-all reflect whether every visible entry is selected; remove only selected entries; refresh dashboard profit after successful removals; preserve the existing single-entry remove behavior and API contract.

**Never:** Do not change adjustment amounts, dashboard formulas, database schema, soft-delete semantics, or selection of unrelated records; do not remove unselected entries.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Select entries | One or more unchecked history entries | Each selected row shows checked state and becomes eligible for bulk removal | N/A |
| Check all | History contains entries and check-all is activated | All currently displayed entries become selected | N/A |
| Uncheck all | All displayed entries are selected and check-all is activated | All displayed entries become unselected | N/A |
| Remove selected | One or more entries selected | Each selected entry is removed through the existing endpoint; dashboard profit reverses each signed contribution | Failed removal reports an error and does not claim that entry was removed |
| No selection | No entries selected | Bulk remove is disabled or unavailable | N/A |
| Empty history | No active entries | Selection controls and bulk action are not shown | N/A |

</frozen-after-approval>

## Code Map

- `FrontEnd/src/pages/SettingsPage.tsx` -- owns adjustment history state, selection controls, and removal requests.
- `FrontEnd/src/App.module.css` -- styles history rows, checkbox layout, check-all control, and bulk action while preserving existing dashboard/table styles.
- `server/modules/profit-adjustment/routes.ts` -- existing per-entry DELETE contract; do not change it.
- `server/modules/profit-adjustment/service.ts` and `data-access.ts` -- existing signed soft-delete behavior; reuse it unchanged.
- `server/modules/dashboard/data-access.ts` and `service.ts` -- existing active signed-entry aggregation; verify bulk removal still refreshes the same calculation.

## Tasks & Acceptance

**Execution:**
- [x] `FrontEnd/src/pages/SettingsPage.tsx` -- add individual selection, check-all selection, and bulk removal using the existing DELETE endpoint -- make history cleanup faster without changing backend semantics.
- [x] `FrontEnd/src/App.module.css` -- style the selection controls and bulk action responsively -- keep rows usable on narrow screens.
- [x] `FrontEnd/src/pages/SettingsPage.tsx` -- verify selection, empty, failure, and dashboard-refresh behavior through available checks -- prevent regressions.

**Acceptance Criteria:**
- Given adjustment history entries are displayed, when the user checks an entry, then only that entry is selected for removal.
- Given adjustment history entries are displayed, when the user activates check all, then every displayed entry is selected.
- Given all displayed entries are selected, when the user activates check all again, then every displayed entry is unselected.
- Given selected entries exist, when the user removes selected entries, then only those entries are deleted and each signed contribution is reversed in dashboard profit.
- Given no entries are selected, when the history is displayed, then the bulk remove action cannot delete any entry.

## Implementation Notes

Implemented client-side selection for visible adjustment history entries. Bulk removal confirms the action, reuses the existing per-entry soft-delete endpoint, preserves failed entries during partial failures, and refreshes dashboard profit after successful removals. Check-all derives its state from the visible entries so stale selection IDs cannot affect the control.

Review result: blind-hunter findings were triaged; loading cleanup, stale-selection handling, and partial-result feedback were fixed. Automated component/browser coverage remains deferred because the repository has no frontend test harness.

## Review Triage Log

- patch: bulk removal could leave the loading state stuck if dashboard refresh failed; wrapped the operation in cleanup and handled refresh errors.
- patch: check-all could be incorrect if selection state contained stale IDs; it now checks every visible entry directly.
- patch: partial bulk failures did not report how many entries succeeded; feedback now reports successful and failed counts.
- defer: no frontend regression harness exists for selection and bulk-removal interaction coverage; deferred to browser/E2E testing.

## Verification

**Commands:**
- `npm run typecheck` -- expected: server and frontend TypeScript checks pass.
- `npm test -- --run` -- expected: all automated tests pass, with only documented skips.
- `npm run build` -- expected: production build succeeds.
- `git diff --check` -- expected: no whitespace errors.
