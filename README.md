# Sales Tracker verification

## Product photos and database rollout

Product photos are optional. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` using your deployment secret manager (placeholders are in `.env.example`). Keep the API secret on the server; never use frontend/Vite variables. Missing configuration does not block startup or JSON-only saves, but photo upload requests receive 503.

For a local development database, apply the checked-in migration with `npm run db:migrate`, then run `npm run db:generate`. For production, back up the database, run `npm run db:deploy` in your release process, generate the client with `npm run db:generate`, and build/restart with the updated application. Apply the migration before serving updated code. These commands mutate the selected database and must be run intentionally by the operator; automated feature verification does not run them.

Uploads accept one JPEG, PNG, or WebP up to 3 MB, validate decoded bytes, and use Cloudinary folder `asimon/products` with automatic format/quality. Bulk saves use a shared selected photo but upload independently owned assets per product. Invalid files do not save details; configured remote upload failures save details, retain an existing photo, and return a visible warning.

Purchases capture immutable photo URLs and internal asset IDs alongside existing name/category snapshots. The migration backfills only purchases whose product and tenant match. Removing/replacing a product photo does not alter history. Archive/restore and the 10-day recoverable delete preserve photo references. Permanent deletion, history deletion, replacement, failed saves, and retention purge perform best-effort cleanup after persistence: an asset is destroyed only when neither products nor purchases reference it, including archived/soft-deleted rows across all tenants. Cleanup failures are logged and do not reverse successful actions. Logs should be monitored for failed cleanup; there is no durable automatic orphan retry queue.

The production image CSP permits only self/data/blob and `https://res.cloudinary.com`. Notification HTML includes escaped, trusted Cloudinary images; readable product details remain in HTML and plain text if images cannot load.

## Deterministic verification

The default suite uses Vitest and mocked persistence, so it does not require PostgreSQL or Mailpit:

- `npm test` — run all unit, route, and deterministic data-access/integration-boundary tests. The live auth test is explicitly skipped unless opted in.
- `npm run typecheck` — check server and frontend TypeScript diagnostics.
- `npm run build` — run type checks, build the frontend, and compile the server.

The route tests cover validation envelopes, anti-enumeration responses, same-origin rejection, session-cookie behavior, protected dashboard access, and tenant-scoped mutation outcomes. Data-access tests verify tenant predicates, archived/deleted exclusion, immutable expense snapshots, and stale-write handling.

Stock notification email is optional. Set `NOTIFY_EMAIL_TO` as the fallback recipient and `NOTIFY_TIMEZONE` (default `Asia/Manila`) for timestamps. A signed-in user can override the recipient and enable or disable added, deleted, and changed notifications from Settings. Notifications are sent asynchronously after successful persistence; email failures are logged without changing the successful API response.

The repository does not define a separate live database integration command: persistence-boundary tests use deterministic database mocks so the default suite remains repeatable without PostgreSQL. The live PostgreSQL boundary is exercised by the opt-in Mailpit authentication flow after migrations are applied.

## Optional Mailpit authentication smoke test

Set `RUN_DEV_AUTH_FLOW=true` to enable `tests/dev-auth-flow.test.ts`. Before running it, start the server and Mailpit, apply the Prisma migrations, and configure an allowlisted email. The test uses these values (defaults shown):

- `AUTH_BASE_URL=http://localhost:3000`
- `APP_ORIGIN=http://localhost:5173`
- `MAILPIT_API_URL=http://localhost:8025`
- `ALLOWLIST_EMAIL` — required; must be present in the database allowlist

Run only the live flow with `npm run test:dev-auth-flow`. Without the opt-in flag, Vitest reports the test as skipped rather than silently treating it as verified. If enabled prerequisites are missing or an HTTP/mailbox assertion fails, the test fails with the endpoint and prerequisite context in its diagnostic message.

Do not enable this test in environments where the server, database, or Mailpit instance is not intentionally available.
