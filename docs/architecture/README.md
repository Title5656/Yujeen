# Architecture — M1

โค้ดเป็น modular monolith ตาม spec; deploy backend เป็น Worker เดียวในอนาคต

```text
apps/web ────────────────→ contracts (Zod DTO)
    │ same-origin HTTP        ↑
    ▼                         │
apps/api ─────────────────────┘
    │ internal use-case orchestration
    ├──→ domain (pure TypeScript + Decimal; no I/O)
    ├──→ market-data (port + mock adapter) ──→ contracts/domain
    ├──→ importers (port + synthetic parser) ─→ contracts/domain
    └──→ database (Drizzle + D1 binding)
```

HTTP ยังเปิดเพียง health และ typed error routes ไม่มี private-data endpoints ก่อน authentication ส่วน M1 เพิ่ม internal `recordConfirmedTrades` ที่ทดสอบโดยเรียกตรงและผ่าน D1 repository; health ไม่ query provider/database

- Domain: Trade validation, canonical fingerprint/merge, repository port, daily compressed FIFO replay และ valuation ใช้ decimal.js clone precision 96 / HALF_EVEN; inputs 18 integer/12 fractional digits, partial allocation 24 fractional digits, final lot consumes residual ไม่ทำ I/O หรือ import contracts
- Contracts: strict runtime validation ของ health/errors/synthetic quote/import และ confirmed trades/import metadata; ค่าเงินเป็น string ตรวจ FILLED, currency, calendar/NY trading date และความสัมพันธ์ account/batch
- Importers: รับ synthetic JSON format ที่ระบุชัดเท่านั้น ส่ง draft NEEDS_REVIEW และ confirmable false เสมอ ไม่มี database writes หรือ real Dime support
- Market data: ชนิด port และ deterministic mock fixtures แยก identity ด้วย securityId/market/symbol ไม่มี fetch
- Database: D1/Drizzle schema accounts/securities/import_batches/transactions/trade_sources/audit_events; decimal เป็น TEXT, scoped unique/FK/indexes, append-only triggers; trade_sources เก็บทุกบรรทัดและ duplicate aliases แยกจากยอดหุ้น snapshot ผ่าน first-primary session และ atomic append ผ่าน expected account revision ไม่มีสูตรการเงิน
- API: `recordConfirmedTrades` รับ validated batch → snapshot → merge/dedup → rebuild ป้องกัน oversell → atomic append; retry revision conflict สูงสุด 3 ครั้ง ไม่เปิด routes/Import UI
- Web: แสดง placeholder และเรียก `/api/health` ผ่าน shared Zod contract ไม่มีสูตรการเงินหรือ keys

Local dev ใช้ Vite :5173 proxy `/api` ไป Wrangler :8787; local preview ใช้ :8787 origin เดียวให้ static SPA + API แยก React/Hono source roots ชัดเจนโดยไม่เพิ่ม deployment units

รายละเอียด: ADR [0001](../adr/0001-modular-monolith.md), [0002](../adr/0002-single-d1.md), [0003](../adr/0003-api-provider-configuration.md)

M1: [ADR 0004 — Ledger, precision, intraday policy และ historical FX](../adr/0004-financial-ledger-and-compressed-fifo.md) บันทึกสูตรและสมมติฐานที่ยังต้องเทียบเอกสาร Dime ใน M2 การแก้ธุรกรรมเดิมยังปฏิเสธแทนการแก้โดยไร้ audit; import parser และ market adapters เดิมยังเป็น MOCK เท่านั้น
