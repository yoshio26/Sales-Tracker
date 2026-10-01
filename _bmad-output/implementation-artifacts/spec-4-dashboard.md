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
- [x] `client` dashboard tests or documented manual checks -- verify totals, charts, empty/error states, responsive layout, and navigation from the signed-in workspace.

**Acceptance Criteria:**
- Given two authenticated users, when either loads the dashboard, then every aggregate contains only that session user’s non-deleted expenses.
- Given an expense whose product is later edited or archived, when reports load, then product and category labels remain the stored snapshots.
- Given expenses on reporting boundaries, when the dashboard aggregates them, then each half-open UTC range includes its start and excludes its end consistently.
- Given no matching expenses, when the dashboard loads, then totals are zero, charts are empty, and the UI explains the empty state without treating it as an error.
- Given a dashboard request failure, when the UI receives the failure, then it shows an accessible error and retry action without mutating ledger data.
- Given a signed-in user on mobile, tablet, or desktop, when the dashboard renders, then cards and charts remain readable and usable without relying on color alone.

## Implementation Notes

Dashboard is a read-only projection over `Expense`. Keep all persistence behind the dashboard data-access layer; use Prisma tagged-template raw SQL only for grouped aggregates that require it, with no string concatenation. Preserve the existing modular route → service → data-access layering and session middleware.

## Review Triage Log

| Finding | Verdict | Evidence and route |
| --- | --- | --- |
| Dashboard report type omits current-month range fields | false | `Dashboard` explicitly intersects `DashboardReport` with `{ from, to }` for `currentMonth`; the response schema and runtime validation include both fields. |
| ISO date tick labels rely on string slicing | false | The API contract emits ISO 8601 UTC strings, so the fixed-position slices are valid for the selected day/month labels. |
| Mutation refresh shows stale dashboard data without loading feedback | false | `loadDashboard()` sets `dashboardLoading` before each refresh, and the signed-in view renders the loading status while the request is pending. |
| Dashboard needs i18n/currency configuration | false | Localization and configurable currencies are not part of the frozen dashboard intent; this application currently presents English USD amounts. |
| Invalid-range errors need more specific wording | false | The frozen contract requires a `400` for invalid ranges, not distinct messages for each invalid-range cause; the route returns the existing safe error-envelope shape. |
| Recharts bundle size requires code splitting | low / defer | The build emits a non-blocking size warning, but bundle optimization is outside the dashboard acceptance criteria and does not block correctness. |
| Product mutations should refresh dashboard data | false | Product edits and archival do not alter immutable expense snapshots or aggregate values, so refreshing for those mutations is unnecessary. |
| Manual checks need exact seeded expected values | false | The checklist verifies behavior against the seeded database and the automated tests cover the exact contract-level aggregate transformations; hardcoded fixture totals are not required. |
| Product/category aggregates need pagination | false | The spec requires complete breakdown arrays and does not define pagination or limits; adding one would change the API contract. |
| Chart summaries need additional live-region/skip-link behavior | false | The visible summaries expose chart values as text and the chart containers have accessible labels; the frozen requirement is meaningful non-color information, not a separate live-region design. |

| Finding | Verdict | Evidence and route |
| --- | --- | --- |
| Trend summaries exposed only point counts | medium / patch | Real accessibility gap; fixed by exposing each trend bucket and decimal amount in the visible chart summary. |
| Chart wrapper labels were not a complete accessible representation | false | The visible chart summaries provide textual values for trend, product, and category data; the cited outcome no longer occurs. |
| Missing zero-value time-series buckets | false | The frozen intent requires spending buckets but does not require synthetic zero buckets; omitted empty periods do not violate the stated contract. |
| Missing date-range controls | false | Date controls are explicitly optional in the loaded context, and the frozen intent requires fixed current-month/all-time views only. |
| Partial filters silently accepted by the service | false | The public route validates paired and ordered ranges before calling the service; direct internal calls are not an HTTP contract. |
| All-time mapping lacked test coverage | medium / patch | Real verification gap; fixed by asserting all-time decimal category mapping in the service test. |
| Empty state depended on the literal `0.00` string | false | All server money values are normalized by `centsToMoney`, so zero totals are contractually emitted as `0.00`. |
| Manual checklist omitted API-level cases | false | Unauthorized and invalid-range cases are covered by route tests, tenant/deletion/snapshot cases by data-access tests, and UI behavior by the documented checklist. |
| Aggregate SQL tests did not execute database fixtures | false | The spec requests dashboard unit/route tests, and the data-access tests verify every parameterized SELECT predicate, grouping, and bucket expression without introducing database-mutating test fixtures. |
| All-time granularity lacked service assertion | medium / patch | Real verification gap; fixed by asserting day granularity for current month and month granularity for all time. |
| Client dashboard had no automated browser flow | false | The spec explicitly permits documented client manual checks; `client/DASHBOARD-MANUAL-CHECKS.md` covers rendering, empty/error/retry, mutation refresh, responsiveness, and keyboard use. |

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
