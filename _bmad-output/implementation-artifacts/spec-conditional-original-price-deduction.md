---
title: 'Conditional original-price profit deduction for stock intake'
type: 'feature'
created: '2026-10-29'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '81fd7fb7ee933fc9ce7e29461225046b15da448c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-stock-purchase-tracker.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When adding stock and choosing “Yes” for “Deduct from Total Profit?”, the application currently records the product’s selling/unit price as the deduction. Users need to enter the stock’s original purchase price separately so profit is reduced by the actual acquisition cost, while the unit price remains the selling price.

**Approach:** Reveal an `Original price` input only after the user chooses `Yes`, collect that value above `Unit price`, and use original price × quantity for the expense deduction. Choosing `No` must not require or submit an original price and must not create a deduction.

**Decisions:** The original-price input is inline in each applicable stock form. The behavior applies to initial stock creation, restocking, and exact-quantity increases.

## Boundaries & Constraints

**Always:** Keep `Unit price` as the product’s selling price; validate original price as a positive monetary value with at most two decimal places; require original price only when deduction is enabled; preserve values and show an accessible validation error on invalid input; ensure the expense amount uses original price and quantity; keep existing ownership, same-origin protection, transaction/error envelopes, and dashboard profit behavior; keep the conditional field hidden and inactive when `No` is selected.

**Never:** Do not replace or reinterpret the product selling price; do not deduct using unit price when an original price is provided; do not create an expense when `No` is selected; do not change purchase checkout totals, purchase history cost, authentication, or unrelated expense entry behavior; do not expose original price as a required field for editing a product without a deduction.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Enable deduction | User selects Yes and enters original price plus quantity | Original price field is visible above Unit price; submit records an expense of original price × quantity; product selling price remains unchanged | Invalid or missing original price blocks submission with an accessible message |
| Disable deduction | User selects No | Original price field is hidden/cleared; stock can be added without an expense deduction | No original-price validation is applied |
| Invalid original price | Yes selected with blank, zero, negative, malformed, or >2-decimal value | No stock/deduction request is completed | Preserve entered fields and show a specific validation error |
| Original price differs from unit price | Yes selected with distinct values | Dashboard profit decreases by the original-price total, not the selling-price total | Existing server error handling remains intact |

</frozen-after-approval>

## Code Map

- `FrontEnd/src/App.tsx` -- initial stock form state, conditional Yes/No control, validation, product creation, and follow-up expense request; reuse existing monetary validation and preserve selling-price payloads.
- `FrontEnd/src/App.module.css` -- existing deduction-choice/form styles; add only the styling needed for the conditional original-price control.
- `FrontEnd/src/pages/StockTrackerPage.tsx` -- later replenishment and quantity-increase deduction controls; touch only if coverage includes those paths, reusing existing deduction modal/state patterns.
- `server/modules/stock/routes.ts` -- replenish and set-quantity request schemas; extend cost input validation only for the selected coverage.
- `server/modules/stock/service.ts` -- pass validated original cost through without changing response mapping.
- `server/modules/stock/data-access.ts` -- expense creation currently uses `product.priceCents`; use the supplied original cost for deductions while retaining the product price for selling/purchase calculations.
- `server/modules/stock/data-access.test.ts` and related route tests -- verify original-cost deduction, no-deduction behavior, validation, and transaction safety.
- `server/modules/expenses/routes.ts` -- existing initial-stock expense endpoint and validation/error envelope; preserve its contract or replace the separate call only if the implementation requires atomicity.

## Tasks & Acceptance

**Execution:**
- [x] `FrontEnd/src/App.tsx`; `FrontEnd/src/App.module.css` -- add conditional original-price state, rendering, validation, and deduction payload behavior without changing the product selling price.
- [x] `server/modules/stock/routes.ts`; `server/modules/stock/service.ts`; `server/modules/stock/data-access.ts` -- accept and apply the validated original cost for covered stock-intake deductions while preserving tenant and transaction guarantees.
- [x] `server/modules/stock/*.test.ts`; relevant frontend verification -- cover Yes/No branches, invalid prices, differing original/unit prices, and unchanged selling/purchase totals.

**Acceptance Criteria:**
- Given Yes is selected, when a valid original price and quantity are submitted, then the original-price total is deducted from profit and the unit price remains the selling price.
- Given No is selected, when stock is submitted, then no original-price field is required and no deduction expense is created.
- Given Yes is selected, when original price is missing or invalid, then submission is blocked with an accessible error and entered values remain available.
- Given original and unit prices differ, when the stock intake succeeds, then dashboard profit reflects original price × quantity rather than unit price × quantity.

## Implementation Notes

The existing initial-stock flow creates the product first and then posts an expense separately; preserve existing behavior unless implementation proves a small transaction-safe adjustment is required. Do not silently use the selling price as a fallback when deduction is enabled.

## Design Notes

The conditional field should be visually grouped with the deduction choice and placed above `Unit price`, with a clear label such as `Original price` and a currency/decimal input affordance. The Yes/No controls should behave as a mutually exclusive choice rather than two independent checkboxes.

## Verification

**Commands:**
- `npm run typecheck` -- expected: server and frontend TypeScript checks pass.
- `npm test` -- expected: stock, expense, and existing regression tests pass.
- `npm run build` -- expected: production frontend and server build succeeds.
- `git diff --check` -- expected: no whitespace errors.
