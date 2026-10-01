---
title: 'Epic 2: Product catalog'
type: 'feature'
created: '2026-09-30'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '59b194b4b726a5808a88ae91971ea7c9cd588563'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Signed-in users have no user-owned product catalog, so they cannot establish the reusable product and category data required by the future expense ledger.

**Approach:** Deliver the complete Product Catalog across Prisma/PostgreSQL, protected Express endpoints, and the signed-in React workspace. Users can search, create, edit, and archive products while all mutable operations protect ownership and detect stale changes.

## Boundaries & Constraints

**Always:** Derive ownership solely from the authenticated server session; normalize names with trim plus lowercase comparison/persistence; validate all client input with Zod; use ISO-8601 UTC `updated_at` values for optimistic concurrency; protect every mutation with the existing same-Origin guard; retain archived rows indefinitely and return the established error envelope.

**Never:** Do not accept a client `userId`, hard-delete or reactivate products, add expenses/dashboard behavior, alter login/session behavior, introduce a second frontend/API origin, or start Epic 3.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Create/list | Authenticated user submits valid name/category | Create an active owned product; list returns that user’s active products with ISO UTC timestamps | Duplicate normalized name returns `409`; malformed input returns `400` |
| Update | Owned active product with current `updatedAt` | Name/category update and a new `updatedAt` are returned | A stale value returns `409`; unknown/cross-user ID returns `404` |
| Archive | Owned active product with current `updatedAt` | Set inactive with UTC `archivedAt`; it remains visible as archived and excluded from default active results | Stale, unknown, or already archived target does not change data and returns an appropriate conflict/not-found response |
| Unauthenticated/foreign origin | Missing valid session or mutation Origin differs from `APP_ORIGIN` | No catalog data is exposed or mutated | Return existing `401` or `403` envelope |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` -- current auth models; add `Product` and the `User.products` relation using existing UUID/timestamp/mapping conventions.
- `prisma/migrations/20260930000000_foundation_auth/migration.sql` -- example PostgreSQL migration constraints and index style; do not modify it.
- `server/modules/auth/data-access.ts` -- reference layered database helper and transaction types; do not couple Products to Auth persistence.
- `server/middleware/session.ts` and `server/middleware/origin.ts` -- reuse `requireSession`, server-derived `req.userId`, and `requireSameOrigin`.
- `server/app.ts` -- mount the Products router while preserving Auth and global middleware order.
- `client/src/App.tsx` and `client/src/App.module.css` -- signed-in shell and client request convention; extend only the authenticated workspace.
- `server/modules/auth/service.test.ts`, `server/middleware/origin.test.ts` -- Vitest style and security assertions to mirror.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma`; `prisma/migrations/20260930000001_product_catalog/migration.sql` -- add the user-owned product model/table, check constraint, uniqueness, foreign key, and required indexes through Prisma Migrate conventions.
- [x] `server/modules/products/data-access.ts`; `server/modules/products/service.ts` -- implement user-scoped create/list/update/archive operations, normalized-name uniqueness, atomic optimistic updates, and typed outcomes without importing Prisma outside data access.
- [x] `server/modules/products/routes.ts`; `server/app.ts` -- expose protected `GET`/`POST /api/products`, `PUT /api/products/:id`, and archive `DELETE /api/products/:id`; validate request DTOs and apply Origin protection to mutations.
- [x] `server/modules/products/service.test.ts`; `server/modules/products/routes.test.ts` -- cover normalization, tenant isolation, archive state, stale-update conflicts, invalid DTOs, unauthenticated access, and foreign-Origin mutations.
- [x] `client/src/App.tsx`; `client/src/App.module.css` -- replace the signed-in placeholder with an accessible searchable product list, add/edit form, loading/empty/error states, archived-state indicator, inline validation, conflict recovery, and archive confirmation.

**Acceptance Criteria:**
- Given two authenticated users, when either lists or mutates products, then every read and write is restricted to their own `userId` and a guessed foreign ID reveals no product data.
- Given equivalent names differing only by whitespace or case, when a user creates or renames a product, then only one normalized catalog entry is permitted.
- Given a current product response, when its `updatedAt` is supplied to an edit or archive, then the operation succeeds and returns a newer server timestamp; when it is stale, then the request returns `409` without overwriting newer data.
- Given an archived product, when the catalog is rendered, then it is visibly archived, remains searchable in the archived view, and is omitted from the default active list.
- Given a signed-in user, when they create, edit, search, or confirm archive in the UI, then feedback is accessible, input is preserved after validation/server errors, and the list reflects the server response.

## Implementation Notes

- Product list behavior is an implementation decision: fetch all owned catalog rows with an active/archived filter, render active items by default, and provide an archived view so the mandated archived-state indicator is meaningful.
- Full `PUT` DTOs (`name`, `category`, `updatedAt`) and `DELETE` archive requests with `updatedAt` make the concurrency precondition explicit.

## Spec Change Log

## Review Triage Log

## Design Notes

Use a single Products feature module behind the existing session and Origin middleware. The client keeps the existing lightweight state-driven composition rather than adding a router dependency: authenticated view → product list/form → server refresh after successful mutation. Products persist normalized display strings, so case-insensitive uniqueness is deterministic and no hidden comparison column is required.

## Verification

**Commands:**
- `npm run db:generate` -- expected: Prisma client generation succeeds after the schema change.
- `npm run db:migrate` -- expected: the product migration applies cleanly to local PostgreSQL.
- `npm run typecheck` -- expected: server and client TypeScript checks pass.
- `npm test` -- expected: existing Epic 1 tests plus Products module tests pass.
- `npm run build` -- expected: production client and server build succeeds.
