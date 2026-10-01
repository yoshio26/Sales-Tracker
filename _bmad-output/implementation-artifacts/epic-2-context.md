# Epic 2 Context: Product catalog

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Implement the user-owned product catalog that enables users to create, edit, and archive products. This epic establishes the reference data for expense recording and maintains historical product context through snapshots so past expense reports remain accurate when products are edited or archived.

## Stories

- Story 2.1: Create product schema and ownership constraints
- Story 2.2: Add product list and create/edit forms
- Story 2.3: Archive products without deleting historical references

## Requirements & Constraints

- Create a `products` table owned by user with `id`, `user_id`, `name`, `category`, `active`, `archived_at`, and timestamp fields.
- Enforce `UNIQUE (user_id, name)` within each user's catalog after product-name normalization.
- Index products for active catalog selection `(user_id, active)`, category filtering `(user_id, category)`, and optimistic-concurrency reads `(user_id, updated_at)`.
- Create, list, update, and archive operations must validate and enforce server-derived `userId`; client-provided ownership fields are ignored.
- Use optimistic concurrency control: product updates and archival require the client's last-seen `updated_at` and return a conflict when it no longer matches.
- Archival sets `active = false` and `archived_at` to a UTC timestamp; archived products are never hard-deleted, remain valid references for existing expenses, and cannot be selected for new expenses or expense product changes.
- Validate all untrusted product input and request parameters with Zod before processing.
- API responses must include `updated_at` to enable subsequent optimistic-concurrency checks.

## Technical Decisions

- Products are a feature module within the modular monolith with dedicated routes, services, and data-access layers. Routes handle HTTP and Zod validation, services own business rules, and data-access code owns Prisma queries; routes and services never import Prisma directly.
- Soft archival uses `active` and `archived_at`; no product is hard-deleted.
- Product queries must use server-derived `userId` as a tenant predicate; catalog indexes begin with `user_id`.
- Product ownership is enforced in service and data-access layers. Mutations use transactions to preserve ownership, active-state, and concurrency preconditions.
- Product names are normalized before persistence and comparison using the shared authentication normalization policy.
- Use the established error envelope without leaking product existence or lists to unauthenticated users.

## UX & Interaction Patterns

- The Products screen presents a searchable active-product list with creation, editing, and archival actions.
- Add/edit forms use labelled name and category fields, keyboard navigation, focus management, and inline validation that preserves input.
- Archival requires confirmation. Archived products remain visually distinct and unavailable for new expense selection.
- Provide loading, empty, server-error/retry, and field-validation states.

## Cross-Story Dependencies

- Product operations depend on Epic 1 server-derived session identity.
- Story 2.1 precedes Story 2.2 and Story 2.3.
- Epic 3 depends on product schema, category, and active/archived-state checks. Epic 4 groups expenses by category snapshots derived from products.
