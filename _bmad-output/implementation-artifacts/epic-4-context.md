# Epic 4 Context: Dashboard

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Implement a read-only dashboard that displays current-month and all-time spending totals, time-series spending trends, and spending breakdown by product and category. All calculations use non-deleted expenses and product/category snapshots to ensure historical accuracy when products are edited or archived. Add interactive loading, empty, error, and responsive chart states so users can interpret spending across multiple dimensions.

## Stories

- Dashboard totals: Display current-month and all-time totals as summary cards
- Time-series aggregates: Chart spending over time with daily/monthly granularity
- Product breakdown: Group and chart spending by product snapshot
- Category breakdown: Group and chart spending by category snapshot
- Loading and error states: Show loading spinners, empty-state messages, and server-error recovery
- Responsive layout: Adapt charts and cards for mobile, tablet, and desktop viewports

## Requirements & Constraints

Dashboard queries must:
- Sum only expenses where `deleted_at IS NULL` so deleted entries never affect totals.
- Group by `product_name_snapshot` and `category_snapshot`, not current product fields, so historical reports remain stable when products are edited or archived.
- Use half-open UTC time ranges `[start, end)` to avoid ambiguity at month boundaries and between timezones.
- Calculate this-month and all-time totals using a consistent shared date-range service.

Dashboard data access is read-only and may only issue parameterized `SELECT` statements; no mutations are permitted. Money values in API responses are decimal strings to preserve cents precision across JSON. All aggregate queries are tenant-scoped by `user_id` derived from the session, never from client input.

## Technical Decisions

Dashboard is a read-only projection. It queries only the Expenses table and never calls expense mutation methods or mutates ledger data. All aggregates use parameterized `SELECT` queries with Prisma `$queryRaw` where grouped reporting queries require SQL expressions.

Reporting uses one UTC time-boundary policy. All timestamps are stored in UTC; all range queries use half-open intervals. A shared reporting date-range service provides consistent month and all-time boundaries to dashboard queries. User display timezone is a presentation concern and never affects ownership or ledger selection.

Expense snapshots are the authoritative dimensions for historical reporting. Product and category charts group by immutable snapshot columns rather than current product fields, ensuring product edits and archival do not rewrite historical spending reports.

Module structure mirrors the existing services: routes handle HTTP and Zod validation; the dashboard service owns business logic and aggregate definitions; data access contains only parameterized `SELECT` statements scoped by `user_id` and `deleted_at IS NULL`.

## UX & Interaction Patterns

Dashboard displays total cards for current month and all time above charts. Spending over time uses a line or bar chart with UTC dates on the x-axis. Product and category breakdowns use bars ordered by descending total, with labels from snapshot columns.

Charts include text labels or accessible summaries so information is conveyed without relying on color alone. Loading, empty-ledger, and server-error states are explicit: show loading feedback during fetches, an empty message such as “No expenses recorded yet” when appropriate, and an error panel with retry action when the API fails.

The layout is responsive: cards and charts stack on mobile, adapt to two-column grids on tablet, and use larger chart areas on desktop. Date-range controls, if present, allow switching between this month and all time without a page reload.

## Cross-Story Dependencies

Dashboard depends on the Expenses module from Epic 3 for recorded expenses and immutable snapshots. It depends on the Products module from Epic 2 for catalog and snapshot definitions. Authentication from Epic 1 provides the session identity that scopes every query. The React/Vite application lives under `FrontEnd/`, with frontend context organized under `FrontEnd/src/`.
