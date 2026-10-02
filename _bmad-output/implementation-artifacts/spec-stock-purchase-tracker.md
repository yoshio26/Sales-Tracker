---
title: 'Stock purchase tracking and history'
type: 'feature'
created: '2026-10-02'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'c49e7cc8ef78f89ffc498c1d06bf99e26f3e443b'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The application can manage products and expenses, but it does not provide a stock-focused workflow for recording a purchase, reducing available stock, showing the result on the dashboard, or reviewing previously bought items.

**Approach:** Add a signed-in stock tracker centered on a dedicated buy workflow, replenishment control, and stock view. The Buy action consumes available stock; replenishment adds stock explicitly. A successful purchase records an immutable history entry with quantity, product/category, timestamp, and total cost, updates the selected product's available stock atomically, and refreshes dashboard stock/purchase information without changing existing authentication or historical expense behavior.

## Boundaries & Constraints

**Always:** Derive ownership from the authenticated session; validate all client input with Zod; keep stock quantities as non-negative integers; perform purchase recording and stock adjustment in one transaction; reject a purchase that exceeds available stock without creating a partial history row; preserve product and category snapshots in history; exclude foreign, archived, or unknown products from purchase operations; protect mutations with the existing same-Origin middleware; provide loading, empty, error, and accessible success feedback.

**Never:** Accept a client `userId`, allow negative stock, hard-delete purchase history, mutate existing authentication behavior, rewrite existing expense snapshots, or silently permit an over-quantity purchase. Transfers, sales workflows, and exports remain out of scope.

**Decisions:** Buy decreases existing stock; an explicit replenishment/stock-adjustment control provides initial and additional stock; history and dashboard purchase details include quantity, product/category, UTC timestamp, and total cost using the existing expense amount.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Record purchase | Authenticated user selects an active product, valid quantity, and total cost | Available stock decreases by the purchased quantity; a history record stores product/category snapshots, quantity, total cost, and UTC timestamp | Invalid input returns `400`; unknown/foreign/archived product returns a safe not-found response |
| Insufficient stock | Purchase quantity is greater than current stock | Neither stock nor history changes | Return a clear conflict/error response and preserve entered values |
| Stock view | Authenticated user opens the tracker | Only the user's active products appear with current non-negative stock; zero-stock products remain visible | Unauthenticated access returns existing `401`; load failure shows retryable error |
| Purchase history | User opens history or filters it | Purchases are listed newest first with stable historical product/category labels, quantity, total cost, and timestamp | Deleted or foreign records are not exposed; empty history has an explanatory state |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- extend the user-owned product/purchase model with stock quantity and immutable purchase history fields; preserve existing Expense relations and constraints.
- `prisma/migrations/` -- add a forward-only migration for stock and purchase history constraints/indexes; do not modify prior migrations.
- `server/modules/products/data-access.ts`; `server/modules/products/service.ts` -- reuse tenant-scoped product lookup, active/archive rules, response mapping, and optimistic update conventions.
- `server/modules/expenses/data-access.ts`; `server/modules/expenses/service.ts`; `server/modules/expenses/routes.ts` -- reuse validated quantity/amount handling and transaction/error patterns where the approved purchase contract overlaps the expense ledger.
- `server/modules/dashboard/data-access.ts`; `server/modules/dashboard/service.ts`; `server/modules/dashboard/routes.ts` -- extend the read-only dashboard projection with approved stock and purchase summaries without mutating data.
- `server/app.ts` -- mount any new protected stock/purchase router while preserving middleware order.
- `FrontEnd/src/App.tsx`; `FrontEnd/src/App.module.css` -- add navigation between dashboard, buy, stock tracker, and history views using existing request, form, and accessible feedback patterns.
- `server/modules/*/*.test.ts`; `FrontEnd/DASHBOARD-MANUAL-CHECKS.md` -- extend tenant, transaction, insufficient-stock, history, dashboard, and UI-flow verification.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma`; `prisma/migrations/<timestamp>_stock_purchase_tracking/migration.sql` -- add stock state and immutable purchase history with non-negative checks, ownership constraints, snapshots, total cost, and indexes.
- [x] `server/modules/stock/` and `server/app.ts` -- implement protected stock, buy, and history endpoints with Zod validation, same-Origin protection, atomic decrement/history creation, and safe errors.
- [x] `server/modules/dashboard/` -- add session-scoped stock totals and purchase summaries while preserving existing expense aggregates and snapshot semantics.
- [x] `FrontEnd/src/App.tsx`; `FrontEnd/src/App.module.css` -- add Buy, Stock Tracker, and Purchase History views with validation, insufficient-stock feedback, refresh behavior, responsive layout, and accessible states.
- [x] `server/modules/stock/*.test.ts`; `server/modules/dashboard/*.test.ts`; `FrontEnd/DASHBOARD-MANUAL-CHECKS.md` -- verify ownership, atomicity, quantity boundaries, history snapshots, dashboard refresh, and user-visible flows.

**Acceptance Criteria:**
- Given a signed-in user with available stock, when they submit a valid purchase, then stock decreases by exactly the requested quantity and one history record is created.
- Given insufficient stock, when a purchase is submitted, then the server returns a conflict and neither stock nor history changes.
- Given two users, when either accesses stock or purchase history, then only records owned by that session are returned.
- Given a product is later renamed or archived, when its purchase history is viewed, then the historical product and category labels remain unchanged.
- Given a successful purchase, when the dashboard reloads, then its approved stock and purchase metrics reflect the transaction without duplicating it.
- Given invalid, archived, or missing product input, when the buy form is submitted, then no mutation occurs and an accessible error preserves the user's entered values.

## Implementation Notes

Implementation must preserve the existing layered route → service → data-access architecture and existing API error envelope.

## Design Notes

The feature should make the transaction direction explicit in labels and confirmation feedback so users can distinguish available stock from purchase history. The history view is append-only from the user's perspective; corrections should be handled by a separate approved policy rather than silently rewriting audit records.

## Verification

**Commands:**
- `npm run db:generate` -- expected: Prisma Client generation succeeds.
- `npm run db:migrate` -- expected: the forward-only stock migration applies cleanly.
- `npm run typecheck` -- expected: server and client TypeScript checks pass.
- `npm test` -- expected: existing tests plus stock/purchase/dashboard tests pass.
- `npm run build` -- expected: production client and server build succeeds.
- `git diff --check` -- expected: no whitespace errors.
