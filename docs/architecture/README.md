# Architecture — M2 และการแก้ฐานก่อน M3

โค้ดเป็น modular monolith ตาม spec; deploy backend เป็น Worker เดียวในอนาคต

```text
apps/web ────────────────→ contracts (Zod DTO)
    │ same-origin HTTP        ↑
    ▼                         │
apps/api ─────────────────────┘
    │ internal use-case orchestration
    ├──→ domain (pure TypeScript + Decimal; no I/O)
    ├──→ market-data (port + mock adapter) ──→ contracts/domain
    ├──→ importers (local extraction + template parser) ─→ contracts/domain
    └──→ database (Drizzle + D1 binding)
```

HTTP ยังเปิดเพียง health และ typed error routes ไม่มี private-data endpoints ก่อน authentication ส่วน M1 เพิ่ม internal `recordConfirmedTrades` ที่ทดสอบโดยเรียกตรงและผ่าน D1 repository; health ไม่ query provider/database

- Domain: confirmed ledger validation, canonical fingerprint/merge, repository port, daily compressed FIFO replay และ valuation ใช้ decimal.js clone precision 96 / HALF_EVEN; inputs 18 integer/12 fractional digits, partial allocation 24 fractional digits, final lot consumes residual ไม่ทำ I/O หรือ import contracts execution fills คงลำดับเดิม; DOCUMENT_DATE orders ไม่สร้างเวลา/sequence และใช้ reported gross/net เมื่อข้อมูลลำดับ/ประวัติไม่พอให้ cost/P&L unavailable พร้อมเหตุผล
- Contracts: strict runtime validation ของ health/errors/synthetic quote/import และ confirmed trades/import metadata; ค่าเงินเป็น string ตรวจ FILLED, currency, calendar/NY trading date และความสัมพันธ์ account/batch
- Importers: bounded PDF.js extraction ใน browser/local ผ่าน subpath `@portfolio/importers/pdf` เก็บ page/ตำแหน่งข้อความเพื่อแยกคอลัมน์ USD/THB; versioned DimeParser รองรับเฉพาะ Confirmation Note template ที่มีหลักฐานและส่ง unsupported/missing/ambiguous fields ไป NEEDS_REVIEW ไม่มี trade ที่เดาขึ้น; synthetic fixtures แต่งค่าใหม่ทั้งหมด; preview ไม่มี database writes และไม่อ้าง OCR/ทุก layout
- Market data: ชนิด port และ deterministic mock fixtures แยก identity ด้วย securityId/market/symbol ไม่มี fetch
- Database: D1/Drizzle persistence ของ Ledger ที่มี execution fills และ DOCUMENT_DATE orders ในบัญชีเชิงตรรกะเดียว; decimal เป็น TEXT, scoped unique/FK/indexes, append-only triggers; source provenance เก็บทุกบรรทัดและ duplicate aliases แยกจากยอดหุ้น snapshot ผ่าน first-primary session และ atomic append ผ่าน expected account revision ไม่มีสูตรการเงิน
- API: `previewImport`/`confirmImport` เป็น internal use cases; reparse/re-read/revalidate และ explicit review ก่อนส่ง `recordConfirmedTrades` รับ validated batch → snapshot → merge/dedup → rebuild ป้องกัน oversell → atomic append; retry revision conflict สูงสุด 3 ครั้ง ไม่เปิด private routes
- Web: หน้า Import ตรวจ PDF/รหัสผ่านในเครื่องและแสดง structured Review จาก template ที่รองรับ ไม่มี upload/persistence; ยังไม่ให้ยืนยันข้อมูลจริงเพราะรอ auth หน้าอื่นเป็น placeholder และเรียก `/api/health` เช่นเดิม ไม่มีสูตรการเงินหรือ keys

Local dev ใช้ Vite :5173 proxy `/api` ไป Wrangler :8787; local preview ใช้ :8787 origin เดียวให้ static SPA + API แยก React/Hono source roots ชัดเจนโดยไม่เพิ่ม deployment units

รายละเอียด: ADR [0001](../adr/0001-modular-monolith.md), [0002](../adr/0002-single-d1.md), [0003](../adr/0003-api-provider-configuration.md)

M1: [ADR 0004 — Ledger, precision, intraday policy และ historical FX](../adr/0004-financial-ledger-and-compressed-fifo.md) บันทึกสูตรและสมมติฐานที่ยังต้องเทียบเอกสาร Dime ใน M2 การแก้ธุรกรรมเดิมยังปฏิเสธแทนการแก้โดยไร้ audit; import parser และ market adapters เดิมยังเป็น MOCK เท่านั้น

M2 foundation รอบเดิม: [ADR 0005](../adr/0005-document-import-review-boundary.md) อธิบาย local extraction, review digest/stable source identity และขอบเขต unverified layouts Web เพิ่ม dependency ต่อ importers ตาม spec สำหรับการอ่านเอกสารเท่านั้น ส่วน ValuationContext รับ quoteMaxAgeMs/fxMaxAgeMs แยกกัน รอบนั้นยังไม่มีการเปลี่ยน Ledger schema หรือ cost policy

รอบแก้ฐานก่อน M3: [ADR 0006](../adr/0006-document-date-orders.md) ปรับ fill-only assumption และยอดเงินสำหรับ DOCUMENT_DATE หลังตรวจ template จริง แยก order reference ออกจาก fill reference, Effective Date ออกจาก Issue/Settlement, fee รวม VAT ออกจาก withholding และแสดงต้นทุนที่ยืนยันไม่ได้อย่างตรงไปตรงมา ADR 0004/0005 อธิบายสถานะรอบส่งมอบเดิม; ข้อที่เปลี่ยนอ่าน ADR 0006 ประกอบ

M3 Provider/FX/cache/Settings และ M4 Dashboard/กราฟยังเป็นแผน Authentication/Authorization ต้องมาก่อน private endpoint แรก แม้งานสิทธิ์เต็มชุดอยู่ใน M5 ไม่เปิด import/ledger/Settings transport ก่อน gate นี้ ดู [M3_READINESS_PLAN](../M3_READINESS_PLAN.md) การวัด Node benchmark ไม่แทน Workers/D1 CPU/quota measurement และไม่ใช่เหตุผลให้เปิด paid plan
