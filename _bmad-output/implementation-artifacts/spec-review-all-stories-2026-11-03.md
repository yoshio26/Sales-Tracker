---
title: 'Review all implementation stories and story-to-code risks'
type: 'review'
created: '2026-11-03'
status: 'in-review'
route: 'review'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-*.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="review record — update only when findings are triaged">

## Intent

Record the read-only review of all implementation story specifications and the most relevant implementation paths. Capture confirmed bugs, suspicious behavior requiring verification, cross-story contradictions, missing edge-case handling, and documentation defects before further implementation or release.

This artifact is a review result, not an implementation request. It does not authorize changes to application code or frozen story intent.

## Scope and method

Reviewed all `spec-*.md` artifacts in `_bmad-output/implementation-artifacts/`, epic context files 1–4, and relevant code under `server/`, `FrontEnd/src/`, `prisma/`, and tests.

Applied four document lenses: adversarial, edge-case, editorial structure, and editorial prose. A separate read-only spec-to-code comparison was used to validate implementation findings. Findings are retained even when lenses overlap; overlap indicates a risk was independently detected.

## Confirmed implementation findings

### Deletion and retention integrity

1. **Purchase-history deletion policy is unresolved.**
   - Location: `server/modules/stock/data-access.ts`, `deletePurchase`.
   - Trigger: A user deletes an individual purchase-history record.
    - Evidence: The function calls `stockPurchase.deleteMany`, while the stock-deletion story defines 10-day retention for dependent history and the Settings story says individual history deletion must not be changed.
    - Guard: Decide whether individual history deletion is hard-delete or soft-delete, then align the route contract, retention rules, and tests.
    - Consequence: Implementers may apply inconsistent retention and recovery behavior across deletion entry points.

2. **Permanent archived-product deletion hard-deletes dependent history.**
   - Location: `server/modules/products/data-access.ts`, `permanentlyDeleteArchivedProduct`.
   - Trigger: An archived product is permanently deleted.
   - Evidence: Related expenses and stock purchases are deleted before the product is deleted.
   - Guard: Reconcile this route with the approved 10-day retention policy; do not hard-delete dependent history unless the product-deletion contract explicitly permits it.
   - Consequence: Historical records disappear immediately and the deletion behavior conflicts with the stock-deletion story.

3. **Product permanent deletion conflicts with restrictive foreign keys.**
   - Location: `prisma/schema.prisma`, `Expense.product` and `StockPurchase.product`; `server/modules/products/data-access.ts`.
   - Trigger: A related row is inserted concurrently or a dependent row is not included in the delete predicates.
   - Evidence: Both relations use `onDelete: Restrict`, and the product delete has no P2003 mapping.
   - Guard: Keep the operation transactional, map P2003 to a safe conflict, and test concurrent references.
   - Consequence: The client can receive an unhandled 500 instead of a safe conflict.

4. **Mixed-age purge behavior needs an explicit product-retention rule.**
   - Location: `server/modules/stock/data-access.ts`, `purgeExpiredDeletedStockData`.
   - Trigger: Expired expenses and purchases are removed, then product deletion is evaluated.
    - Evidence: Product deletion requires `expenses: { none: {} }` and `stockPurchases: { none: {} }`; a newer dependent row can therefore keep a deleted product from being purged after older rows are removed.
    - Guard: Define whether a product is purged only when all dependents are expired/deleted, and test mixed-age dependent rows.
    - Consequence: Product retention may be longer than the stated 10-day window without an explicit user-visible rule.

5. **Stock-wide deletion and Settings deletion stories specify incompatible semantics.**
   - Locations: `spec-delete-stocks-with-history-confirmation.md`, `spec-settings-delete-stocks-history.md`.
   - Trigger: An implementation must choose whether dependent history is soft-deleted together with the product or preserved by returning a conflict.
   - Evidence: One story requires transactional soft deletion of products and dependents; the other says product removal must return a safe conflict when references prevent deletion.
   - Guard: Establish one canonical deletion policy and update both stories and route contracts.
   - Consequence: Different entry points can silently apply different historical-integrity rules.

### Profit, pricing, and reporting semantics

6. **The base profit formula is not defined.**
   - Locations: `spec-4-dashboard.md`, `spec-manual-profit-adjustment.md`, `spec-conditional-original-price-deduction.md`, `server/modules/dashboard/service.ts`.
   - Trigger: Dashboard profit is displayed after stock purchases, expenses, and signed adjustments exist.
   - Evidence: Code calculates `total purchase cost - expense total + adjustments`, while the stories use “profit,” “earnings,” and “deduction” without defining the business equation.
   - Guard: Define the canonical formula, name each term, and add worked examples covering stock purchases, expenses, original-price deductions, and manual adjustments.
   - Consequence: Different features can double-count or omit costs while still passing local tests.

7. **`totalEarnings` is semantically ambiguous.**
   - Location: `server/modules/dashboard/service.ts`.
   - Trigger: Consumers interpret the dashboard response as revenue/profit reporting.
   - Evidence: `totalEarnings` is derived from `StockPurchase.totalCostCents`, which represents purchase cost.
   - Guard: Rename the field or explicitly document that it is total purchase cost; align UI labels and CSV columns.
   - Consequence: Users can make incorrect financial decisions from a misleading metric.

8. **Original-price deduction can be applied twice.**
   - Locations: `spec-manual-profit-adjustment.md`, `spec-conditional-original-price-deduction.md`, stock adjustment code.
   - Trigger: A user enables an original-price deduction and also adds a manual negative adjustment for the same purchase.
   - Guard: Define whether the operations are mutually exclusive, link adjustments to a source transaction, or provide duplicate-deduction validation.
   - Consequence: Profit is reduced twice without an auditable distinction between intended correction and duplicate charge.

9. **Money conversion and rounding rules are incomplete.**
   - Locations: expense, dashboard, and original-price story specifications.
   - Trigger: User input has more than two decimal places or a computed quantity × price exceeds the integer range.
   - Guard: Specify parsing, rounding mode, maximum quantity/price/product, and decimal-string formatting at every API boundary.
   - Consequence: UI totals, stored cents, dashboard totals, and CSV values can disagree by cents or fail with generic errors.

10. **Quantity and total bounds are not consistently specified.**
    - Locations: authentication context, stock-purchase story, expense story, `server/modules/stock/data-access.ts`.
    - Trigger: A very large quantity or price × quantity calculation reaches the database boundary.
    - Guard: Validate positive/non-negative semantics and safe multiplication before mutation; return a documented 4xx envelope.
    - Consequence: Overflow or database errors surface as generic server failures.

### Concurrency and state transitions

11. **Concurrent stock updates have inconsistent contracts.**
    - Location: `server/modules/stock/data-access.ts`, `createPurchase` and `createPurchases`.
    - Trigger: Two requests consume the same product stock concurrently.
    - Evidence: Atomic guarded updates correctly reject one request, but the stories do not define whether that rejection is a conflict, insufficient stock, or retryable response.
    - Guard: Specify the response code, error code, and client preservation/retry behavior for the losing request.
    - Consequence: Users can lose form data or see an unexplained failure even when stock was available when the form opened.

12. **Archive/update races are not fully specified.**
    - Locations: `server/modules/products/data-access.ts`, `updateProduct`, `archiveProduct`.
    - Trigger: An update and archive request use the same last-seen `updatedAt`.
    - Guard: Define the state transition matrix and ensure both routes return distinct, documented stale/archived outcomes.
    - Consequence: An archived product may be updated unexpectedly or the UI may not explain a 409/archived result.

13. **Stock deletion can race with new writes.**
    - Location: `server/modules/stock/data-access.ts`, `deleteStockData`; deletion story edge cases.
    - Trigger: A purchase or expense is created while the 10-second client countdown is active or while deletion commits.
    - Guard: Define transaction isolation/locking or a deletion marker that prevents new writes; test the race.
    - Consequence: Newly-created records may be deleted unexpectedly or remain attached to deleted products.

14. **Adjustment create/delete ordering is unspecified.**
    - Location: profit-adjustment stories and frontend mutation flow.
    - Trigger: Add and remove requests for the same adjustment are sent out of order.
    - Guard: Make delete idempotent, return a stable mutation version, or queue mutations client-side.
    - Consequence: The UI and server can disagree about whether the adjustment exists.

15. **Bulk adjustment deletion lacks an atomicity contract.**
    - Location: `spec-profit-adjustment-bulk-selection.md`.
    - Trigger: One item in a multi-delete request fails after earlier items succeed.
    - Guard: Use one transaction with all-or-nothing semantics, or return per-item results and make partial success explicit.
    - Consequence: The UI can claim all items were removed while some remain.

### Authentication and security gaps

16. **SMTP failure behavior needs an explicit anti-enumeration contract.**
    - Location: authentication story and Gmail SMTP story.
    - Trigger: An allowlisted request persists a code, then mail delivery fails.
    - Guard: Invalidate or mark the code unusable on delivery failure while keeping timing, status, and response behavior indistinguishable from an unapproved request.
    - Consequence: Retry behavior or timing can reveal allowlist membership and leave usable codes in an uncertain state.

17. **Rate-limit ordering and atomicity are underspecified.**
    - Location: authentication request-code flow.
    - Trigger: Concurrent requests hit email and IP limits at the same time.
    - Guard: Define atomic bucket accounting, precedence, response timing, and a generic public error contract.
    - Consequence: Limit-specific behavior can become an enumeration signal or allow more requests than intended.

18. **User lifecycle behavior is absent.**
    - Location: cross-story behavior; Prisma user relations.
    - Trigger: A user is suspended, removed, or purged while authenticated mutations are in flight.
    - Guard: Define account deletion/suspension semantics, session invalidation, and data ownership cleanup before production use.
    - Consequence: Orphaned data, stale sessions, or writes after account removal can occur.

### Reporting and export gaps

19. **Dashboard and CSV month selection do not share a timezone contract.**
    - Locations: `spec-4-dashboard.md`, `spec-monthly-report-csv-export.md`.
    - Trigger: A user selects a calendar month outside UTC or crosses a daylight-saving transition.
    - Guard: Define whether calendar months are UTC or user-local and use the same half-open range in dashboard and export queries.
    - Consequence: Dashboard and CSV can contain different records for the same selected month.

20. **Dashboard label generation is format-dependent.**
    - Location: `FrontEnd/src/pages/DashboardPage.tsx`.
    - Trigger: API timestamp serialization changes from the currently assumed ISO layout.
    - Guard: Parse timestamps as dates and format labels with an explicit UTC/local policy instead of fixed string slices.
    - Consequence: Chart labels become incorrect without a type or transport error.

21. **Dashboard consistency during concurrent mutations is unspecified.**
    - Locations: dashboard aggregate queries and stock-table queries.
    - Trigger: Soft deletion or purchase deletion occurs while multiple aggregate queries run.
    - Guard: Define snapshot consistency requirements and use a transaction or single reporting query where required.
    - Consequence: Totals, trends, and stock counts can represent different database moments.

## Additional suspicious code areas requiring targeted verification

- `server/modules/products/data-access.ts`: `listProducts(..., 'archived')` filters `active: false` but does not explicitly filter `deletedAt`, so already-deleted products may appear in archived lists.
- `server/modules/products/data-access.ts`: `restoreArchivedProduct` restores dependent expenses and purchases with non-null `deletedAt`; verify this is intended for all archived-product flows, not only Settings stock deletion.
- `server/modules/stock/data-access.ts`: `adjustStock` and `setStockQuantity` persist `originalPriceCents` on `Product`; verify this matches the story boundary that original price is transaction-specific rather than a product-edit field.
- `server/modules/stock/data-access.ts`: `deletePurchase` returns a raw `deleteMany` result; verify the route maps zero rows, repeated deletion, and cross-tenant IDs to the documented response envelope.
- `server/modules/dashboard/service.ts`: `filters.from`/`filters.to` are accepted as a pair without a visible range-order, maximum-span, or timezone validation contract; verify route validation and service callers.
- `prisma/schema.prisma`: `Product.priceCents`, `stockQuantity`, `Expense.amountCents`, `Expense.quantity`, and `StockPurchase` numeric fields are database `Int`; verify all API validation prevents negative values and overflow.
- `prisma/schema.prisma`: Product uniqueness is on the persisted `name`; verify every product create/update path uses the same trim/lowercase normalization policy.
- `FrontEnd/src/pages/DashboardPage.tsx`: month and all-time labels use fixed string slicing; verify behavior for timestamps with offsets, missing milliseconds, and invalid values.

## Document-level findings

- Define and publish one canonical spec schema. Current feature, bugfix, design-only, and dispatch specs omit different sections without documenting the variants.
- Standardize section names and order, especially `Boundaries & Constraints`, `I/O & Edge-Case Matrix`, `Tasks & Acceptance`, `Verification`, and `Review Triage Log`.
- Add explicit dependency sections and reciprocal links between epic contexts and detailed specs; current dependencies require manual tracing.
- Reconcile duplicate or conflicting deletion policies before implementation continues.
- Add a canonical profit glossary and worked examples to the dashboard/adjustment stories.
- Add timezone, rounding, numeric bounds, purge trigger, and concurrency contracts to the relevant I/O matrices.
- Normalize code-map paths and granularity so each story points to the exact route, service, data-access, schema, and test entry points.
- Clarify incomplete and done statuses, and record an explicit empty/pending review state instead of omitting triage logs.
- Fix prose issues that impede comprehension, including run-on semicolon lists, vague terms such as “persist” or “behind those products,” and the typo “Delivery a complete expense ledger.”

## Verification plan

Before triage is closed:

- Add or update tests for soft-delete/idempotency, restrictive foreign-key conflicts, mixed-age purge dependencies, concurrent stock mutation, archive/update races, and bulk-delete atomicity.
- Add contract tests for profit calculations, decimal rounding, numeric bounds, UTC/local month selection, CSV/dashboard parity, and generic authentication failures.
- Run the existing server typecheck, test suite, production build, and documented frontend manual checks after implementation changes.
- Re-run this review after the deletion policy and profit formula are approved; do not mark the findings resolved based only on passing existing tests.

## Review status

The review is complete for the current snapshot. Findings are not severity-ranked. “Confirmed implementation finding” means the current code or documents directly support the observation; “suspicious code area” means a focused follow-up is required before calling it a bug.

</frozen-after-approval>
