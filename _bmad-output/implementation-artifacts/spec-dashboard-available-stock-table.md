m---
title: 'Dashboard available-stock table'
type: 'feature'
created: '2026-10-02'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-stock-purchase-tracker.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-4-dashboard.md'
---

## Intent

Replace the dashboard's expense-ledger presentation with an available-stock table so users can see current inventory and manage each stock item directly from the dashboard.

The table columns are exactly: **Stock Name**, **Stocks**, **Sold**, **Updated Price**, and **Edit**. Each row includes accessible edit and delete icon actions. Editing opens the existing stock modal with that row's product selected; deleting reuses the existing archive flow.

## Decisions

- **Dashboard scope:** Change only the dashboard presentation. The dedicated Stocks view remains available and keeps its existing replenishment workflow.
- **Stocks:** Use the active product's current non-negative `stockQuantity`.
- **Sold:** Sum non-deleted stock-purchase quantities for the same product ID. Products with no purchases show `0`.
- **Updated Price:** Display the product's current unit `price`, formatted as currency. There is no separate price-history field in the model.
- **Edit:** Invoke the existing `editStock(product)` callback and modal, preserving current validation and optimistic-update behavior.
- **Delete:** Invoke the existing `archive(product)` flow. This removes the product from active stock while preserving referenced history according to the approved soft-delete policy; it is not permanent deletion.
- **Data access:** Reuse the existing authenticated `/api/stock` and `/api/stock/purchases` endpoints. Do not accept client-supplied ownership identifiers and do not add a schema migration.

## Boundaries and constraints

**Always:** Keep tenant scoping enforced by the server; preserve accessible loading, empty, and error states; provide icon buttons with visible tooltips or titles and accessible labels; keep row actions keyboard usable; refresh table data after stock edits, archive operations, and purchases; preserve dark-mode styling; ensure narrow layouts remain readable without forcing the whole workspace to overflow horizontally.

**Never:** Reintroduce the expense mutation form or expense list into the dashboard section; hard-delete stock through this table; change purchase transaction semantics; expose another user's purchase totals; add a second edit implementation.

## Code Map

- `FrontEnd/src/App.tsx` — replace the dashboard-only expense ledger section with the table integration; pass existing edit/archive callbacks and refresh state.
- `FrontEnd/src/pages/DashboardStockTable.tsx` — new presentation/data-loading component, or equivalent dashboard stock component, that loads active stock and purchase history and aggregates sold quantities by product ID.
- `FrontEnd/src/App.module.css` — add semantic table/card styles, icon-action styles, loading/error/empty states, dark-mode rules, and responsive behavior.
- `FrontEnd/DASHBOARD-MANUAL-CHECKS.md` — replace dashboard ledger checks with available-stock table checks while retaining expense verification through the appropriate expense workflow coverage.
- `server/modules/stock/*` — read-only inspection only unless implementation reveals the current response contracts cannot support the aggregation.

## Acceptance criteria

- Given authenticated active products, when the dashboard loads, then it shows a table with the headers `Stock Name`, `Stocks`, `Sold`, `Updated Price`, and `Edit`.
- Given purchase history for a product, when the table renders, then `Sold` equals the sum of that product's non-deleted purchase quantities; products without history show zero.
- Given an active product, when the user activates its edit icon, then the existing edit-stock modal opens with that exact product's name, category, and current price selected.
- Given an active product, when the user activates its delete icon and confirms, then the existing archive request runs and the product disappears from the table after refresh; historical records remain governed by the existing retention policy.
- Given loading, empty, or failed stock/history requests, when the dashboard renders, then it shows an appropriate status, explanatory empty state, or retryable accessible error without crashing the dashboard charts.
- Given a narrow viewport or dark mode, when the table is viewed, then headers and values remain readable, actions remain reachable, and focus indicators remain visible.
- Given a purchase or stock edit elsewhere in the workspace, when the dashboard refreshes, then stock, sold count, and price reflect the latest server data without duplicate rows.

## Verification

- Run frontend TypeScript diagnostics.
- Run the frontend production build.
- Run relevant stock/dashboard tests if the implementation changes server code.
- Run `git diff --check`.
- Perform manual dashboard checks for table headers, sold aggregation, edit selection, delete/archive confirmation, empty/error states, dark mode, and mobile widths.
