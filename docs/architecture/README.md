# Architecture — M0

โค้ดเป็น modular monolith ตาม spec; deploy backend เป็น Worker เดียวในอนาคต

```text
apps/web ────────────────→ contracts (Zod DTO)
    │ same-origin HTTP        ↑
    ▼                         │
apps/api ─────────────────────┘
    │ future use-case orchestration
    ├──→ domain (pure TypeScript + Decimal; no I/O)
    ├──→ market-data (port + mock adapter) ──→ contracts/domain
    ├──→ importers (port + synthetic parser) ─→ contracts/domain
    └──→ database (Drizzle + D1 binding)
```

ลูกศรจาก API ไป adapters เป็นเส้นทางที่จะต่อใน milestone ถัดไป M0 HTTP เปิดเพียง health และ typed error routes ยังไม่มี portfolio use cases หรือการ query provider/database จาก health

- Domain: `calculateMarketValue` ใช้ decimal.js clone precision 64; รับ string ที่มีจำนวนเต็มไม่เกิน 18 หลักและทศนิยมไม่เกิน 12 หลัก (รวมสูงสุด 30 significant digits ต่อ operand) ผลคูณจึงไม่สูญเสีย precision ไม่มี rounding ก่อนแสดงผล ใช้ ROUND_HALF_EVEN เป็นค่าตั้งต้นสำหรับงานอนาคต; ไม่ใช่นโยบาย rounding ของ Dime ที่ยืนยันแล้ว
- Contracts: strict runtime validation ของ health, errors และ synthetic quote/import DTO; ค่าเงินเป็น string
- Importers: รับ synthetic JSON format ที่ระบุชัดเท่านั้น ส่ง draft NEEDS_REVIEW และ confirmable false เสมอ ไม่มี database writes หรือ real Dime support
- Market data: ชนิด port และ deterministic mock fixtures แยก identity ด้วย securityId/market/symbol ไม่มี fetch
- Database: รับ D1 binding จาก composition root ไม่เปิด connection หรือคำนวณกฎการเงิน
- API: route → health use case → validated DTO และ middleware สำหรับ errors ไม่มี private-data endpoints ใน M0
- Web: แสดง placeholder และเรียก `/api/health` ผ่าน shared Zod contract ไม่มีสูตรการเงินหรือ keys

Local dev ใช้ Vite :5173 proxy `/api` ไป Wrangler :8787; local preview ใช้ :8787 origin เดียวให้ static SPA + API แยก React/Hono source roots ชัดเจนโดยไม่เพิ่ม deployment units

รายละเอียด: ADR [0001](../adr/0001-modular-monolith.md), [0002](../adr/0002-single-d1.md), [0003](../adr/0003-api-provider-configuration.md)
