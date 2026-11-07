# M1 Financial Domain & Transaction Engine Implementation Plan

> **For agentic workers:** Use test-driven implementation and independent review. Work only within the authorized M1 scope.

**Goal:** Rebuild deterministic positions and P/L from an immutable, idempotent confirmed-trade ledger stored in local D1.

**Architecture:** Preserve the M0 modular monolith. Domain owns financial rules and ledger identity; contracts validate boundaries; API use cases orchestrate a repository port; D1 implements atomic persistence. No new HTTP routes or UI until authorization exists.

**Tech Stack:** Existing strict TypeScript, decimal.js, Zod, Drizzle, D1, Vitest and @cloudflare/vitest-plugin. No new external dependency or paid service.

**Spec:** PROJECT_SPEC.md sections 3, 6 and M1; owner's explicit M1 instruction supersedes first-run M0-only wording.

## Decisions and review focus

- Decimal inputs keep M0 limits: 18 integer / 12 fractional digits. Clone precision 96; cost allocations round HALF_EVEN to 24 fractional digits; final lot depletion consumes the exact residual. No cent rounding inside the engine.
- DIME US/USD only for this cost policy; other accounts/securities are distinct and unsupported policies fail explicitly.
- Trading dates use America/New_York provisionally, explicit execution timestamp with offset required. Validate real dates; no dependency on machine timezone.
- Compress buys before a sale on the same trading day; later buys never finance earlier sales or retroactively change realized P/L. Equal timestamps use explicit execution sequence; ambiguous ordering fails. This intraday policy requires M2 reconciliation.
- Fingerprint v1 uses account/security/side/instant/sequence/quantity/price/fee/tax/currency; external fill reference and document hash/row provide additional identity. Conflicting replays fail; valid replays do not append.
- Current FX is reference valuation only. Historical THB realized P/L stays unavailable when execution cash flows/cost FX are absent. Missing quotes/FX are unavailable rather than zero.
- Append-only ledger in M1. Corrections are rejected; an audited correction workflow is deferred. Creation provenance and audit events persist atomically.
- Review: concurrent oversells, cross-file duplicate fills vs legitimate identical fills, fees in wrong currency, backdated rows, repeating-decimal residuals and same-day sell/rebuy ordering.

## Task 1 — Domain types, validation, identity and financial engine

Files: packages/domain/src/{decimal,trade,ledger,positions,valuation}.ts and adjacent tests; index.ts and market-value.ts.

- [x] Add failing tests using literal hand calculations: Dime daily lot example remaining cost 770; partial sale with fees; fractional shares; repeating thirds; complete liquidation; missing/stale quotes; reference FX; invalid status/date/currency/oversell; account/security isolation.
- [x] Implement Trade, validateTrade, mergeLedger, rebuildPositions, valuePosition, and repository port. Pure domain has no contracts/runtime/DB imports.
- [x] Run `pnpm exec vitest run packages/domain/src` through RED then GREEN (also direct installed Vitest where the package wrapper attempted network refresh).

## Task 2 — Validated contracts and application orchestration

Files: packages/contracts/src/trade.ts, apps/api/src/modules/transactions/*, package manifests/lockfile for workspace links only.

- [x] Define strict filled-trade DTO, import provenance and confirmed-batch boundary. Reject missing price/fee, pending/cancelled and arbitrary fields.
- [x] Implement internal recordConfirmedTrades use case: validate, snapshot read, deduplicate, rebuild to prevent oversell, atomic append guarded by account revision, bounded retries on revision conflict.
- [x] Test whole-file replay, cross-file replay, conflict, all-or-nothing invalid batch and concurrency with literal results. No HTTP exposure.

## Task 3 — D1 schema, migration and repository

Files: packages/database/src/{schema,transaction-repository}.ts, migrations/0001*, apps/api/test/ledger.worker.test.ts.

- [x] Write and run failing local Workers/D1 integration tests before repository implementation.
- [x] Add accounts/securities/transactions/import_batches/audit_events with text decimals, FK, scoped uniqueness and indexes; immutable rows and atomic version-guarded append.
- [x] Apply real migrations with plugin utilities; verify rollback, duplicate constraints, conflict, concurrent writes, rebuild from persisted ledger and old M0 migration compatibility.
- [x] Generate Drizzle metadata; check no schema drift and apply local migration CLI.

## Task 4 — Documentation and final verification

Files: docs/architecture/README.md, docs/adr/0004*, README.md, docs/M1_REPORT.md and docs/M1_FILES.md.

- [x] Document formulas, ordering/precision/FX assumptions and Dime source limits, persistence contract, M2 handoff and local commands.
- [x] Independent review of final code path and financial expectations; resolve material findings with regression tests.
- [x] Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`; report actual results.

## Execution record

- Initial working tree clean; existing branch codex/m0-project-foundation. Work in current authorized workspace; do not commit, push or create a worktree for this request.
- Baseline: Node 57 tests pass. Worker sandbox fails startup/log permissions; same unchanged Worker suite outside sandbox passes 2 tests. No package/config change needed.
- Ruling: proceed under owner's explicit instruction to complete M1; existing spec supplies approved requirements. Routine implementation choices are documented here and in ADR rather than introducing approval stops.
- Ruling: persist every reviewed duplicate source in trade_sources (migration 0002), including aliases learned cross-file; canonical ledger alone loses later conflict detection. Snapshot/port include aliases, append receives all sources.
- Review regression: same-document replay must preserve the complete source identity set and parser version; reject enriched replays pending an audited M2 reparse workflow. Direct adapter source-identity conflicts also rollback via SQL trigger.
- Added security index in generated migration 0003; no schema drift. Final verification: lint/format/typecheck/build exit0, 200 Node +16 Worker tests passed; full evidence and limitations in docs/M1_REPORT.md.
