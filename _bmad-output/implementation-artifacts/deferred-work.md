- source_spec: `_bmad-output/implementation-artifacts/spec-delete-stocks-with-history-confirmation.md`
  summary: Add automated component coverage for the Settings stock-deletion countdown and focus behavior.
  evidence: The feature is covered by documented manual checks plus backend tests, but no frontend test harness currently exercises the timer, cancellation, focus, or accessibility state transitions.
- source_spec: none
  summary: Build the user-owned product catalog with add, edit, and archive behavior.
  evidence: Deferred from the whole-app build so foundation and authentication can be implemented first.
- source_spec: none
  summary: Build the expense ledger with historical product/category snapshots and soft deletion.
  evidence: Deferred from the whole-app build so foundation and authentication can be implemented first.
- source_spec: none
  summary: Build the spending dashboard with totals, time-series, product, and category aggregates.
  evidence: Deferred from the whole-app build so foundation and authentication can be implemented first.
- source_spec: none
  summary: Add full testing and capstone documentation outputs after the core application features are implemented.
  evidence: Deferred from the whole-app build so foundation and authentication can be implemented first.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-product-catalog.md`
  summary: Add database-backed product persistence and migration verification.
  evidence: Product unit and route tests mock persistence; real PostgreSQL verification belongs in Epic 5 integration coverage.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-product-catalog.md`
  summary: Add browser-level product catalog interaction tests.
  evidence: The repository has no client test harness; active/archived search, form, conflict, and archive flows require Epic 5 E2E coverage.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-product-catalog.md`
  summary: Expand product route tests for successful archive/update/create and malformed request cases.
  evidence: Current route tests cover representative auth, validation, origin, listing, and stale-update behavior; comprehensive API coverage is deferred to Epic 5.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-expense-ledger.md`
  summary: Add live PostgreSQL persistence/integration coverage for expense snapshots, tenant isolation, concurrency, and soft deletion.
  evidence: Expense unit and route tests cover the service and HTTP contracts; Prisma client generation and migration deployment passed, while real database scenario coverage is deferred to Epic 5.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-expense-ledger.md`
  summary: Add browser-level expense ledger flow tests.
  evidence: The repository has no client test harness; create/edit/product-change/filter/conflict/delete UI flows are deferred to Epic 5 E2E coverage.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-dashboard.md`
  summary: Optimize or code-split the Recharts client bundle.
  evidence: The production build reports a non-blocking bundle-size warning; bundle optimization is outside the dashboard acceptance criteria.
- source_spec: `_bmad-output/implementation-artifacts/spec-settings-delete-stocks-history.md`
  summary: Add automated frontend/browser coverage for Settings confirmation, deletion feedback, and post-delete refresh flows.
  evidence: The repository has no client test harness; the required flows are documented in FrontEnd/DASHBOARD-MANUAL-CHECKS.md pending the planned E2E testing phase.
