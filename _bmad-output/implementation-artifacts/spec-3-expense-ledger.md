---
title: 'Epic 3: Expense ledger'
type: 'feature'
created: '2026-10-01'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: 'be4840bac627166b1944aefd8df3abb3406c37f7'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Sales-Tracker-2026-09-30/DATA-MODEL.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Sales-Tracker-2026-09-30/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-Sales-Tracker-2026-09-30/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users can manage catalog products but cannot record the purchases that form their spending history.

**Approach:** Deliver a user-owned expense ledger across Prisma/PostgreSQL, protected Express endpoints, and the signed-in React workspace. Expenses store server-generated product and category snapshots, support correction, and use soft deletion so historical references remain stable.

## Boundaries & Constraints

**Always:** Derive ownership from the authenticated session; validate all untrusted input with Zod; store money as positive integer cents while exposing validated decimal-string amounts at the API boundary; require positive integer quantity; snapshot the selected active product on the server inside the write transaction; use UTC ISO timestamps and half-open date ranges; require current `updatedAt` for edits; exclude soft-deleted rows from normal lists; preserve snapshots when only expense fields change; re-snapshot when product changes; protect every mutation with the existing same-Origin guard.

**Never:** Accept client ownership or snapshot values; select archived products for new or changed expenses; hard-delete or restore expenses; edit a deleted expense; alter authentication or product behavior; add dashboard aggregates or begin Epic 4.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Create | Authenticated user submits active product, positive amount, quantity, date, optional note | Transaction creates an owned expense with current product/category snapshots and server timestamps | Invalid DTO returns `400`; unknown, foreign, or archived product returns `404`/conflict without a row |
| Edit | Owned non-deleted expense with current `updatedAt` | Amount, quantity, note, and date update; snapshots stay unchanged unless product changes | Stale timestamp returns `409`; unknown/foreign/deleted target returns `404` |
| Product change | Owned non-deleted expense selects another active owned product | Product reference and both snapshots update atomically | Archived, foreign, or unknown product does not overwrite the expense |
| Delete/list | Owned expense is deleted or list is requested | Delete sets `deletedAt`; repeated delete is idempotent; normal list excludes deleted rows | Unauthenticated or foreign access returns existing `401`/`404` envelope |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- add `Expense`, relations, snapshot fields, positive-value constraints, soft-delete field, and ledger indexes.
- `prisma/migrations/` -- add the Prisma migration for the expense table and ownership/product foreign keys without modifying prior migrations.
- `server/modules/products/data-access.ts` and `server/modules/products/service.ts` -- reuse database typing, transaction patterns, normalized response mapping, and server-owned product checks.
- `server/modules/products/routes.ts` and `server/app.ts` -- mirror Zod DTO validation, session/origin middleware, error envelopes, and router mounting.
- `server/infrastructure/prisma.ts` and `server/middleware/session.ts` -- reuse the Prisma singleton and server-derived `req.userId`.
- `client/src/App.tsx` and `client/src/App.module.css` -- extend the authenticated workspace with expense form/list state using existing request, loading, error, and conflict patterns.
- `DATA-MODEL.md`, `ARCHITECTURE-SPINE.md`, and `EXPERIENCE.md` in the Epic 3 context -- authoritative snapshot, transaction, lifecycle, and UX rules; do not add dashboard behavior.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma`; `prisma/migrations/20261001000000_expense_ledger/migration.sql` -- add the expense model/table, snapshot columns, positive amount/quantity checks, soft-delete state, ownership/product foreign keys, and required indexes.
- [x] `server/modules/expenses/data-access.ts`; `server/modules/expenses/service.ts` -- implement transactional create, list, get, optimistic update, product-change re-snapshot, and idempotent soft-delete operations with tenant predicates.
- [x] `server/modules/expenses/routes.ts`; `server/app.ts` -- expose protected `GET /api/expenses`, `GET /api/expenses/:id`, `POST`, `PUT`, and soft-delete `DELETE`; validate DTOs and apply same-Origin protection to mutations.
- [x] `server/modules/expenses/service.test.ts`; `server/modules/expenses/routes.test.ts` -- cover snapshots, active-product enforcement, tenant isolation, validation, stale updates, product changes, soft deletion, and idempotent deletion.
- [x] `client/src/App.tsx`; `client/src/App.module.css` -- add accessible expense create/edit/list UI with active-product selection, amount/quantity/note/date fields, filters, loading/empty/error states, conflict recovery, and delete confirmation.

**Acceptance Criteria:**
- Given two authenticated users, when either lists, reads, creates, edits, or deletes expenses, then every operation is restricted to the session user's `userId` and foreign IDs reveal no data.
- Given an active product, when a valid expense is created, then the server stores immutable name/category snapshots from that product and never accepts client-supplied snapshots.
- Given a product edit or archive after an expense exists, when the expense is read or listed, then its snapshots remain unchanged.
- Given a current expense response, when its `updatedAt` is supplied to an edit, then the mutation succeeds; when stale, then it returns `409` without overwriting newer data.
- Given a deleted expense, when it is listed or edited, then it is excluded and cannot be restored or changed; repeated deletion is harmless.
- Given a signed-in user, when they create, edit, filter, or confirm deletion in the UI, then feedback is accessible, invalid input is preserved, and the list reflects the server response.

## Implementation Notes

Use integer cents internally and decimal strings only at the JSON boundary. Product ownership, active state, and snapshot reads must occur inside the same transaction as expense writes. Normal list queries filter `deletedAt IS NULL`; archived products remain valid historical references but are unavailable for new or changed expense selections.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Evidence / resolution |
|---|---|---|
| Database integer overflow could surface as a server error | Fixed | Route and service validation cap amount cents and quantity at PostgreSQL `INT` max; typecheck and tests pass. |
| Archived historical products were unavailable in expense editing/filtering | Fixed | Archived products load alongside active products; historical edit options and archived filter options are rendered without allowing archived selection for new product changes. |
| Unknown/foreign delete targets should be distinguishable from repeated deletion | Fixed | Data access returns `not-found` versus `already-deleted`; route returns `404` for unknown/foreign IDs and `204` for repeated deletion. |
| Missing live database persistence coverage | Deferred | Existing Epic 2 convention defers real PostgreSQL integration coverage to Epic 5; Prisma migration deploy and client generation were verified locally. |
| Missing browser-level expense flow coverage | Deferred | No client test harness exists; full UI flow coverage is deferred to Epic 5 E2E coverage. |
| Date filter ordering and field feedback | Fixed | Client rejects `from > to`; existing expense error is announced and amount/quantity controls are associated with field feedback. |

## Design Notes

The expense module is layered like Products. A product change on an expense is one atomic operation that validates the replacement product and rewrites both snapshots; all other edits leave historical product context untouched. Soft deletion updates `deletedAt` rather than removing the row, allowing future reporting and audit behavior to preserve the original ledger record.

## Verification

**Commands:**
- `npm run db:generate` -- expected: Prisma Client generation succeeds.
- `npm run db:migrate` -- expected: the expense migration applies cleanly.
- `npm run typecheck` -- expected: server and client TypeScript checks pass.
- `npm test` -- expected: existing tests plus Expenses module tests pass.
- `npm run build` -- expected: production client and server build succeeds.
