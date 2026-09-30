---
name: Sales Tracker PRD
version: 1.0
status: draft
created: 2026-09-30
updated: 2026-09-30
---

# Sales Tracker — Product Requirements

## Product goal

A personal spending tracker where allowlisted users maintain a product catalog, record purchase expenses, and understand spending through a dashboard.

## Scope

### Must have

- Passwordless allowlisted email login.
- User-owned product catalog with add, edit, and archive.
- Expense ledger with amount, quantity, note, date, and product.
- Expense editing and soft deletion.
- Dashboard totals for this month and all time.
- Spending by historical product and category snapshots.
- Spending over time.
- Per-user data isolation.

### Out of scope

Sales workflows, inventory, roles, supplier management, purchase orders, refunds, forecasting, PDF reports, and multi-tenant administration.

## Users

All users have the same permissions. Only emails in the allowlist can receive login codes. Each user can access only their own products, expenses, and dashboard results.

## Functional requirements

- **FR-1 Authentication:** Request and verify a six-digit email code.
- **FR-2 Authentication security:** Codes are hashed, single-use, expire after ten minutes, lock after five failed attempts, and are rate-limited.
- **FR-3 Privacy:** Approved and unapproved email requests receive the same generic response; unapproved requests send no email.
- **FR-4 Sessions:** Successful verification creates a seven-day PostgreSQL-backed session and an opaque HTTP-only cookie.
- **FR-5 Products:** Create, update, list, and archive products owned by the current user.
- **FR-6 Expenses:** Create expenses using the selected active product and server-generated historical snapshots.
- **FR-7 Corrections:** Edit amount, quantity, note, date, or product; re-snapshot only when product changes.
- **FR-8 Deletion:** Soft-delete expenses and exclude them from all dashboard and list queries.
- **FR-9 Dashboard:** Provide totals, time series, product breakdown, and category breakdown from non-deleted expenses.
- **FR-10 Validation:** Validate all untrusted input with Zod and enforce ownership in server services.

## Non-functional requirements

- One deployable modular monolith.
- React/Vite client and Express API share one origin in production.
- PostgreSQL is the system of record.
- Monetary values use fixed decimal database types and decimal strings over JSON.
- Timestamps use UTC ISO 8601 values.
- State-changing requests use session and origin protections.

## Acceptance summary

A user can request a code, authenticate only when allowlisted, create products, record and correct expenses, archive products without rewriting history, and see dashboard totals that match the non-deleted expense ledger.

## Traceability

Architecture constraints are defined by `ARCHITECTURE-SPINE.md`; implementation sequencing is defined by `ENGINEERING-IMPLEMENTATION-VIEW.md` and `sprint-status.yaml`.
