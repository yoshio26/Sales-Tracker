---
title: 'Epic 5 verification and security coverage'
type: 'feature'
created: '2026-10-01'
status: 'done'
route: 'dispatch'
baseline_commit: '435124bf93902ce6b6918c4945cebf73352921fa'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The completed foundation, authentication, catalog, expense, and dashboard flows have strong unit and route coverage but lack a consolidated Epic 5 verification layer for auth-route security, tenant ownership boundaries, and repeatable end-to-end validation.

**Approach:** Extend the existing Vitest patterns with auth route tests and ownership-focused route/data-access tests, then harden the existing optional Mailpit flow as the live end-to-end smoke path. Use current dependencies and preserve production behavior.

## Boundaries & Constraints

**Always:** Prove generic anti-enumeration responses, same-origin protection, session-cookie behavior, tenant scoping, archived/deleted exclusion, snapshot/concurrency behavior, and dashboard route protection. Keep live external tests opt-in and deterministic when prerequisites are unavailable.

**Never:** Add a browser framework, change API contracts, weaken security checks, seed production data, or include capstone documentation in this implementation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| AUTH_ROUTE_SECURITY | Invalid DTO, unknown email, foreign origin, invalid code | Safe validation/anti-enumeration response and rejected mutation | Assert status/envelope without leaking allowlist state |
| TENANT_BOUNDARY | User A requests or mutates User B product/expense identifiers | No foreign record is returned or modified | Assert not-found/conflict semantics |
| LIVE_AUTH_FLOW | PostgreSQL and Mailpit available; opt-in flag enabled | Request, verify, session, and logout complete successfully | Skip only when opt-in prerequisites are disabled |

</frozen-after-approval>

## Code Map

- `server/modules/auth/routes.ts` -- auth request, verification, session, and logout HTTP contracts to cover.
- `server/modules/auth/service.test.ts` -- existing service-level security expectations to preserve and extend only where route behavior is missing.
- `server/modules/products/routes.test.ts` -- established manual Express route invocation pattern.
- `server/modules/expenses/routes.test.ts` -- expense validation, ownership-facing response, and mutation route behavior.
- `server/modules/dashboard/routes.test.ts` -- protected dashboard route and error-forwarding behavior.
- `server/modules/{products,expenses}/data-access.ts` -- tenant predicates, soft deletion, snapshots, and optimistic concurrency boundaries.
- `tests/dev-auth-flow.test.ts` -- existing opt-in Mailpit end-to-end flow.
- `package.json` -- Vitest commands and available dependency boundary.

## Tasks & Acceptance

**Execution:**
- [x] `server/modules/auth/routes.test.ts` -- add route-level validation, anti-enumeration, origin, invalid-code, cookie, session, and logout coverage.
- [x] `server/modules/products/routes.test.ts` and `server/modules/expenses/routes.test.ts` -- add or strengthen cross-user and mutation outcome assertions without changing route contracts.
- [x] `server/modules/{products,expenses}/data-access.test.ts` -- verify ownership, archive/delete exclusion, snapshots, and stale-update behavior using deterministic database mocks or the existing test database boundary.
- [x] `tests/dev-auth-flow.test.ts` -- document and validate the opt-in live flow’s skip contract and failure diagnostics.
- [x] `README.md` or focused test documentation -- document prerequisites and exact commands for unit, integration, and live smoke tests.

**Acceptance Criteria:**
- Given an unknown email or invalid auth request, when the auth route is called, then the response does not reveal allowlist membership.
- Given a foreign-origin mutation, when a protected mutation route is called, then it is rejected before the service is invoked.
- Given identifiers owned by another user, when catalog, expense, or dashboard requests run, then no foreign data is returned or mutated.
- Given archived products or soft-deleted expenses, when lists and aggregates run, then excluded records do not appear.
- Given an enabled live-test environment, when the Mailpit flow runs, then request-code, verification, session, and logout all pass; otherwise the test remains explicitly skipped.
- Given the verification suite is run, when `npm test` executes, then all non-environment-dependent tests pass and the skip reason is documented.

## Implementation Notes

## Verification

**Commands:**
- `npm test` -- expected: all deterministic tests pass; optional live flow is skipped only without its opt-in environment.
- `npm run typecheck` -- expected: no TypeScript diagnostics.
- `npm run build` -- expected: production build succeeds.

**Manual checks:**
- Confirm the documented live-test prerequisites match `.env` and Mailpit setup.

## Design Notes

Use route-level tests for HTTP envelopes and middleware order, data-access tests for tenant predicates and persistence invariants, and the existing opt-in native `fetch` flow for live authentication. This avoids introducing a new test framework while still separating contract, persistence, and end-to-end evidence.

## Review Triage Log

- verdict: patch
  evidence: The live Mailpit flow did not verify that the selected message was addressed to the requested allowlisted email; recipient matching was added before code extraction.
- verdict: patch
  evidence: External live-flow requests could hang or expose raw network errors; bounded requests with endpoint-specific diagnostics were added.
- verdict: patch
  evidence: Mailpit message-list and detail payloads were dereferenced without shape validation; explicit response-shape checks were added.
- verdict: patch
  evidence: Product route coverage lacked a foreign-tenant read assertion; the route test now verifies an authenticated user receives no foreign product data.
- verdict: false
  evidence: Dashboard tenant and deleted-row predicates are already covered by the existing dashboard data-access tests listed in the Code Map.
- verdict: false
  evidence: Product archive and expense soft-delete exclusion are covered by the new data-access tests and existing dashboard aggregation tests; no production exclusion behavior was left untested.
- verdict: false
  evidence: Auth service anti-enumeration behavior remains covered by service tests, while the new route test verifies the HTTP envelope and service forwarding contract.
- verdict: false
  evidence: The README documents the deterministic data-access/integration boundary and the exact live command; no separate live database integration command exists in the current dependency boundary.
- verdict: patch
  evidence: The auth route suite did not cover malformed verification DTOs; a 400 response and service non-invocation assertion were added.
- verdict: patch
  evidence: The live flow selected the first Mailpit message and could inspect an unrelated message; recipient-aware selection and message-ID validation were added.
- verdict: patch
  evidence: The live flow asserted session JSON without checking HTTP success; authenticated and post-logout session status assertions were added.
- verdict: false
  evidence: The anti-enumeration route test intentionally verifies the route's generic envelope and forwarding contract; allowlist-dependent response behavior remains covered by the auth service tests.
- verdict: false
  evidence: Logout without a cookie is already delegated to the idempotent service contract and does not represent a missing acceptance behavior in this route-focused scope.
- verdict: false
  evidence: Dashboard tenant and soft-delete predicates are covered by the existing dashboard data-access tests named by the spec's Code Map.
- verdict: false
  evidence: No product read-by-ID data-access operation exists; product listing and mutation ownership paths are the available catalog boundaries.
- verdict: false
  evidence: Successful expense soft-delete and exclusion are covered by the existing expense route and dashboard aggregate tests; the added data-access test targets the foreign-row outcome.
- verdict: false
  evidence: The reported README/spec character encoding issue is not present in the UTF-8 files and is a review-rendering artifact.
