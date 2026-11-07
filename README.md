# Personal Investment Portfolio Tracker

เว็บติดตามพอร์ตส่วนตัวภาษาไทย — **M1: Financial Domain & Transaction Engine** (พัฒนาต่อจากฐาน M0)

อ่าน [PROJECT_SPEC.md](PROJECT_SPEC.md), [AGENTS.md](AGENTS.md) และ [CODEX_START.md](CODEX_START.md) สำหรับข้อกำหนดฉบับเต็ม โค้ดตอนนี้เป็นฐานพัฒนาและข้อมูลจำลอง ไม่ใช่ระบบจัดการพอร์ตที่พร้อมใช้เงินจริง

## เริ่มใช้งานในเครื่อง

ต้องมี Node.js **24.15.0 ขึ้นไปในสาย 24** และ pnpm **11.25.0** (ระบุใน `packageManager`)

สำหรับ Windows PowerShell ที่ยังไม่มีคำสั่ง `pnpm` ให้ติดตั้งครั้งแรกด้วย npm ที่มากับ Node.js:

```powershell
npm.cmd install --global pnpm@11.25.0
pnpm --version
```

คำสั่งตรวจเวอร์ชันต้องแสดง `11.25.0` จากนั้นติดตั้ง dependencies และเปิดเว็บ:

```sh
pnpm install
pnpm dev
```

เปิดเว็บที่ <http://127.0.0.1:5173> และ API ที่ <http://127.0.0.1:8787/api/health> คำสั่ง dev build workspace และเว็บก่อนเริ่ม Vite กับ Wrangler พร้อมกัน กด Ctrl+C เพื่อหยุดทั้งคู่

การพัฒนา package ร่วม: หลังแก้ `packages/*/src` ให้รัน `pnpm build:packages` อีกครั้งเพื่อให้แอปอ่าน output ล่าสุด (ยังไม่มี package watch orchestration ใน M0)

แยกรันสอง terminal หลัง `pnpm build` ได้ด้วย:

```sh
pnpm --filter @portfolio/api dev
pnpm --filter @portfolio/web dev
```

Preview เว็บและ API ที่ build แล้วบน Workers runtime ในเครื่อง:

```sh
pnpm preview
```

เปิด <http://127.0.0.1:8787> คำสั่งนี้ build ก่อน แล้วใช้ Worker bundle ใน `apps/api/dist/index.js` และ static assets ใน `apps/web/dist` ไม่มีการ deploy หรือ login Cloudflare

## คำสั่งคุณภาพ

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

- `typecheck` และ `test` build packages ตาม dependency graph ก่อนเพื่อให้ใช้ได้ตั้งแต่ clean checkout
- `test` รัน Vitest แบบ Node สำหรับ financial domain/contracts/adapters/API use cases แล้วรัน Workers runtime tests ด้วย `@cloudflare/vitest-plugin` และ migrations จริงบน D1 จำลองในเครื่อง ไม่ใช้บัญชีหรือเอกสารจริง
- `build` compile packages → Vite SPA → Wrangler **dry-run** bundle เท่านั้น
- `pnpm format` จัดรูปแบบไฟล์ โดยไม่แก้เอกสารต้นฉบับทั้งสาม
- Browser smoke test เพิ่มเติม: `pnpm build` แล้ว `pnpm test:smoke` (Windows ใช้ Microsoft Edge ที่ติดตั้งไว้; CI ใช้ Chromium ของ Playwright)

## โครงสร้างและขอบเขต

```text
apps/
  web/              React/Vite, เมนูชั่วคราว 6 หน้า, ตรวจ API health
  api/              Hono health, internal confirmed-ledger use case, Workers config
packages/
  domain/           Pure Trade/identity, Compressed FIFO, positions, Decimal P/L และ valuation
  contracts/        Zod DTO และ strict validation ของ confirmed trades/import metadata
  market-data/      Provider port + deterministic MockProvider
  importers/        DocumentImporter port + synthetic MockParser เท่านั้น
  database/         D1/Drizzle ledger, provenance/audit, atomic repository และ migrations
tests/smoke/        Browser checks ของ web/API ที่ build แล้ว
docs/
  adr/              การตัดสินใจสถาปัตยกรรม
  architecture/     Dependency direction และวิธีเชื่อมสองแอป
  api/              HTTP contracts ปัจจุบัน
  M0_REPORT.md      หลักฐานส่งมอบ ผลตรวจจริง ข้อจำกัด และข้อเสนอ M1
  M1_REPORT.md      ผลตรวจ M1 สูตร ข้อจำกัด และสิ่งที่ต้องพิสูจน์ใน M2
.github/workflows/ci.yml
```

ดูรายละเอียดใน [Architecture](docs/architecture/README.md), [ADR M1](docs/adr/0004-financial-ledger-and-compressed-fifo.md), [รายงาน M1](docs/M1_REPORT.md) และ [ไฟล์ M1](docs/M1_FILES.md) รายงาน M0 เป็นประวัติของ milestone ก่อนหน้า

## ฐานข้อมูลและ environment

ไม่ต้องมี `.env`, API key, Cloudflare account หรือ secret สำหรับการพัฒนาและทดสอบ M1

```sh
pnpm db:migrate:local
```

ใช้ **D1 ในเครื่องเท่านั้น** สถานะอยู่ใน `apps/api/.wrangler/` ค่า UUID ศูนย์ใน config เป็น placeholder สำหรับ local emulator ไม่ใช่ฐานข้อมูล Production ตรวจ schema generation ได้ด้วย `pnpm --filter @portfolio/database db:generate` โดยไม่เชื่อม cloud

Migrations ต่อจาก `schema_versions` ของ M0 เพิ่ม accounts, securities, import_batches, transactions, trade_sources และ audit_events ค่าเงินเก็บเป็น TEXT; การบันทึกใช้ revision guard และ atomic batch ไม่เปิดให้แก้/ลบ Ledger โดยตรง health ไม่ตรวจ database readiness และไม่แสดงข้อมูลพอร์ต

## ใช้ Financial Domain ในโค้ด

`@portfolio/domain` export `validateTrade`, `mergeLedger`, `rebuildPositions` และ `valuePosition` โดยไม่ขึ้นกับ React, Hono หรือ database หลัง build packages ใช้ `rebuildPositions(confirmedTrades)` สร้าง positions ใหม่จาก Ledger ส่วน `valuePosition(position, quote, context)` รับ quote ที่ caller ส่งให้และไม่เรียก API ใด ๆ

Internal use case อยู่ใน `apps/api/src/modules/transactions/record-confirmed-trades.ts` รับ repository port และ confirmed batch ที่ผ่าน review แล้ว ทดสอบการเชื่อมกับ `createD1TransactionRepository(DB)` ใน Workers/D1 emulator ยังไม่มี HTTP หรือ UI สำหรับเรียกใช้ จึงยังไม่ใช่หน้า Import ที่เจ้าของอัปโหลดไฟล์ได้

Compressed FIFO ใช้ต้นทุนซื้อรวม fee/tax และตัดขาย FIFO; partial allocation ปัด HALF_EVEN ที่ 24 ตำแหน่งและตัด residual เต็มเมื่อ lot หมด ใช้ NY trade date และลำดับ execution ที่ระบุชัดเป็นนโยบายชั่วคราวจนกว่าจะเทียบเอกสาร Dime; Current FX เป็น THB reference เท่านั้น historical THB realized P/L เป็น unavailable ดูสูตรและตัวอย่างใน ADR M1

## สิ่งที่ยังไม่ทำ

ยังไม่มีการอ่าน Dime จริง, PDF/OCR, Import workflow/UI, Provider ภายนอก, Settings สำหรับเก็บ key, authentication, cron, backup หรือ deployment เมนูทั้งหกยังเป็น placeholder ของ M0 คำว่า MOCK หมายถึงข้อมูลจำลองจาก fixtures ไม่ใช่ข้อมูลราคาจริง

M1 รองรับ engine สำหรับ Dime หุ้น US/USD เท่านั้น ยังไม่รองรับการแก้รายการเก่า, หุ้นไทยใน cost engine, dividends/cash/transfers/corporate actions หรือ THB realized P/L จาก execution FX และยังไม่ยืนยันว่า intraday/rounding ตรง Dime ทุกกรณี

ห้ามนำข้อมูลจริงเข้า repository หรือเปิดใช้กับพอร์ตจริงก่อนระบบสิทธิ์ผ่านการทดสอบ ไม่มีคำสั่ง deploy ใน scripts และ CI ไม่มีขั้นตอน deploy ต้องประเมินสิทธิ์ข้อมูลและ Free Tier ใหม่ก่อน M5 ตามสเปก

งาน M2 และเกณฑ์ตรวจรับอยู่ในรายงาน M1; ยังไม่เริ่มพัฒนา M2
