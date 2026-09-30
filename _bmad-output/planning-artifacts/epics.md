# Sales Tracker — Epics and Stories

## Epic 1 — Foundation and authentication

- Set up Vite React TSX, Express, TypeScript, Prisma, PostgreSQL, and environment configuration.
- Create schema and migrations for users, allowlist, login codes, and sessions.
- Implement rate-limited generic code request flow.
- Implement hashed, expiring, single-use code verification and logout.

## Epic 2 — Product catalog

- Create product schema and ownership constraints.
- Add product list and create/edit forms.
- Archive products without deleting historical references.

## Epic 3 — Expense ledger

- Create expense schema with snapshot fields and soft deletion.
- Record validated expenses in a transaction.
- Edit expenses with product-change re-snapshot behavior.
- Soft-delete expenses and exclude them from lists and aggregates.

## Epic 4 — Dashboard

- Implement month/all-time totals.
- Implement time-series, product, and category aggregates.
- Add loading, empty, error, and responsive chart states.

## Epic 5 — Verification and capstone documentation

- Add unit, integration, security, and end-to-end tests.
- Run ownership and anti-enumeration checks.
- Generate ERD, use-case documentation, system architecture chapter, and final implementation guide.
