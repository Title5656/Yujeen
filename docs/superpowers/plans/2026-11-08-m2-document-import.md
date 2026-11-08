# M2 Document Import Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Leave changes reviewable in the current workspace; no publish, push or production deployment.

**Goal:** Extract documents locally, produce reviewable drafts, validate and deduplicate them against the M1 ledger, and separate quote/FX freshness.

**Architecture:** Keep extraction and versioned parsers in importers, DTO validation in contracts, preview/confirmation orchestration in API use cases, and confirmed financial calculations in the existing pure domain. Import UI operates locally until authentication exists; no private HTTP route is registered. The supplied request authorizes M2 beyond the original M0-only bootstrap instructions.

**Tech Stack:** Existing TypeScript strict/pnpm/React/Hono/D1/Vitest, PDF.js for local extraction if installation is available. Decimal financial values retain M1 precision.

**Spec:** PROJECT_SPEC.md sections 6, 7, 10, 12 (M2), docs/M1_REPORT.md and docs/adr/0004-financial-ledger-and-compressed-fifo.md; current user request.

## Global Constraints

- ค่าใช้จ่ายรายเดือน 0 บาท; no paid service, external OCR upload or production deployment.
- Transaction Ledger remains the source of truth; draft and preview never write ledger data.
- No real documents, passwords, raw extracted personal text, or account details in fixtures/logs/commits.
- Missing execution time/offset, sequence, price, quantity, fee/tax, status or identity means NEEDS_REVIEW, never a fabricated value.
- Real Dime format is unverified: no accessible attachment was returned by chat artifacts and no PDF exists in the workspace. Section 7.3 limits this delivery to parser interfaces and clearly labeled synthetic fixtures until a sample arrives.
- Keep M1 domain, append-only persistence, optimistic revision and atomic confirmation; no dashboard work.
- File/page/text/row bounds before expensive processing; use supported DIME US/USD only.

## Review Focus

- Two actual fills with identical economics must not collapse when sequence/fill evidence is absent.
- Reupload after reload must keep source IDs and document hash stable, including alias provenance.
- One missing/invalid row or changed ledger after preview must prevent partial confirmation.
- Encrypted, oversized, scanned or malformed PDF must stop safely without leaking contents/passwords.
- Quote and FX ages must be independent at exact boundaries, with quality/MOCK/reference FX semantics preserved.

## Task 1: Independent valuation freshness

**Files:** packages/domain/src/valuation.ts, valuation.test.ts.
**Interfaces:** ValuationContext { valuedAt, quoteMaxAgeMs, fxMaxAgeMs, fx? }.

- [x] Add regression cases: quote stale with fresh FX and fresh quote with stale FX; boundary and invalid thresholds.
- [x] Run `pnpm exec vitest run packages/domain/src/valuation.test.ts` and observe RED.
- [x] Trace ageStatus callers, replace shared threshold, migrate callers, rerun GREEN.

## Task 2: Bounded extraction and draft contracts

**Files:** packages/contracts/src/document-import.ts; packages/importers/src/extraction.ts, pdf-extractor.ts, dime-parser.ts, synthetic-parser.ts and tests; synthetic test utilities only.
**Interfaces:** ExtractedDocument (SHA256/pages/lines/method), ParsedImport (version/mode/review drafts), DimeParser.parse(document), SyntheticDimeParser.parse(document).

- [x] Test magic bytes, hashing, text/page/file limits, password required/incorrect, corrupt and image-only PDF.
- [x] Test synthetic fill-level data, exact decimal strings, evidence locations, missing fields and non-filled status. Real unverified layouts always NEEDS_REVIEW.
- [x] Observe RED then implement schemas and extraction/parser adapters; preserve existing M0 mock contract.
- [x] Test actual PDF.js against synthetic PDF bytes; no private document is a CI dependency.

## Task 3: Preview, deduplication and internal confirmation

**Files:** packages/importers/src/preview.ts; apps/api/src/modules/imports/preview-import.ts, confirm-import.ts; Node tests and apps/api/test/import.worker.test.ts.
**Interfaces:** buildImportPreview(parsed, context, snapshot); previewImport(repository, input); confirmImport(repository, input).

- [x] Test stable IDs, file/cross-file duplicates, aliases after reload, changed economics, missing sequence, identical fills, multiple buys and partial sale.
- [x] Test missing/unknown security/account mapping and ledger oversell/backdated errors; no silent filtering of bad rows.
- [x] Observe RED then implement preview statuses with M1 validation/fingerprints/merge/replay. Confirmation reparses and recomputes preview, requires explicit review and delegates atomic write to recordConfirmedTrades.
- [x] Integration test extraction → synthetic parser → preview → confirm → D1 reload → M1 position literal expectations, duplicates and rollback.
- [x] Assert unauthenticated import/ledger routes remain unavailable.

## Task 4: Import-only local UI

**Files:** apps/web/src/features/imports/*, import route branch in App.tsx, package links and narrow boundary lint adjustment; tests/smoke/import.spec.ts.

- [x] Add browser tests for PDF selection/extraction, local password field, unsupported/missing review, no upload requests/storage, clear/reset and mobile overflow.
- [x] Implement local file picker and review; real Dime confirmation disabled until verified format and authentication.
- [x] Run built browser smoke tests including existing foundation tests.

## Task 5: Measurement, documentation and full verification

**Files:** scripts/benchmark-import.ts (or equivalent runnable Node benchmark), package.json; docs/adr/0005-document-import-review-boundary.md, docs/M2_REPORT.md, docs/M2_FILES.md, README.md.

- [x] Run deterministic 1,000/10,000+ synthetic transaction parse/dedup/replay measurement; check literal quantity/basis/realized results before reporting timing. No optimization before measurement.
- [x] Document real sample proof checklist and M1 mapping, policy uncertainties, limits, measured results and remaining authentication/OCR limitations.
- [x] Run CI commands: frozen install, lint, format check, typecheck, complete Node/Workers suite, build and Playwright smoke. Record actual results and environmental blockers.
- [x] Final independent code review, fix material findings with RED→GREEN tests, inspect git diff/secret hygiene. No unrelated UI changes.

## Execution notes

- Baseline: 200 Node tests passed. Workers cannot start in restricted sandbox (EPERM Wrangler log path and cloudflare:test-internal), matching the M1 report; rerun local emulator with appropriate tool permission before concluding.
- No worktree created: this is the user-selected clean feature checkout `codex/m0-project-foundation`, not main; preserve the shared workspace and leave diff uncommitted for review.

- Final: 287 Node + 22 Workers/D1 + 14 browser tests passed after reviewed-revision pinning. Real Dime acceptance remains blocked by missing sample. Reviewer minor on in-flight decoder lifecycle regression coverage is explicitly deferred in M2_REPORT; no demonstrated decoder failure.
