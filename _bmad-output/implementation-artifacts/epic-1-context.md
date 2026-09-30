# Epic 1 Context: Foundation and authentication

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the deployable Sales Tracker foundation and a secure passwordless authentication flow so allowlisted users can sign in without passwords, receive isolated server-side sessions, and safely reach the rest of the application. The foundation must support local development with PostgreSQL and Mailpit while preserving the same-origin production shape.

## Stories

- Story 1.1: Application foundation and environment setup
- Story 1.2: Authentication schema and migrations
- Story 1.3: Rate-limited login-code request flow
- Story 1.4: Code verification, sessions, and logout

## Requirements & Constraints

- Use a modular monolith with a React/Vite TypeScript client, Express TypeScript API, Prisma migrations, and PostgreSQL as the system of record.
- Configure secrets and connection details through environment variables; keep local `.env` files ignored. Use Mailpit for development SMTP and a configurable external SMTP provider for demonstration.
- Normalize email addresses before allowlist lookup and persistence. Only allowlisted addresses may receive a code, but approved and unapproved requests must produce the same generic response; unapproved requests must not send email.
- Generate six-digit codes with a cryptographically secure source. Store only one-way code hashes. Codes expire after ten minutes, are single-use, and lock after five failed attempts for the remainder of their validity. Login-code requests are limited to three per email per ten minutes.
- Verification must not disclose allowlist membership or authentication state through response differences. Email failures must remain generic to the client and must not log codes or secrets.
- Successful verification creates or finds the normalized user and creates a seven-day PostgreSQL-backed session atomically. Store only a hash of the random session token and expose only the opaque token in an HTTP-only cookie.
- Session cookies use `SameSite=Lax` and `Secure` over HTTPS. Protected requests resolve the session server-side, enforce expiry, and derive the authenticated `userId`; client-provided ownership claims are never trusted. Logout deletes the matching session and is safe to repeat.
- State-changing requests validate the request `Origin` in addition to session protections. Use consistent error envelopes without leaking sensitive authentication or allowlist information.
- During development Vite proxies `/api` to Express. In production Express serves the Vite build and API from one origin and port; do not introduce a separate frontend/API deployment.
- Use UTC timestamps and explicit DTO contracts. Timestamps crossing JSON boundaries are ISO 8601 UTC strings; secrets, raw codes, raw session tokens, real email data, and connection strings do not belong in source control.

## Technical Decisions

- Organize the server as feature modules with routes, services, and data access. Routes handle HTTP and Zod validation; services own authentication rules and transactions; data-access code owns Prisma queries. Routes and services do not import Prisma directly.
- The authentication model includes `users`, `allowed_emails`, `login_codes`, and `sessions`. Normalized user email is unique; allowlist email is the primary lookup key. Login-code rows track expiry, failed attempts, usage, and creation time. Session rows track the user, token hash, expiry, and creation time.
- Verification locks the eligible login-code row and performs a conditional state transition, preventing concurrent requests from consuming one code twice. Code state, user creation/upsert, and session creation commit in one transaction; failures roll back together.
- Use conflict-safe user creation for first login. Generate the raw session token only in application memory, hash it before persistence, and rotate to the newly created session token after login.
- Authentication middleware resolves a presented cookie by hashing its token and querying an unexpired session, returning only the server-side user identity to downstream modules. Future feature modules must apply that identity as their tenant predicate.
- Prisma Migrate is the only schema migration path. Seed data, if used, must be deterministic, idempotent, transactional, and refuse production-marked environments.

## UX & Interaction Patterns

- The login screen has an email-entry state, code-entry state, generic delivery confirmation, retry behavior, and safe error states. Preserve the submitted email when moving to code entry or showing an error.
- After requesting a code, show an inline “Check your inbox” state and explain that the six-digit code expires in ten minutes without revealing whether the email is allowlisted.
- Use labeled fields, keyboard navigation, focus management, readable inline feedback, visible focus, accessible contrast, and status indicators that do not rely on color alone. Provide loading, validation-error, server-error, and success states.
- On successful verification, navigate to the dashboard. On failure, explain only the next safe action and retain the email so it need not be entered again.

## Cross-Story Dependencies

- Foundation and environment setup must precede schema migration and authentication implementation.
- Authentication schema/migrations must be available before request, verification, session, and logout flows can be implemented.
- Login-code request behavior feeds verification; verification must complete before protected application features in later epics can rely on session identity.
- PostgreSQL and the configured SMTP transport are runtime dependencies for the authentication flow; Mailpit is the local development transport.
- The session middleware and server-derived `userId` established here are prerequisites for tenant isolation in the product catalog, expense ledger, and dashboard epics.
