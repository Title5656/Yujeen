# ไฟล์ M1

## Domain — เพิ่ม

- `packages/domain/src/decimal.ts`: Decimal clone และ precision/allocation policy
- `packages/domain/src/trade.ts`, `trade.test.ts`: entities, normalized validation, dates และ fingerprint
- `packages/domain/src/ledger.ts`, `ledger.test.ts`: duplicate/conflict detection และ durable identity aliases
- `packages/domain/src/repository.ts`: persistence port, snapshot และ revision conflict
- `packages/domain/src/positions.ts`, `positions.test.ts`: chronological compressed FIFO, lots, positions และ realized P/L
- `packages/domain/src/valuation.ts`, `valuation.test.ts`: quote valuation, unrealized P/L, freshness และ FX policy

แก้ `packages/domain/src/index.ts` export APIs และ `market-value.ts` ใช้ Decimal policy ร่วมกัน โดยรักษา API/ผลตัวอย่าง M0

## Contracts / Application — เพิ่ม

- `packages/contracts/src/trade.ts`, `trade.test.ts`: strict confirmed trade/batch DTO; แก้ `src/index.ts` export schemas/types
- `apps/api/src/modules/transactions/record-confirmed-trades.ts`, `record-confirmed-trades.test.ts`: internal orchestration, replay/conflicts และ bounded retries
- `apps/api/test/ledger.worker.test.ts`: real D1 integration และ concurrency/regression tests

แก้ `apps/api/test/runtime.worker.test.ts`, `test/env.d.ts`, `vitest.worker.config.ts` ให้ใช้ migration set จริงและ reset storage แยกแต่ละ test

## Database — เพิ่ม/แก้

- แก้ `packages/database/src/schema.ts`: accounts, securities, imports, canonical trades, trade sources, audit และ constraints/indexes
- เพิ่ม `packages/database/src/transaction-repository.ts`: validated snapshots, atomic appends, provenance และ revision guard
- แก้ `packages/database/src/index.ts` export schema/repository
- เพิ่ม `packages/database/migrations/0001_m1_ledger.sql`, `0002_m1_trade_sources.sql`, `0003_m1_ledger_indexes.sql` และ metadata `meta/0001_snapshot.json`, `meta/0002_snapshot.json`, `meta/0003_snapshot.json`; แก้ `meta/_journal.json` มี security index และ immutable/source-identity triggers ใน migration SQL
- แก้ `packages/database/package.json`, `apps/api/package.json`, `pnpm-lock.yaml` เพิ่ม workspace dependencies ที่จำเป็น ไม่มี external dependency ใหม่

## เอกสาร — เพิ่ม/แก้

- เพิ่ม `docs/adr/0004-financial-ledger-and-compressed-fifo.md`: สูตร, precision, ordering, idempotency, persistence และ FX/ข้อจำกัด
- เพิ่ม `docs/superpowers/plans/2026-11-08-m1-financial-domain.md`: แผนและหลักฐานการตัดสินใจของรอบนี้
- เพิ่ม `docs/M1_REPORT.md`, `docs/M1_FILES.md`
- แก้ `README.md`, `docs/architecture/README.md` ให้ตรงกับสถานะ M1

Source ใน `apps/web`, mock import parser และ market adapters ไม่มีการแก้ ไม่มี public ledger route, production config, credentials หรือเอกสารลงทุนจริง
