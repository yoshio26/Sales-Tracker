---
name: Sales Tracker engineering implementation view
status: draft
created: 2026-09-30
updated: 2026-09-30
source: ARCHITECTURE-SPINE.md
---

# Engineering Implementation View

## Repository shape

- `client/`: Vite React TSX application and CSS Modules.
- `server/modules/auth`: email codes, allowlist, sessions.
- `server/modules/products`: catalog and archive operations.
- `server/modules/expenses`: ledger operations and snapshotting.
- `server/modules/dashboard`: read-only aggregate queries.
- `server/infrastructure`: Prisma, SMTP, configuration.
- `prisma/`: schema, migrations, and deterministic seed.

## Dependency rule

Routes depend on services; services depend on module data-access interfaces; data access depends on Prisma/infrastructure. Routes and services do not import Prisma. Dashboard is read-only and cannot mutate ledger data.

## Core transaction boundaries

- Login verification, user creation, and session creation: one transaction.
- Expense create/update/delete and snapshot reads: one transaction.
- Product archive: ownership and optimistic concurrency check in one transaction.

## Data model

`users`, `allowed_emails`, `login_codes`, `sessions`, `products`, and `expenses`. Expenses retain product/category snapshots and `deleted_at`; products use `active` archival.

## API contract rules

Use Zod request schemas, server-derived `userId`, decimal strings for money, UTC ISO timestamps, consistent error envelopes, and `updated_at` preconditions for mutable records.

## Capstone outputs

- ERD: derived from the Prisma schema and structural seed.
- Use cases: derived from Auth, Products, Expenses, and Dashboard flows.
- System architecture chapter: derived from the paradigm, dependency diagram, deployment view, and security invariants.
- Week-by-week plan: derived from the sprint status sequence below.
