---
title: 'Monthly report CSV export'
type: 'feature'
created: '2026-10-06'
status: 'done'
baseline_commit: '917719248fe65ac59123f2aa92cf98aac83cf409'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Reports currently show visual charts but do not provide downloadable tabular report files. The user needs monthly CSV exports for purchase costs and current stock performance.

**Approach:** Add a month selector and an `Export Report?` action to the dashboard Reports view. The selected calendar month controls purchase rows in two CSV files: purchase rows with `Stock Name`, `Date Bought`, and `Cost`; and active-stock rows with `Stock Name`, `Remaining Stocks`, `Updated Price`, and `Sold`.

## Boundaries & Constraints

**Always:** Keep existing APIs, authentication, soft-delete behavior, dashboard calculations, and dark/light toggle unchanged. Require the authenticated session for exports. Preserve tenant isolation. Escape CSV values safely and use the existing response data/money conventions. Exports must be limited to the monthly reporting range selected by the approved behavior.

**Never:** Do not add database migrations, replace existing JSON endpoints, alter chart calculations, add a sidebar item, or change non-Reports pages.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| HAPPY_PATH | Authenticated user, monthly purchases and active stock | `Export Report?` downloads the two requested CSV files with headers and rows | N/A |
| EMPTY_MONTH | Authenticated user, no purchases in the month | Purchase CSV contains headers only; stock CSV still contains active stock rows | N/A |
| CSV_SPECIAL_CHARACTERS | Names contain commas, quotes, or line breaks | Values are quoted/escaped as valid CSV | N/A |
| UNAUTHENTICATED | No valid session | Export request is rejected and no file is downloaded | Existing session error behavior |

</frozen-after-approval>

## Code Map

- `FrontEnd/src/App.tsx` -- owns workspace routing and dashboard-only `dashboardSection`; keep existing navigation and theme state unchanged.
- `FrontEnd/src/pages/DashboardPage.tsx` -- renders Overview/Reports content; add the Reports export action without changing chart semantics.
- `FrontEnd/src/pages/DashboardStockTable.tsx` -- existing stock table data shape and labels can inform the stock CSV columns; do not duplicate its table behavior.
- `server/modules/stock/routes.ts` -- authenticated stock and purchase routes; add export endpoints alongside existing stock routes while preserving JSON contracts.
- `server/modules/stock/service.ts` -- response mappings and money formatting; reuse or extend narrowly for CSV source data.
- `server/modules/stock/data-access.ts` -- tenant-safe active product and non-deleted purchase queries; reuse existing filters and date fields.
- `server/modules/dashboard/data-access.ts` -- existing monthly range conventions; use only as the reference for date boundaries.
- `FrontEnd/src/App.module.css` -- existing Reports/dashboard styles and accent variables; add only scoped export control styling if needed.

## Tasks & Acceptance

**Execution:**
- [x] Add a month selector whose selected calendar month controls the export range.
- [x] Add tenant-safe server CSV export support for purchases and active stock, including sold totals and CSV escaping.
- [x] Add `Export Report?` to Reports and download both CSV files without changing other dashboard/page behavior.
- [x] Add focused server/frontend tests for monthly filtering, empty results, escaping, and export rendering.

**Acceptance Criteria:**
- Given an authenticated user on Reports, when `Export Report?` is activated, then the two requested CSV formats download with the exact column headers.
- Given records outside the approved monthly range, when an export runs, then those purchase records are excluded while active stock rows remain represented with current remaining stock, updated price, and sold quantity.
- Given names containing CSV punctuation, when exported, then fields remain parseable and preserve their original text.
- Given another user’s data, when an export runs, then that data is never included.
- Given any other workspace page, when it renders, then no Reports export control is shown and existing behavior is unchanged.

## Implementation Notes

- Added authenticated purchase and active-stock CSV endpoints with UTC month filtering, tenant-safe soft-delete filters, exact requested headers, and CSV escaping.
- Added the Reports month selector and `Export Report?` action, which downloads both CSV files with session credentials.
- Added focused route, data-access, service, and frontend helper coverage; full local validation passes with `APP_ORIGIN=http://localhost:5173` and `COOKIE_SECURE=false`.

## Spec Change Log

## Review Triage Log

- `patch` — Route review identified missing assertions for CSV attachment filenames and content type on the stock export; route tests now cover both response headers.
- `patch` — Verification review identified an untested failed-export path; frontend helper tests now verify that failed responses create no downloads.
- `defer` — Dashboard component-level interaction coverage remains a broader frontend test-infrastructure improvement; helper and route behavior are covered, and the production build passes.
- `defer` — Formula-injection hardening, cache-control headers, and deferred object-URL revocation are security/browser-hardening follow-ups beyond the approved CSV shape and current conventions.
- `defer` — Database-side purchase date filtering and unusual four-digit years are optimization/edge-hardening follow-ups; current behavior is correct for the selectable browser month and focused monthly tests.
- `false` — Tenant isolation is enforced in the report data-access predicates and exercised by user-scoped query assertions; no cross-tenant rows can enter either export query.

## Design Notes

The purchase export should use the purchase snapshot name and purchase timestamp. The stock export should aggregate non-deleted purchase quantities by active product ID for the sold column; products with no purchases use zero.

## Verification

**Commands:**
- `npm run typecheck` -- expected: server and frontend TypeScript checks pass.
- `npm test` -- expected: focused and existing tests pass.
- `npm --prefix FrontEnd run build` -- expected: production frontend build succeeds.
- `git diff --check` -- expected: no whitespace errors.
