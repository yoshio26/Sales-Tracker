---
title: 'Epic 4: Dashboard'
type: 'feature'
created: '2026-10-01'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '6cba89a33262f830da2aeb365e61ff1c0dff3904'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Sales-Tracker-2026-09-30/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Sales-Tracker-2026-09-30/DATA-MODEL.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Sales-Tracker-2026-09-30/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users can record expenses but have no visual summary of current-month spending, all-time spending, trends, or the product and category dimensions behind their ledger.

**Approach:** Add a read-only, session-scoped dashboard projection with aggregate API responses and a responsive signed-in dashboard view. Reports use non-deleted expenses and immutable expense snapshots so catalog edits and archival do not rewrite historical spending.

## Boundaries & Constraints

**Always:** Derive ownership from the authenticated session; exclude soft-deleted expenses; group product and category reports by expense snapshot fields; use UTC timestamps and half-open ranges; return money as decimal strings; keep dashboard data access read-only and parameterized; use Recharts for dashboard charts; show daily time-series buckets for the current month and monthly buckets for all-time; provide loading, empty, error, retry, responsive, and accessible states.

**Never:** Mutate expenses or products from dashboard code; join current product fields for historical report dimensions; accept client ownership; alter Auth, Products, or Expenses behavior; add exports, forecasting, or unrelated dashboard metrics.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Dashboard load | Authenticated user with expenses | Returns current-month/all-time totals, time-series data, product breakdown, and category breakdown | Unauthenticated request returns existing `401` envelope; server failure returns safe `500` envelope |
| Empty ledger | Authenticated user with no non-deleted expenses | Returns zero totals and empty aggregate arrays; UI explains that no expenses are recorded yet | No error state for an empty result |
| Historical reporting | Expense references an edited or archived product | Reports retain the expense’s stored product/category labels | Current catalog values must not replace snapshots |
| Date boundaries | Expenses at range start/end | Start is included and end is excluded consistently across aggregates | Invalid range input returns `400` |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- existing `Expense` fields and indexes provide amount cents, UTC `spentAt`, soft deletion, and snapshot dimensions; do not change the schema for dashboard aggregates.
- `server/app.ts` -- mount the new protected dashboard router without changing middleware order or existing routes.
- `server/modules/expenses/data-access.ts` and `server/modules/expenses/service.ts` -- source-of-truth expense behavior and response conventions; dashboard must not call mutation methods.
- `server/modules/dashboard/data-access.ts` -- new read-only aggregate queries using session `userId`, `deletedAt IS NULL`, snapshot grouping, and parameterized Prisma queries.
- `server/modules/dashboard/service.ts` -- new reporting boundaries, aggregate orchestration, and decimal-string money mapping.
- `server/modules/dashboard/routes.ts` -- new authenticated GET endpoint(s), Zod filter validation, and existing error envelopes.
- `client/src/App.tsx` and `client/src/App.module.css` -- integrate the dashboard view, API state, responsive cards/charts, and accessible loading/empty/error feedback without regressing catalog or ledger flows.
- `client/package.json` -- add the approved chart rendering dependency only if that open question selects one.

## Tasks & Acceptance

**Execution:**
- [x] `server/modules/dashboard/data-access.ts` -- implement tenant-scoped, read-only totals, time-series, product, and category aggregate queries over non-deleted expenses.
- [x] `server/modules/dashboard/service.ts` -- implement shared UTC half-open date boundaries, aggregate orchestration, and decimal-string money responses.
- [x] `server/modules/dashboard/routes.ts`; `server/app.ts` -- expose protected GET dashboard data with validated filters and mount the router.
- [x] `server/modules/dashboard/*.test.ts` -- test tenant isolation, soft-delete exclusion, snapshot grouping, zero-result behavior, date boundaries, validation, and unauthorized access.
- [x] `client/src/App.tsx`; `client/src/App.module.css`; `client/package.json` -- add the dashboard view, approved chart rendering, responsive layout, accessible labels/summaries, loading/empty/error/retry states, and preserve existing flows.
- [ ] `client` dashboard tests or documented manual checks -- verify totals, charts, empty/error states, responsive layout, and navigation from the signed-in workspace.

**Acceptance Criteria:**
- Given two authenticated users, when either loads the dashboard, then every aggregate contains only that session user’s non-deleted expenses.
- Given an expense whose product is later edited or archived, when reports load, then product and category labels remain the stored snapshots.
- Given expenses on reporting boundaries, when the dashboard aggregates them, then each half-open UTC range includes its start and excludes its end consistently.
- Given no matching expenses, when the dashboard loads, then totals are zero, charts are empty, and the UI explains the empty state without treating it as an error.
- Given a dashboard request failure, when the UI receives the failure, then it shows an accessible error and retry action without mutating ledger data.
- Given a signed-in user on mobile, tablet, or desktop, when the dashboard renders, then cards and charts remain readable and usable without relying on color alone.

## Implementation Notes

Dashboard is a read-only projection over `Expense`. Keep all persistence behind the dashboard data-access layer; use Prisma tagged-template raw SQL only for grouped aggregates that require it, with no string concatenation. Preserve the existing modular route → service → data-access layering and session middleware.

## Design Notes

The signed-in workspace should present summary cards before the charts, with a calm data-first visual hierarchy. Historical dimensions come from `productNameSnapshot` and `categorySnapshot`, never current catalog joins. Chart labels or text summaries must remain meaningful in grayscale and assistive technology.

## Verification

**Commands:**
- `npm run db:generate` -- expected: Prisma Client generation succeeds without schema changes.
- `npm run typecheck` -- expected: server and client TypeScript checks pass.
- `npm test` -- expected: existing tests and dashboard unit/route tests pass.
- `npm run build` -- expected: production client and server build succeeds.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Signed-in dashboard shows correct totals and breakdowns for seeded expenses, excludes deleted rows, preserves snapshot labels after product archival, and adapts across viewport sizes.
