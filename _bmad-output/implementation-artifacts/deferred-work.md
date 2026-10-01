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
