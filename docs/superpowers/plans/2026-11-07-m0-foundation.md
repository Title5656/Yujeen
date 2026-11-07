# M0 Project Foundation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Track evidence below; do not advance to M1.

**Goal:** Deliver the executable M0 foundation specified in PROJECT_SPEC.md §12 and CODEX_START.md.

**Architecture:** A modular monolith in a pnpm workspace. React/Vite and Hono/Workers are separate apps; pure domain, boundary contracts, importer/provider adapters, and D1 persistence have explicit package boundaries. Vite proxies /api locally; Wrangler serves the built SPA and API together for local preview.

**Tech Stack:** Node 24, pnpm 11, TypeScript strict, React, Vite, Hono, Zod, decimal.js, Drizzle/D1, Vitest, ESLint, Prettier, GitHub Actions.

**Spec:** PROJECT_SPEC.md, AGENTS.md, CODEX_START.md (read in full from the supplied archive before creating project files).

## Global Constraints

- Implement M0 only; no ledger engine, real Dime parser, provider credentials, authentication implementation, deployment, or paid services.
- Mock/synthetic data only. Domain cannot depend on framework, HTTP, database, or provider runtime.
- Decimal strings at financial boundaries; deterministic offline tests.
- One database technology: Cloudflare D1. No account creation or remote database provisioning.
- Preserve the three supplied source documents unchanged.

## Review Focus

- Invalid financial values (negative, nonfinite, excess precision) must fail rather than silently round inputs.
- Unknown securities must not receive a fabricated mock quote; quote identity includes market.
- Mock import input must not be presented as a real Dime document or become confirmed ledger data.
- /api unknown routes must return typed JSON errors, including browser navigations, rather than SPA HTML.
- A clean checkout must pass the documented commands without production bindings or secrets.

## Task 1: Executable workspace and pure core

**Files:** Root configuration, packages/domain, packages/contracts, eslint.config.js, vitest.config.ts.
**Produces:** calculateMarketValue(quantity: string, price: string): string; HealthResponseSchema; ApiErrorSchema; validated quote DTO.

- [x] Configure workspace, exact compatible versions, strict typechecking, lint/format and build scripts.
- [x] Write Decimal and contract tests before their implementations; observe failures, then pass them.
- [x] Decimal tests: 0.1 × 0.2 = 0.02, fractional values, zero quantity, invalid/negative/nonfinite input and input scale bounds.
- [x] Contract tests: accept {status: 'ok'}, reject unknown health status and malformed quote/error data.

## Task 2: Offline adapters and database seam

**Files:** packages/market-data, packages/importers, packages/database.
**Consumes:** domain identifiers and contracts; **Produces:** MarketDataProvider, deterministic MockProvider; DocumentImporter and synthetic MockParser; Drizzle schema/client factory.

- [x] Write provider/parser tests, observe RED, implement, verify GREEN.
- [x] Test stable provenance/timestamps, unsupported symbols/markets, no mutable shared fixture leakage, and mock-only importer rejection.
- [x] Add a deliberately minimal schema-version table and local migration; full portfolio tables are M1.
- [x] Verify local migration on an actual local D1 binding and document the production-free workflow.

## Task 3: Web/API integration

**Files:** apps/api/src/{app,index,modules/health, middleware}; apps/web/src/{app,components,lib}; Wrangler/Vite configurations.
**Consumes:** shared HealthResponseSchema and ApiErrorSchema; **Produces:** GET /api/health → {status:'ok'}, typed safe errors, accessible Thai placeholder SPA with six menu destinations.

- [x] Test health and unknown API routes before route implementation; test unexpected errors do not disclose internals.
- [x] Implement health use case and route separately; keep portfolio operations absent.
- [x] Implement responsive Thai shell, clear M0/MOCK status, working temporary menus, live API health loading/success/error states.
- [x] Build web before Workers assets; preview the combined build locally; verify health, API 404 and SPA deep links.

## Task 4: Delivery, CI and final verification

**Files:** .github/workflows/ci.yml, README.md, docs/adr/0001-modular-monolith.md, 0002-single-d1.md, 0003-api-provider-configuration.md, docs/architecture/README.md, docs/api/README.md, docs/M0_REPORT.md.

- [x] Add CI with frozen lockfile and lint, formatting, typecheck, tests and build; no secrets or deploy steps.
- [x] Document package dependency direction, local dev/preview commands, constraints and future joint deployment plan with official references.
- [x] Run pnpm install, pnpm lint, pnpm typecheck, pnpm test, pnpm build and report actual exit codes and counts.
- [x] Perform independent final code review and resolve material findings.
- [x] Deliver file tree, actual verification evidence, remaining limitations and M1 acceptance criteria in Thai.

## Execution record

- Workspace baseline: empty directory; no existing repository or code to overwrite. Node 24.15.0 and pnpm 11.25.0 are installed. No baseline test suite exists.
- The supplied design and direct instruction authorize M0 execution; no additional design approval is needed. Implement in the current empty workspace.
- Registry access requires sandbox network approval; no service subscription or paid resource is involved.
- Git discovery traverses an inaccessible parent directory in the sandbox; do not alter global Git settings.

- Task 1: complete — strict workspace, exact Decimal and Zod contracts; core tests pass.
- Task 2: complete — deterministic provider/parser; Drizzle-generated SQL + metadata; actual local D1 integration passes.
- Task 3: complete — Thai shell and API; pnpm dev direct/proxy health pass; combined preview desktop/mobile checks pass.
- Task 4: complete — CI configuration, ADRs, architecture/API docs and Thai delivery report. Final install/lint/format/typecheck/test/build/smoke all exit 0. Tests: 57 Node + 2 Workers/D1 + 8 browser.
- Final independent review: no Critical/Important/Minor findings. Hosted CI and later milestones explicitly deferred.
- Git repository initialized on codex/m0-project-foundation; no commit or remote. Source documents hash-match archive.
