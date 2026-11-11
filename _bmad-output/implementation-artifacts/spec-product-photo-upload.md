---
title: 'Cloudinary product photos with immutable purchase snapshots'
type: 'feature'
created: '2026-11-11'
status: 'in-review'
route: 'dispatch'
baseline_commit: '0d164984675c639c6d0a4f35d580577e59fc4e27'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="Approved plan and decisions from user on 2026-11-11">

## Intent

Add optional Cloudinary-backed product photos across product management, inventory, purchasing, history, archived products, and stock notification emails. Purchase images are immutable snapshots, like existing name/category snapshots.

## Boundaries & Constraints

Always preserve tenant isolation, session/same-origin checks, stale-write protection, atomic bulk behavior, existing calculations, and JSON compatibility. Upload JPEG/PNG/WebP only, maximum 3 MB, using memory multipart handling and Cloudinary folder `asimon/products` with optimized quality/format. Validate actual image bytes as well as declared type. No client-controlled Cloudinary public IDs or remote image URLs for persistence.

Add nullable `imageUrl` and `imagePublicId` to both Product and StockPurchase in one migration. Copy both from Product when purchases are created (single and checkout). Backfill existing purchases from matching tenant-owned product images. History displays its own snapshot URL with placeholder fallback.

Delete remote assets only if their public ID has zero references in BOTH Product and StockPurchase, including archived/soft-deleted records, across all tenants. Apply this after replacement/removal, failed saves of fresh uploads, permanent product deletion, purchase deletion, bulk flows, delete-all/clear history paths, and retention purge. Collect candidates before deleting rows and check references after committed persistence, outside database transactions. Cloudinary/check failures are logged and never undo or throw through successful product actions. Archive/restore and recoverable delete-all preserve images while references remain. No network calls inside database transactions.

If replacement upload fails, retain old image, save product details successfully, and return a photo warning displayed in a toast. Failed create photo uploads similarly allow product creation. Missing Cloudinary configuration must not crash startup: requests attempting upload return explicit 503. Invalid/oversized files produce clear 400/413 errors without product mutation.

CSP adds only `https://res.cloudinary.com` as external image origin, never a wildcard; preserve required self/data/blob sources for previews. NEVER read, search, print, or edit `.env` values. Only modify Cloudinary validation in config and placeholders in `.env.example`. Do not deploy, migrate a live database, commit, push, or perform live Cloudinary operations for verification.

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma`, `prisma/migrations/` — mapped SQL fields and timestamped migrations.
- `server/infrastructure/config.ts`, `server/app.ts` — optional env config, Helmet CSP, JSON and error envelopes.
- `server/modules/products/{routes,service,data-access}.ts` — JSON create/bulk/update, stale-write checks, archive/restore/permanent delete. Public responses must not expose public IDs.
- `server/modules/stock/{routes,service,data-access}.ts`, `server/index.ts` — explicit stock/purchase selects, checkout snapshots, deletePurchase, recoverable deleteStockData, scheduled purge. Inspect all deletion entry points; frontend bulk calls existing single endpoints.
- `FrontEnd/src/App.tsx` — product type, API wrapper currently forces JSON, shared add/edit/bulk modal, archive confirmation.
- `FrontEnd/src/pages/{DashboardStockTable,StockTrackerPage,PurchaseHistoryPage,SettingsPage}.tsx` — independent types/Zod schemas; render product names in lists/tables, picker selection/options, cart, bought history, archived catalog; quantity/insufficient-stock dialogs.
- `server/modules/notifications/service.ts` — escaped HTML rendering and optional image notification payloads. Product/stock services build event items.
- `package.json`, `package-lock.json`, `.env.example`, `README.md` — dependencies and setup; `.env` exists and must not be read.

## Tasks & Acceptance

Execute sequentially in this order:

- [x] `prisma/schema.prisma` and new migration — add both nullable image fields to both models, indexes supporting reference checks, tenant-safe backfill SQL.
- [x] `server/infrastructure/config.ts` and new image/upload helper — optional config; Cloudinary and Multer dependencies/types; bounded memory/files/fields; clear unavailable and validation errors; optimized upload; best-effort reference-aware cleanup.
- [x] Product and stock routes/services/data access — authenticated multipart create/update/bulk with shared bulk photo and independently owned uploaded assets (avoid premature cleanup); preserve JSON requests; remove-image flag; warning response; stale/duplicate/error cleanup; snapshot fields and all deletion/purge cleanup paths. Keep IDs internal.
- [x] New `FrontEnd/src/components/ProductImage/` and `ImageUpload/` components/CSS — accessible responsive image with missing/broken placeholder; file selection/drop/preview/removal, validation and object URL cleanup.
- [x] `App.tsx` and listed pages — FormData only when needed, do not set multipart Content-Type manually, add/edit/bulk image state, photo warnings toast, preserve images through edit callbacks, render photos wherever a product appears including picker/cart/history/archive and relevant dialogs. Snapshot schemas must retain own image URL, not join current product image.
- [x] Notification service and event producers — escaped optional trusted Cloudinary images in HTML; plain-text messages remain readable; failed remote images do not affect messages.
- [x] Focused backend/frontend tests plus `README.md`, `.env.example`, `server/app.ts` — document local/production migration commands and Cloudinary setup, targeted CSP. Test upload validation, missing config, replacement failure, removal, stale/duplicate rollback cleanup, immutable single/checkout snapshots, referenced/unreferenced assets, deletion/purge, UI fallback/preview/reset/toasts and renderers.

Acceptance criteria:
- Given no photo, when old products/history render, then placeholders work and existing functionality remains intact.
- Given a valid photo, when creating/editing/bulk-adding, then optimized Cloudinary URL persists and appears in product screens and emails.
- Given a purchase snapshot, when the product photo changes or is removed, then history remains unchanged and its referenced asset is retained.
- Given an unused asset, when deletion/replacement/purge completes, then cleanup checks both tables and attempts remote deletion without making successful persistence fail.
- Given absent Cloudinary config, when server starts, then startup succeeds; when upload is requested, then a clear 503 is returned.
- Given Cloudinary upload failure with configured credentials, when saving details, then details save, old photo is retained and a warning toast explains the failure.

## Implementation Notes

User approved the findings/plan and supplied final snapshot/cleanup/config decisions before implementation. Do not execute live database migrations; supply deployment steps.

## Spec Change Log

## Review Triage Log

## Verification

- `npx prisma generate` — generated client updated without live database mutation.
- `npm run typecheck` — successful server and frontend checks.
- `npm run build` — successful production builds.
- `npm test` — all deterministic Vitest tests pass; explicitly report opt-in skips.
- Inspect diff and check editor diagnostics; independently review security, cleanup semantics, snapshot consistency, and verification coverage.

### Execution evidence — 2026-11-11

- Prisma client generation succeeded; no migration/deployment or live Cloudinary operation was performed. No `.env` values were inspected or modified.
- `npm run typecheck` passed; `npm run build` passed for frontend and server (including a final typecheck).
- Final `npm test`: **221 passed**, **1 skipped**, across 31 passing test files and one skipped test file. The skipped test is the opt-in Mailpit/PostgreSQL authentication flow, intentionally not enabled.
- Editor diagnostics: no errors. `git diff --check`: passed (Git notes LF/CRLF normalization for `FrontEnd/src/App.tsx`).
- Added real localhost multipart HTTP tests with mocked persistence/Cloudinary, decoded image validation, limits, same-origin/session checks, unavailable config, warning fallback, client-ID/URL rejection, stale/duplicate cleanup, single/checkout snapshot and cleanup-order tests, trusted email/CSP checks, component preview/fallback/reset tests, App FormData/warning tests, and page current/snapshot renderers.
- Snapshot creation conditionally matches the captured asset ID while decrementing stock, preventing a concurrent photo replacement from publishing an already-unreferenced asset into history.
- Independent review is **pending**: this runtime cannot launch the required context-free reviewer agents. Standalone review handoffs are prepared separately; do not treat the passing deterministic checks as a completed independent review.
- Operator follow-up: apply the migration deliberately and configure server-side Cloudinary credentials as documented in [README.md](../../README.md). Live PostgreSQL migration/backfill, browser visual checks, and actual Cloudinary delivery/deletion remain unverified by design.
- Environment risks observed during install: local Node `24.13.0` is below the project's declared `>=24.21.0`; npm reported 13 dependency vulnerabilities (3 moderate, 7 high, 3 critical). No unrelated dependency remediation was attempted. Cleanup is best-effort/logged with no durable orphan retry queue; shared bulk photos require independent remote uploads and may increase save latency.