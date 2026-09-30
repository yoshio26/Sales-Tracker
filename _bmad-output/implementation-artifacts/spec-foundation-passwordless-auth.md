---
title: 'Foundation and passwordless allowlist authentication'
type: 'feature'
created: '2026-09-30'
status: 'done'
baseline_commit: '48337a9889a11b24fc15fbfbb9e53785d5043f17'
route: 'dispatch'
review_loop_iteration: 0
context:
  - 'C:/Users/Owner/My Project/Sales Tracker/_bmad-output/planning-artifacts/architecture/architecture-Sales-Tracker-2026-09-30/ARCHITECTURE-SPINE.md'
  - 'C:/Users/Owner/My Project/Sales Tracker/_bmad-output/planning-artifacts/prds/prd-Sales-Tracker-2026-09-30/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sales Tracker has planning artifacts but no runnable application foundation. Authentication must let only pre-approved users enter without storing passwords or revealing whether an email is approved.

**Approach:** Create the TypeScript/Vite React and Express modular-monolith foundation, PostgreSQL/Prisma schema and migrations for allowlisted passwordless login, and a minimal login flow that sends and verifies one-time email codes before creating a server-side session.

## Boundaries & Constraints

**Always:** Normalize emails before persistence; rate-limit code requests before allowlist checks at 3 requests per 10 minutes per normalized email plus a per-IP limit; return the same generic response for approved and unapproved addresses; generate codes with `crypto.randomInt`; store only code hashes; expire codes after 10 minutes, lock after five failed attempts, and consume them once. Generate session tokens with `crypto.randomBytes(32)` and store only a hash of each token in `sessions`. Create the user and PostgreSQL-backed seven-day session atomically after successful verification. Set only the opaque token in an `HttpOnly`, `SameSite=Lax` cookie; control `Secure` with the `COOKIE_SECURE` environment variable. Validate request input with Zod, scope protected operations from session identity, and keep Prisma access inside data-access modules.

**Never:** Store passwords, raw login codes, or raw session tokens; disclose allowlist membership; trust client-supplied user IDs or authorization claims; place Prisma calls in routes/services; add roles, products, expenses, dashboard behavior, microservices, or production SMTP credentials to this slice.

**Dependency and scaffold decisions:** Pin Prisma and its CLI/client to the stable 6.x line, not the Prisma 8.0 release candidate. Before pinning TypeScript, Prisma, Vitest, and the TypeScript runner, verify that the selected TypeScript version is supported by all three; if the selected TypeScript version is incompatible, use the highest common supported version. Scaffold the client with `npm create vite@latest client -- --template react-ts` and configure the Vite development server to proxy `/api` to Express.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Request approved code | Normalized email exists in `allowed_emails` and both email and IP limits permit | Persist hashed six-digit code and send email through configured SMTP; return generic confirmation | SMTP failure is logged without code or secret and returns the same generic response |
| Request unapproved code | Email is absent from `allowed_emails` | Do not persist or send a code; return the same generic confirmation | No allowlist disclosure |
| Verify valid code | Matching unexpired unused code with fewer than five failed attempts | Atomically mark code used, create/find user, create session, set cookie, and open app | Invalid state returns generic verification failure |
| Verify invalid/expired/locked code | Wrong code, expired code, used code, or five attempts reached | Do not create user/session; increment failed attempt when applicable | Generic failure; no code-state disclosure |
| Authenticated request | Valid unexpired session cookie belonging to the requesting user | Resolve session to the server-derived `userId` | Missing, expired, or cross-user session resolution returns 401 and never resolves to another user's `userId` |
| Logout | Valid session | Delete session and clear cookie | Repeated logout is safe |

</frozen-after-approval>

## Code Map

- `client/` -- Vite React TSX application; create login email/code views, API client, and CSS Modules without adding product/dashboard screens.
- `server/modules/auth/routes.ts` -- HTTP endpoints for request-code, verify-code, session, and logout; routes validate with Zod and delegate to services.
- `server/modules/auth/service.ts` -- email normalization, allowlist behavior, code issuance/verification, atomic user/session rules, and generic responses.
- `server/modules/auth/data-access.ts` -- Prisma queries for allowlist, login codes, users, and sessions; no route/service Prisma imports.
- `server/middleware/session.ts` -- resolve opaque cookie to an unexpired session and attach server-derived `userId`.
- `server/infrastructure/prisma.ts` -- single Prisma client construction and configuration.
- `server/infrastructure/mailer.ts` -- Nodemailer SMTP transport using environment configuration, Mailpit by default.
- `server/app.ts` -- Express JSON middleware, auth routes, protected middleware wiring, Vite static serving in production, and safe error handling.
- `prisma/schema.prisma` -- users, allowed emails, login codes, and sessions with normalized-email and expiry constraints.
- `prisma/seed.ts` -- deterministic idempotent allowlist seed from the email in an environment variable and safe local development configuration.
- `.env.example` -- documented non-secret local variables; `.env` remains ignored.
- `package.json`, `tsconfig*.json`, `vite.config.ts` -- workspace scripts, strict TypeScript, Vite `/api` proxy, dependency compatibility checks, and build commands.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `tsconfig*.json`, `vite.config.ts`, `client/`, `server/` -- scaffold the client with `npm create vite@latest client -- --template react-ts`, create the Express TypeScript server with strict compilation and dev scripts, configure the Vite `/api` proxy to Express, and verify TypeScript compatibility with Prisma, Vitest, and the TypeScript runner before pinning versions.
- [x] `prisma/schema.prisma`, `prisma/migrations/` -- define and migrate `users`, `allowed_emails`, `login_codes`, and `sessions` with timestamps, unique normalized emails, code attempt state, hashed session tokens, and session expiry; pin Prisma to stable 6.x after dependency compatibility verification.
- [x] `server/infrastructure/prisma.ts`, `server/infrastructure/mailer.ts`, `.env.example` -- centralize database, session, SMTP, Mailpit, `COOKIE_SECURE`, per-email/per-IP rate-limit, and development allowlist-email configuration without hardcoded secrets.
- [x] `server/modules/auth/data-access.ts`, `server/modules/auth/service.ts`, `server/modules/auth/routes.ts` -- implement secure request and verification flows with transactional state transitions and generic responses.
- [x] `server/middleware/session.ts`, `server/app.ts` -- implement cookie-based session resolution, logout, API error handling, and one-origin static serving.
- [x] `prisma/seed.ts` -- seed approved development emails idempotently and refuse production-marked environments.
- [x] `client/src/features/auth/*` -- implement email/code login, loading, generic confirmation, verification errors, authenticated state, and logout.
- [x] `server/modules/auth/*.test.ts`, `server/middleware/*.test.ts` -- test allowlist privacy, three-per-ten-minute email limiting, per-IP limiting, code security, atomic consumption, expired-session rejection, session ownership isolation, and logout.
- [x] `tests/dev-auth-flow.test.ts` -- add a development-only whole-flow test that requests a code, reads it from Mailpit, verifies it, and confirms the browser receives the expected session cookie.

**Acceptance Criteria:**
- Given an approved email under the rate limit, when the user requests a code, then the API returns the generic confirmation, stores only a hash, and sends a six-digit code through the configured mailer.
- Given an email that has already requested three codes within 10 minutes, when it requests another code, then the API applies the email rate limit; requests from an IP exceeding the configured per-IP limit are also throttled without revealing allowlist membership.
- Given an unapproved email, when the user requests a code, then the API returns the same generic confirmation and neither stores nor sends a code.
- Given a valid code, when verification succeeds, then code consumption, user creation/find, and seven-day session creation commit atomically and the browser receives an HTTP-only opaque cookie.
- Given a valid code, when verification succeeds, then the session token is generated with `crypto.randomBytes(32)`, only its hash is stored in `sessions`, and the cookie uses `HttpOnly`, `SameSite=Lax`, and the `COOKIE_SECURE` setting for `Secure`.
- Given an invalid, expired, used, or locked code, when verification is attempted, then no session is created and the response does not disclose which condition occurred.
- Given a valid session, when a protected API request is made, then the server derives `userId` from PostgreSQL session state rather than request data.
- Given an expired session, when a protected API request is made, then the server rejects it with 401.
- Given one user's session, when session resolution is attempted for another user, then it never resolves to the other user's `userId`.
- Given logout, when the user submits it, then the session row is deleted and the browser cookie is cleared.
- Given the repository, when the typecheck, test, and production build scripts run, then all pass without raw secrets in source.
- Given the development environment, when the whole-flow auth test runs, then it requests a code, reads the code from Mailpit, verifies it, and confirms the session cookie is set.

## Implementation Notes


## Design Notes

Use `crypto.randomBytes(32)` for the opaque browser token and store only its hash server-side. The same pattern applies to login code hashes. Keep code verification conditional and transactional so concurrent verification requests cannot consume one code twice. The development seed must read the approved email from an environment variable and remain idempotent.

## Verification

**Commands:**
- `npm run typecheck` -- expected: strict TypeScript compilation succeeds.
- `npm test` -- expected: authentication and session security tests pass.
- `npm run build` -- expected: client and server production artifacts build successfully.
- `npm run test:dev-auth-flow` -- expected: the development-only browser/API flow requests a code, reads it from Mailpit, verifies it, and confirms the session cookie.

**Manual checks:**
- Use Mailpit to confirm approved codes arrive while unapproved requests do not.
- Inspect browser cookies to confirm the session value is opaque, HTTP-only, and has the required SameSite/Secure flags.
- Verify the selected TypeScript version is supported by Prisma 6.x, Vitest, and the TypeScript runner before dependency versions are pinned.

## Review Triage Log

- Blind-hunter implementation-gap findings: **false**. The cited middleware, Prisma singleton, rate limiting, environment validation, seed production guard, strict TypeScript configuration, and Express error handling are present in the reviewed implementation.
- Edge-case finding on malformed session responses: **false**. The session response is parsed inside the promise chain and parse failures are caught; no signed-in state is set on failure.
- Edge-case finding on client-side input validation: **false**. Browser-native `required`, `email`, `pattern`, and `maxLength` constraints are present, with server-side Zod validation as the authoritative boundary.
- Edge-case finding on logout failure: **medium / patch applied**. The client previously transitioned to signed-out state without checking the response; it now preserves the signed-in state and reports failure.
- Verification-gap finding for logout/session/cookie coverage: **medium / verification extended**. The development flow now checks `HttpOnly`, `SameSite=Lax`, development `Secure` behavior, authenticated session restoration, logout cookie clearing, and post-logout session invalidation.
- External integration status: **deferred pending environment**. The full Mailpit flow remains unverified because Mailpit is not listening on `localhost:8025`; unit tests, typecheck, Prisma validation, and production build pass.
