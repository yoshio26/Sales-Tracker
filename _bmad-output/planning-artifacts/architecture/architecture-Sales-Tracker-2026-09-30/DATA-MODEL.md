---
name: Sales Tracker data model
type: data-model
status: planned
created: '2026-09-30'
updated: '2026-09-30'
source: ARCHITECTURE-SPINE.md, ENGINEERING-IMPLEMENTATION-VIEW.md, spec-foundation-passwordless-auth.md
note: This is the planned model until prisma/schema.prisma becomes the implementation source of truth.
---

# Data Model — Sales Tracker

This document describes the relational model for the modular monolith. All database identifiers below are planned Prisma `String @db.Uuid` values unless the implementation schema selects an equivalent generated UUID type. Database names use `snake_case`; Prisma field names use `camelCase` with explicit mappings where needed.

## Tables

### `users`

Authenticated application users. A user is created or found during successful login-code verification.

| Column | Type | Null | Default | Keys / constraints | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | generated | PK | User identity used for server-derived tenant scoping. |
| `email` | `varchar(320)` | no | — | UNIQUE | Normalized email address; comparison and persistence are case-insensitive by application policy. |
| `created_at` | `timestamptz` | no | `now()` | — | Creation time in UTC. |
| `updated_at` | `timestamptz` | no | `now()` | — | Last user-row update time in UTC. |

**Indexes:** the unique index backing `email`; the primary-key index on `id`.

### `allowed_emails`

The passwordless-login allowlist. It intentionally has no user foreign key: an approved address may exist before its first successful login.

| Column | Type | Null | Default | Keys / constraints | Description |
| --- | --- | --- | --- | --- | --- |
| `email` | `varchar(320)` | no | — | PK | Normalized allowlisted email address. |
| `created_at` | `timestamptz` | no | `now()` | — | When the address was allowlisted. |

**Indexes:** the primary-key index on `email`. No raw login code or secret is stored here.

### `login_codes`

Short-lived, single-use verification challenges. The code itself is never persisted.

| Column | Type | Null | Default | Keys / constraints | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | generated | PK | Challenge identity. |
| `email` | `varchar(320)` | no | — | — | Normalized email to which the challenge was issued. |
| `code_hash` | `varchar(255)` | no | — | — | One-way hash of the six-digit code. |
| `expires_at` | `timestamptz` | no | — | CHECK `expires_at > created_at` | Ten-minute validity boundary. |
| `attempts` | `integer` | no | `0` | CHECK `attempts >= 0` and `attempts <= 5` | Failed verification attempts. Five attempts locks the challenge for its remaining validity. |
| `used_at` | `timestamptz` | yes | `NULL` | — | Set once when verification succeeds. |
| `created_at` | `timestamptz` | no | `now()` | — | Challenge creation time in UTC. |

**Indexes:** `(email, created_at)` for the per-email request limit; `(email, expires_at)` for active-challenge lookup and cleanup. The implementation may add an index on `(email, used_at)` if its active-code query benefits from it.

### `sessions`

Server-side sessions represented in the browser only by an opaque token.

| Column | Type | Null | Default | Keys / constraints | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | generated | PK | Session identity. |
| `user_id` | `uuid` | no | — | FK → `users.id` | Server-derived authenticated user. |
| `token_hash` | `varchar(255)` | no | — | UNIQUE | Hash of the random 32-byte session token; the raw token is never stored. |
| `expires_at` | `timestamptz` | no | — | CHECK `expires_at > created_at` | Seven-day expiry boundary. |
| `created_at` | `timestamptz` | no | `now()` | — | Session creation time in UTC. |

**Indexes:** the unique index backing `token_hash`; `(user_id, expires_at)` for ownership and expiry checks; `(expires_at)` for cleanup.

### `products`

User-owned catalog entries. Archiving is represented by `active = false` and `archived_at`, never by hard deletion.

| Column | Type | Null | Default | Keys / constraints | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | generated | PK | Product identity. |
| `user_id` | `uuid` | no | — | FK → `users.id` | Owning user; never accepted from the client as authority. |
| `name` | `varchar(200)` | no | — | — | User-visible product name. |
| `category` | `varchar(120)` | no | — | — | Product category used for future expense snapshots. |
| `active` | `boolean` | no | `true` | — | Selectability flag; archived products are false. |
| `archived_at` | `timestamptz` | yes | `NULL` | CHECK `(active = true AND archived_at IS NULL) OR (active = false AND archived_at IS NOT NULL)` | Archive timestamp in UTC. |
| `created_at` | `timestamptz` | no | `now()` | — | Creation time in UTC. |
| `updated_at` | `timestamptz` | no | `now()` | — | Last mutable update time in UTC. |

**Unique constraints:** planned `UNIQUE (user_id, name)` to prevent duplicate names within one user's catalog. Names are compared after the product-name normalization policy is applied.

**Indexes:** `(user_id, active)` for active catalog selection; `(user_id, category)` for catalog filtering; `(user_id, updated_at)` for optimistic-concurrency reads. The primary key and `(user_id, name)` unique constraint also provide indexes.

### `expenses`

The authoritative spending ledger. A deleted expense remains physically present so historical references and audit-oriented behavior are preserved.

| Column | Type | Null | Default | Keys / constraints | Description |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | no | generated | PK | Expense identity. |
| `user_id` | `uuid` | no | — | FK → `users.id` | Owning user and mandatory tenant predicate. |
| `product_id` | `uuid` | no | — | FK → `products.id` plus ownership check | Product referenced when the expense was recorded; archived products remain valid historical references. |
| `product_name_snapshot` | `varchar(200)` | no | — | — | Server-read product name at write time. Immutable after the writing transaction. |
| `category_snapshot` | `varchar(120)` | no | — | — | Server-read product category at write time. Immutable after the writing transaction. |
| `amount_cents` | `integer` | no | — | CHECK `amount_cents > 0` | Amount actually paid, represented as integer cents. |
| `quantity` | `integer` | no | `1` | CHECK `quantity > 0` | Positive quantity purchased. |
| `note` | `text` | yes | `NULL` | — | Optional user note. |
| `spent_at` | `timestamptz` | no | — | — | Time of the expense in UTC. |
| `deleted_at` | `timestamptz` | yes | `NULL` | — | Soft-delete marker; non-null expenses are excluded from normal lists and aggregates. |
| `created_at` | `timestamptz` | no | `now()` | — | Creation time in UTC. |
| `updated_at` | `timestamptz` | no | `now()` | — | Last mutable update time in UTC. |

**Foreign-key ownership rule:** the preferred schema uses a composite foreign key `(product_id, user_id)` → `products(id, user_id)` so a product from another tenant cannot be attached accidentally. This requires a matching unique constraint such as `UNIQUE (id, user_id)` on `products` in addition to its primary key. The service must still apply explicit `user_id` predicates and active-product checks.

**Indexes:** `(user_id, deleted_at, spent_at)` for ledger and dashboard ranges; `(user_id, product_id, deleted_at)` for product aggregates; `(user_id, category_snapshot, deleted_at)` for category aggregates; `(user_id, deleted_at, updated_at)` for mutable ledger reads. The primary key and ownership foreign-key indexes are also required.

## Data rules

- **Money:** persist monetary values as integer cents in `expenses.amount_cents`; never use floating point. API DTOs may expose decimal strings, but conversion is validated at the boundary and storage remains integer cents.
- **Ownership:** every Products, Expenses, and Dashboard operation receives `userId` from the authenticated session. Client-supplied ownership fields are ignored.
- **Expense snapshots:** the server reads the user-owned active product inside the expense transaction and writes both snapshot columns. Clients cannot provide or overwrite snapshot values. A product change is allowed only to another active product and re-snapshots both values.
- **Expense soft delete:** deleting an expense is an `UPDATE` that sets `deleted_at`; a deleted expense cannot be edited or restored. Normal queries include `deleted_at IS NULL`.
- **Product archive:** products are never hard-deleted. Archival sets `active = false` and `archived_at`; archived products remain valid references for existing expenses but cannot be selected for new expenses or product changes.
- **Authentication secrets:** login codes and session tokens are generated randomly, but only `code_hash` and `token_hash` are stored. No raw code, raw token, secret, real email, or connection string belongs in this artifact or in source control.
- **Time:** timestamps are stored in UTC and reporting ranges use half-open intervals `[start, end)`.
- **Constraints:** email values are normalized before lookup and persistence; challenge attempts, positive amounts, positive quantities, and active/archive state are database-validated as well as service-validated.

## Database operations by module

All rows below are scoped by the server-derived `userId` where a user-owned table is involved. `DELETE` is reserved for session logout; expense deletion is deliberately an `UPDATE` soft delete.

### Auth

| Operation | SQL kind | Table(s) | `userId` scoping rule |
| --- | --- | --- | --- |
| Check allowlist for normalized email | SELECT | `allowed_emails` | No `userId`; scope by normalized email only, with a generic response. |
| Count recent email requests | SELECT | `login_codes` | No `userId`; scope by normalized email and request window. |
| Create login challenge | INSERT | `login_codes` | No `userId` yet; email is normalized and allowlist membership is not disclosed. |
| Find active verification challenge | SELECT | `login_codes` | No `userId`; scope by normalized email, validity, unused state, and lock state. |
| Consume challenge / increment attempts | UPDATE | `login_codes` | No `userId`; lock the selected challenge row and apply a conditional state transition. |
| Find user by normalized email | SELECT | `users` | No `userId` yet; scope by unique normalized email. |
| Create first-time user | INSERT | `users` | No pre-existing `userId`; email comes from the verified challenge, never the client claim. |
| Create session | INSERT | `sessions` | Uses the newly found/created server-side user ID. |
| Resolve session cookie | SELECT | `sessions`, `users` | Scope by hash of the presented opaque token and `expires_at > now()`; return only that session's `user_id`. |
| Logout | DELETE | `sessions` | Delete only the row matched by the hash of the presented token; repeated logout is safe. |

### Products

| Operation | SQL kind | Table(s) | `userId` scoping rule |
| --- | --- | --- | --- |
| List products | SELECT | `products` | `WHERE user_id = :userId`; normally filter `active = true` unless the archived view is explicitly requested. |
| Get product | SELECT | `products` | `WHERE id = :productId AND user_id = :userId`. |
| Create product | INSERT | `products` | Insert `user_id = :userId` from the session; never accept a client ownership field. |
| Edit product | UPDATE | `products` | `WHERE id = :productId AND user_id = :userId AND updated_at = :lastSeenUpdatedAt`. |
| Archive product | UPDATE | `products` | Set `active = false, archived_at = ...` with `WHERE id = :productId AND user_id = :userId AND updated_at = :lastSeenUpdatedAt`. |

### Expenses

| Operation | SQL kind | Table(s) | `userId` scoping rule |
| --- | --- | --- | --- |
| List expenses | SELECT | `expenses` | `WHERE user_id = :userId AND deleted_at IS NULL`, with validated date/pagination filters. |
| Get expense | SELECT | `expenses` | `WHERE id = :expenseId AND user_id = :userId AND deleted_at IS NULL`. |
| Read active product for snapshot | SELECT | `products` | `WHERE id = :productId AND user_id = :userId AND active = true`; performed inside the write transaction. |
| Create expense with snapshots | INSERT | `expenses` (and SELECT `products`) | Insert `user_id = :userId`; product ownership and active state are checked server-side. |
| Edit expense without product change | UPDATE | `expenses` | `WHERE id = :expenseId AND user_id = :userId AND deleted_at IS NULL AND updated_at = :lastSeenUpdatedAt`; snapshot columns remain unchanged. |
| Edit expense with product change | UPDATE | `expenses` (and SELECT `products`) | Both expense and replacement product use `:userId`; replacement must be active and owned by that user. |
| Soft-delete expense | UPDATE | `expenses` | Set `deleted_at` with `WHERE id = :expenseId AND user_id = :userId AND deleted_at IS NULL`; repeated deletion is an idempotent no-op. |

### Dashboard

| Operation | SQL kind | Table(s) | `userId` scoping rule |
| --- | --- | --- | --- |
| Current-month total | SELECT | `expenses` | `WHERE user_id = :userId AND deleted_at IS NULL` plus the UTC month range. |
| All-time total | SELECT | `expenses` | `WHERE user_id = :userId AND deleted_at IS NULL`. |
| Spending by product | SELECT | `expenses` | `WHERE user_id = :userId AND deleted_at IS NULL`; group by `product_name_snapshot`. |
| Spending by category | SELECT | `expenses` | `WHERE user_id = :userId AND deleted_at IS NULL`; group by `category_snapshot`. |
| Spending over time | SELECT | `expenses` | `WHERE user_id = :userId AND deleted_at IS NULL`; group by a UTC date/month bucket. |

Dashboard data access is read-only. It must not call mutation methods or issue raw mutation SQL.

## Required transaction boundaries

### Verify a code and create a session

The following must commit atomically in one database transaction:

1. Lock and read the eligible `login_codes` row.
2. Compare the submitted code hash and conditionally increment attempts or mark the code used.
3. Find or create the normalized `users` row with conflict-safe uniqueness handling.
4. Generate the opaque session token in application memory, store only its hash, and insert the `sessions` row.

If any step fails, the code state, user row, and session row must roll back together. The raw code and raw session token must never enter the transaction payload or database.

### Create an expense with its snapshot

The following must commit atomically in one database transaction:

1. Verify the product belongs to `userId` and is active, locking the product row or using the configured serializable/retry strategy when snapshot consistency requires it.
2. Read the product's current name and category.
3. Insert the expense with server-written `product_name_snapshot`, `category_snapshot`, `user_id`, and validated integer `amount_cents`.

An expense must not be committed with a missing, cross-user, archived, or client-forged snapshot. Expense edits that change product, and expense soft deletes, also use a transaction so ownership, preconditions, and the resulting ledger fact agree.

## Dashboard aggregate query examples

The examples use PostgreSQL placeholders. `:userId`, `:monthStart`, `:monthEnd`, `:from`, and `:to` are bound parameters supplied by the server; they are never interpolated into SQL. Each query intentionally includes both the tenant predicate and the soft-delete predicate.

### Total this month

```sql
SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total_cents
FROM expenses
WHERE user_id = :userId
  AND deleted_at IS NULL
  AND spent_at >= :monthStart
  AND spent_at < :monthEnd;
```

### Total by product

```sql
SELECT product_name_snapshot,
       COALESCE(SUM(amount_cents), 0)::bigint AS total_cents
FROM expenses
WHERE user_id = :userId
  AND deleted_at IS NULL
  AND spent_at >= :from
  AND spent_at < :to
GROUP BY product_name_snapshot
ORDER BY total_cents DESC, product_name_snapshot ASC;
```

### Total by category

```sql
SELECT category_snapshot,
       COALESCE(SUM(amount_cents), 0)::bigint AS total_cents
FROM expenses
WHERE user_id = :userId
  AND deleted_at IS NULL
  AND spent_at >= :from
  AND spent_at < :to
GROUP BY category_snapshot
ORDER BY total_cents DESC, category_snapshot ASC;
```

### Spending over time

```sql
SELECT date_trunc('day', spent_at AT TIME ZONE 'UTC') AS bucket_utc,
       COALESCE(SUM(amount_cents), 0)::bigint AS total_cents
FROM expenses
WHERE user_id = :userId
  AND deleted_at IS NULL
  AND spent_at >= :from
  AND spent_at < :to
GROUP BY bucket_utc
ORDER BY bucket_utc ASC;
```

For a monthly chart, replace `'day'` with `'month'`; keep the same UTC normalization and half-open range. All aggregate queries use the snapshot columns rather than joining current product fields, so product edits and archival cannot rewrite historical reports.