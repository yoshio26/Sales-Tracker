---
title: 'Manual profit adjustment in Settings'
type: 'feature'
created: '2026-10-29'
status: 'done'
baseline_commit: '8709f66e90f19f71dc1f2dcab94bb2db1ae972a3'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Settings page has no way to correct or record profit amounts that are not represented by stock purchases and expenses, so the dashboard profit can remain inaccurate for legitimate manual adjustments.

**Approach:** Add a tenant-owned manual profit-adjustment record managed from Settings. Users can add a positive adjustment, deduct a negative adjustment, and edit or delete an existing adjustment; the dashboard profit incorporates the active adjustment while purchase and expense totals remain unchanged and auditable.

**Decisions:** Profit is calculated as existing profit plus one signed manual adjustment; the adjustment affects all-time profit only; and each user has one editable current adjustment rather than an adjustment history.

## Boundaries & Constraints

**Always:** Store money as integer cents; scope every adjustment by authenticated user; validate positive, bounded amounts; preserve the existing calculated profit and expose the adjustment separately in the API where useful; use same-origin protection for mutations; soft-delete or otherwise make deleted adjustments excluded from totals.

**Never:** Do not rewrite purchase history, expense records, stock quantities, selling prices, or the existing profit formula; do not allow a user to access another user's adjustment; do not apply a manual adjustment to total earnings or expense charts unless explicitly decided by the user.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add profit | Positive amount and optional note | Adjustment is stored and dashboard profit increases | Invalid amount returns a validation error |
| Deduct profit | Positive amount selected as deduction | Signed adjustment is stored and dashboard profit decreases | Invalid amount returns a validation error |
| Edit adjustment | Existing adjustment and concurrency timestamp | Same record is updated and dashboard reflects the new signed amount | Stale or missing record returns a conflict/not-found error |
| Delete adjustment | Existing adjustment | Adjustment is excluded from profit | Missing record returns not-found |
| Empty state | No active adjustment | Settings shows no adjustment and dashboard uses calculated profit | N/A |

</frozen-after-approval>

## Code Map

- `FrontEnd/src/pages/SettingsPage.tsx` -- Settings tabs and destructive-data controls; add the profit adjustment panel and API interactions here.
- `FrontEnd/src/App.tsx` -- owns dashboard loading and passes Settings callbacks; refresh dashboard after successful adjustment changes.
- `FrontEnd/src/pages/DashboardPage.tsx` -- dashboard response type and profit card presentation; preserve existing earnings/expense displays while showing adjusted profit.
- `server/modules/dashboard/data-access.ts` -- SQL aggregates for expenses/purchases; extend with tenant-scoped adjustment total if the chosen scope requires it.
- `server/modules/dashboard/service.ts` -- calculates `profit` from purchase cost minus expenses; add the selected adjustment value without changing existing totals.
- `server/modules/dashboard/routes.ts` -- authenticated dashboard endpoint contract.
- `server/modules/expenses/routes.ts`, `service.ts`, `data-access.ts` -- validation, money parsing, ownership, stale-update, and soft-delete patterns to reuse.
- `prisma/schema.prisma` and `prisma/migrations/` -- add the tenant-owned adjustment persistence model and migration.
- `server/modules/dashboard/*.test.ts` and new Settings/adjustment tests -- verify ownership, validation, CRUD, and profit integration.

## Tasks & Acceptance

**Execution:**
- [x] Add a tenant-owned profit-adjustment schema, migration, and data-access/service/route layer using existing money, ownership, concurrency, and mutation patterns.
- [x] Extend dashboard aggregation and response with the selected adjustment semantics without changing purchase or expense totals.
- [x] Add the Settings UI for add, deduct, edit, and delete flows with loading, validation, error, and empty states.
- [x] Refresh dashboard data after successful Settings mutations and add regression tests for all matrix cases.

**Acceptance Criteria:**
- Given an authenticated user, when a valid profit adjustment is saved, then only that user's dashboard profit reflects it.
- Given a deduction adjustment, when the dashboard loads, then profit decreases by the signed adjustment while total earnings and expense totals remain unchanged.
- Given an existing adjustment, when the user edits or deletes it, then the dashboard reflects the new or removed value after refresh.
- Given malformed, oversized, stale, or foreign adjustment input, when the API receives it, then it rejects the request without changing another user's data.
- Given no adjustment, when Settings and the dashboard load, then the existing calculated profit and a clear empty Settings state are shown.

## Implementation Notes

Implemented a single signed, tenant-owned adjustment with a partial unique database index enforcing one active record per user. Add and deduct inputs remain positive in the UI/API and are converted to signed cents in the service. Monthly expense reporting remains unchanged by the all-time-only decision.

Verification completed: Prisma generation, typecheck, full Vitest suite (135 passed, 1 skipped), production build, and `git diff --check`.

## Spec Change Log


## Review Triage Log


## Verification

**Commands:**
- `npm run db:generate` -- expected: Prisma Client generation succeeds.
- `npm run typecheck` -- expected: server and frontend TypeScript checks pass.
- `npm test -- --run` -- expected: all automated tests pass, with only documented skips.
- `npm run build` -- expected: production server and frontend build succeeds.
- `git diff --check` -- expected: no whitespace errors.
