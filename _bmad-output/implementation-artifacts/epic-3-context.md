## Epic 3 Context

### Overview
This Epic adds the expense ledger so authenticated users can record and review spending tied to catalog products. The feature covers the data model, backend API, and signed-in client workflow needed to create and manage purchase records without exposing other users’ information.

### Problem
The application can manage product catalogs, but it cannot persist or review the purchases behind those products. There is no user-owned spending history, no timestamped purchase records, and no way to reconcile purchases with catalog activity.

### Goal
Deliver a complete expense ledger with:
- create, read, list, update, and delete operations
- user-scoped access control
- server-side product snapshotting
- immutable historical references for products that are later edited or archived
- optimistic concurrency for edits
- soft-deletion semantics for retained history

### Scope
This Epic includes:
- the Prisma schema and migration for Expense records
- transactional server-side data access
- service-layer validation and business rules
- protected Express routes for expense operations
- client-side UI to record, filter, edit, and delete expenses

### Functional behavior
- A signed-in user can create an expense using an active product, positive amount, positive quantity, purchase date, and optional note.
- The server captures product name and category at creation time and stores them as immutable snapshots.
- If the underlying product is later edited or archived, the stored expense preserves its historical snapshot value.
- A user can edit only their own non-deleted expenses with a current updatedAt value.
- Editing an expense with a stale updatedAt returns a conflict instead of overwriting newer data.
- Expenses are soft-deleted and excluded from normal list queries.
- Repeated delete requests are harmless and do not expose data to other users.

### Constraints
- Ownership is always derived from the authenticated session.
- Client-supplied snapshot values are never trusted.
- Archived products are not valid selections for new or changed expenses.
- Money is stored internally as integer cents; API values use validated decimal strings.
- Product snapshots and ownership checks happen inside the same transaction as the expense write.
- No dashboard aggregate behavior is added in this Epic.

### Implementation pattern
The expense feature follows the same shape as the product module:
- Prisma schema and migration define the database contract
- data-access layer handles tenant-scoped queries and writes
- service layer applies validation and transactional rules
- route layer enforces session + same-origin protection
- client workspace integrates the expense form, list, filters, and actions

### Relevant implementation files
- [prisma/schema.prisma](prisma/schema.prisma)
- [server/modules/expenses/data-access.ts](server/modules/expenses/data-access.ts)
- [server/modules/expenses/service.ts](server/modules/expenses/service.ts)
- [server/modules/expenses/routes.ts](server/modules/expenses/routes.ts)
- [client/src/App.tsx](client/src/App.tsx)
- [client/src/App.module.css](client/src/App.module.css)
- [_bmad-output/implementation-artifacts/spec-3-expense-ledger.md](_bmad-output/implementation-artifacts/spec-3-expense-ledger.md)

### Status
The approved Epic 3 work is complete and marked done in the spec. Review findings were fixed where they materially affected correctness, and deferred coverage for live database/browser integration remains scheduled for later Epic 5 work.
