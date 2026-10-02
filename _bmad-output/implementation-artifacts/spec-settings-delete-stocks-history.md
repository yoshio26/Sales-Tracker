---
title: 'Settings controls for stock and purchase history deletion'
type: 'feature'
created: '2026-10-02'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'e97f5dabc6c32f5331023991ee3d2d3bc5ec75b4'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Signed-in users have no Settings area beside Purchase History for managing stock and history data, so unwanted stock records and purchase history cannot be removed through the application.

**Approach:** Add a Settings destination beside Purchase History in the sidebar. The Settings view will provide clearly labeled, authenticated destructive controls for the approved stock and purchase-history deletion behaviors, with confirmation, loading, success, and error feedback.

## Boundaries & Constraints

**Always:** Scope every mutation to the authenticated user; protect mutations with same-Origin middleware; validate requests with Zod; require explicit confirmation before destructive actions; refresh affected stock, history, and dashboard data after success; use the existing error envelope and accessible status feedback.

**Never:** Allow one user to delete another user's records; silently delete data; accept client-supplied user IDs; change authentication, expense behavior, product pricing, or existing purchase calculations; expose destructive controls in Dashboard or Buy.

**Decisions:** “Delete stocks” removes the user's stock/product records. “Delete history” provides deletion for individual purchase-history records.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Open Settings | Authenticated user selects Settings beside Purchase History | Settings page shows the approved stock and history controls | Unauthenticated users retain existing session behavior |
| Delete stock data | User confirms the approved stock deletion action | Only the user's approved stock data is deleted or reset according to the selected policy; related views refresh | Cancel performs no mutation; server failure preserves data and shows an error |
| Delete purchase history | User confirms the approved history deletion action | Only the user's approved purchase-history records are removed or hidden according to the selected policy; dashboard/history refresh | Cancel performs no mutation; server failure shows an error |

</frozen-after-approval>

## Code Map

- `FrontEnd/src/App.tsx` -- owns `WorkspaceView`, sidebar navigation, authenticated data loading, and view rendering; add Settings beside Purchase History and reuse API/feedback patterns.
- `FrontEnd/src/App.module.css` -- contains sidebar, buttons, modal, danger, and responsive workspace styles; reuse existing visual language.
- `FrontEnd/src/pages/PurchaseHistoryPage.tsx` -- displays purchase history and should refresh after Settings mutations.
- `FrontEnd/src/pages/StockTrackerPage.tsx` -- displays stock quantities and should refresh after stock mutations.
- `server/modules/stock/routes.ts` -- existing session-scoped stock and purchase routes; add protected deletion endpoints after the policy is approved.
- `server/modules/stock/service.ts` and `server/modules/stock/data-access.ts` -- preserve route → service → data-access layering and tenant scoping for deletion operations.
- `prisma/schema.prisma` and `prisma/migrations/` -- update persistence only if the approved policy requires soft deletion or new fields.
- `server/app.ts` -- stock router is already mounted at `/api/stock`; preserve middleware ordering.
- `server/modules/stock/*.test.ts` and frontend manual checks -- extend ownership, confirmation, deletion, refresh, and failure coverage.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma`; `prisma/migrations/` -- add only the persistence changes required by the approved deletion policy.
- [x] `server/modules/stock/data-access.ts`; `server/modules/stock/service.ts`; `server/modules/stock/routes.ts` -- implement authenticated, tenant-scoped, same-origin-protected deletion/reset operations and safe errors.
- [x] `FrontEnd/src/App.tsx`; `FrontEnd/src/App.module.css` -- add Settings beside Purchase History with confirmation dialogs, destructive styling, feedback, and refresh behavior.
- [x] `server/modules/stock/*.test.ts`; frontend verification documentation -- test ownership, cancellation, success, failure, and post-delete state.

**Acceptance Criteria:**
- Given a signed-in user, when they view the sidebar, then Settings appears immediately beside Purchase History.
- Given a destructive Settings action, when the user cancels confirmation, then no server mutation occurs.
- Given a confirmed action, when it succeeds, then only the authenticated user's approved data changes and affected views show the updated state.
- Given a request for another user's data, when the mutation is attempted, then the server does not reveal or mutate that data.
- Given a server failure, when the mutation is attempted, then the UI keeps the user informed and does not claim success.

## Implementation Notes

Approved decisions: remove stock/product records and delete individual purchase-history entries. Because existing purchase history references products with restrictive foreign keys, product removal must return a safe conflict when references prevent deletion rather than weakening historical integrity.

## Verification

**Commands:**
- `npm run typecheck` -- expected: server and client TypeScript checks pass.
- `npm test` -- expected: relevant stock/settings tests pass; existing unrelated same-origin mock failures are tracked separately if still present.
- `npm run build` -- expected: production frontend and backend build succeeds.
- `git diff --check` -- expected: no whitespace errors.

## Review Triage Log

- `false` — The blind review reported mojibake, but the changed files are UTF-8 and user-facing strings render correctly when read from disk.
- `defer` — The blind review reported that pricing changes violate this spec; pricing changes were already uncommitted before this feature's implementation baseline and are not caused by Settings deletion.
- `defer` — The blind review reported legacy zero-price products and persistence/API pricing-validation differences; these belong to the pre-existing pricing work, not this feature.
- `defer` — The blind review reported mutable-price purchase behavior and dashboard labeling; both are pre-existing pricing/dashboard changes outside this feature.
- `patch` — Stock deletion could leak a foreign-key error if a reference appeared between the preflight counts and delete; the data-access layer now maps Prisma `P2003` conflicts to the safe referenced outcome and has a regression test.
- `patch` — The blind review noted missing race coverage; the concurrent foreign-key conflict test now covers the implemented guard.
- `patch` — Pricing conflict branches lacked route/data-access assertions; tests now cover missing price, oversized totals, and their documented `409` envelopes.
- `patch` — Purchase deletion did not assert its response contract; route tests now verify `204`, empty send, and `404` not-found behavior.
- `patch` — Invalid purchase-history IDs used a generic product/quantity message; the route now returns an ID-specific validation message.
- `false` — The edge review reported stale dashboard refresh after history deletion failure; the history loader handles request failure internally and the refresh callback still runs after the deletion response succeeds.
- `false` — The edge review reported stock refresh failure being treated as deletion failure; refresh helpers absorb individual loader failures and the deletion success notice remains separate.
- `defer` — Automated frontend component/browser tests remain unavailable because this repository has no client test harness; reproducible Settings checks were added to `FrontEnd/DASHBOARD-MANUAL-CHECKS.md`, consistent with existing deferred E2E coverage.
