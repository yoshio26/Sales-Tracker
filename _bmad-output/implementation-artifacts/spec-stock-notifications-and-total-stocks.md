---
title: 'Stock totals and email notifications'
type: 'feature'
created: '2026-11-11'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '46e74114277c0b3b55dd30bb8c041fe03606984c'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The dashboard exposes separate stock status counts but not a single product-and-unit total, and stock mutations provide no operational email visibility.

**Approach:** Add product and unit totals to the existing dashboard response and render them in a matching summary card. Reuse the existing Nodemailer/Resend mailer through one backend notification helper for added, deleted, and changed stock events, with one summary notification for bulk creation.

## Boundaries & Constraints

**Always:** Calculate profit and active stock totals on the backend after successful persistence; use `NOTIFY_EMAIL_TO` and `NOTIFY_TIMEZONE` (default `Asia/Manila`); send asynchronously and isolate mail failures; include HTML and plain-text bodies; preserve tenant scoping, stale-write protection, existing currency formatting, and current auth/mail provider behavior. Settings defaults are enabled, and a saved recipient overrides the environment recipient when present.

**Never:** Send email from the frontend, add another provider, notify for unchanged edits, notify purchase checkout/history deletion, expose SMTP/API secrets, or change unrelated pages and styles.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Single add | One product persists | One added email with product fields, optional initial deduction, timestamp, profit, and product/unit totals | Mail failure is logged and does not change the successful response |
| Bulk add | Multiple products persist through one backend operation | One summary email listing every product | Transaction failure sends no email and returns the existing failure |
| Delete | Archive or permanent deletion succeeds | One delete email with removed product details and post-change totals | Missing, stale, or invalid mutations keep existing HTTP behavior |
| Changed edit | Product fields or stock quantity actually differ | One edit email listing only changed before/after fields | Mail failure is isolated |
| No-op edit | Submitted values equal stored values | No notification | Request remains successful |
| Dashboard | Active products exist, including zero-quantity products | Card shows `N products · M units` | Empty data returns zeroes |

</frozen-after-approval>

## Code Map

- `server/infrastructure/config.ts` -- validated environment configuration; add notification recipient/timezone defaults.
- `server/infrastructure/mailer.ts` -- existing Resend-first/SMTP Nodemailer transport; expose a reusable message sender without adding a provider.
- `server/modules/products/routes.ts`, `service.ts`, `data-access.ts` -- product create/edit/archive/permanent-delete handlers and stale-write transactions; add notification snapshots and bulk creation boundary.
- `server/modules/stock/routes.ts`, `service.ts`, `data-access.ts` -- replenish and exact quantity edit transactions; return before/after data needed for edit notifications.
- `server/modules/dashboard/data-access.ts`, `service.ts` -- stock aggregate and profit composition; add active product count.
- `FrontEnd/src/App.tsx` -- dashboard Zod contract and bulk-create request orchestration.
- `FrontEnd/src/pages/DashboardPage.tsx` -- summary card and loading skeleton.
- `FrontEnd/src/App.module.css` -- existing summary card/grid styles; change only if the fifth card needs responsive adjustment.
- `prisma/schema.prisma` and migration -- persisted notification preferences/recipient for the optional Settings controls.
- `README.md`, `.env.example` -- document notification variables and setup.

## Tasks & Acceptance

**Execution:**
- [x] Extend dashboard stock aggregation, response validation, card, skeleton, and tests.
- [x] Add reusable notification composition/sending with timezone, currency, settings fallback, and failure logging tests.
- [x] Add post-save add notifications, including one transactional bulk-create summary.
- [x] Add archive/permanent-delete notifications with removed snapshots and edit notifications for product and quantity changes.
- [x] Add persisted Settings toggles/recipient controls after core notifications work, with defaults enabled.
- [x] Document environment variables and run typecheck, build, and Vitest.

**Acceptance Criteria:**
- Given active products, when the dashboard loads, then the Total stocks card shows product count and unit count.
- Given a successful add, delete, or changed edit, when persistence completes, then the backend dispatches the correct notification without delaying or failing the HTTP action.
- Given a bulk add, when all products persist, then exactly one email lists all affected products.
- Given an unchanged edit or failed database mutation, then no notification is sent.
- Given an email transport failure, then the stock action still succeeds and the error is logged.
- Given default settings, then all three event toggles are enabled and the configured recipient is used.

## Implementation Notes

The frontend has no backend bulk-create endpoint today; the existing loop must be replaced or routed through a transactional endpoint to guarantee one summary email. Initial-cost deduction currently uses a second expense request, so the implementation must make the backend notification reflect only a confirmed deduction or move the coupled save into the backend boundary without double-counting.

## Verification

**Commands:**
- `npm test` -- expected: all deterministic tests pass.
- `npm run typecheck` -- expected: server and frontend diagnostics pass.
- `npm run build` -- expected: frontend and server builds pass.