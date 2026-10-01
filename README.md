# Sales Tracker verification

## Deterministic verification

The default suite uses Vitest and mocked persistence, so it does not require PostgreSQL or Mailpit:

- `npm test` — run all unit, route, and deterministic data-access/integration-boundary tests. The live auth test is explicitly skipped unless opted in.
- `npm run typecheck` — check server and frontend TypeScript diagnostics.
- `npm run build` — run type checks, build the frontend, and compile the server.

The route tests cover validation envelopes, anti-enumeration responses, same-origin rejection, session-cookie behavior, protected dashboard access, and tenant-scoped mutation outcomes. Data-access tests verify tenant predicates, archived/deleted exclusion, immutable expense snapshots, and stale-write handling.

The repository does not define a separate live database integration command: persistence-boundary tests use deterministic database mocks so the default suite remains repeatable without PostgreSQL. The live PostgreSQL boundary is exercised by the opt-in Mailpit authentication flow after migrations are applied.

## Optional Mailpit authentication smoke test

Set `RUN_DEV_AUTH_FLOW=true` to enable `tests/dev-auth-flow.test.ts`. Before running it, start the server and Mailpit, apply the Prisma migrations, and configure an allowlisted email. The test uses these values (defaults shown):

- `AUTH_BASE_URL=http://localhost:3000`
- `APP_ORIGIN=http://localhost:5173`
- `MAILPIT_API_URL=http://localhost:8025`
- `ALLOWLIST_EMAIL` — required; must be present in the database allowlist

Run only the live flow with `npm run test:dev-auth-flow`. Without the opt-in flag, Vitest reports the test as skipped rather than silently treating it as verified. If enabled prerequisites are missing or an HTTP/mailbox assertion fails, the test fails with the endpoint and prerequisite context in its diagnostic message.

Do not enable this test in environments where the server, database, or Mailpit instance is not intentionally available.
