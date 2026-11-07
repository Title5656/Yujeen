# Personal Investment Portfolio Tracker

เว็บติดตามพอร์ตส่วนตัวภาษาไทย — **Milestone M0: Project Foundation เท่านั้น**

อ่าน [PROJECT_SPEC.md](PROJECT_SPEC.md), [AGENTS.md](AGENTS.md) และ [CODEX_START.md](CODEX_START.md) สำหรับข้อกำหนดฉบับเต็ม โค้ดตอนนี้เป็นฐานพัฒนาและข้อมูลจำลอง ไม่ใช่ระบบจัดการพอร์ตที่พร้อมใช้เงินจริง

## เริ่มใช้งานในเครื่อง

ต้องมี Node.js **24.15.0 ขึ้นไปในสาย 24** และ pnpm **11.25.0** (ระบุใน `packageManager`)

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
- `test` รัน Vitest แบบ Node สำหรับ core/contracts/adapters/API แล้วรัน Workers runtime tests ด้วย `@cloudflare/vitest-plugin` และ D1 จำลองในเครื่อง
- `build` compile packages → Vite SPA → Wrangler **dry-run** bundle เท่านั้น
- `pnpm format` จัดรูปแบบไฟล์ โดยไม่แก้เอกสารต้นฉบับทั้งสาม
- Browser smoke test เพิ่มเติม: `pnpm build` แล้ว `pnpm test:smoke` (Windows ใช้ Microsoft Edge ที่ติดตั้งไว้; CI ใช้ Chromium ของ Playwright)

## โครงสร้างและขอบเขต

```text
apps/
  web/              React/Vite, เมนูชั่วคราว 6 หน้า, ตรวจ API health
  api/              Hono routes, health use case, typed safe errors, Workers config
packages/
  domain/           Pure Decimal example และชนิดข้อมูลพื้นฐาน
  contracts/        Zod DTO และ runtime validation
  market-data/      Provider port + deterministic MockProvider
  importers/        DocumentImporter port + synthetic MockParser เท่านั้น
  database/         D1/Drizzle factory, schema-version table และ migration
tests/smoke/        Browser checks ของ web/API ที่ build แล้ว
docs/
  adr/              การตัดสินใจสถาปัตยกรรม
  architecture/     Dependency direction และวิธีเชื่อมสองแอป
  api/              HTTP contracts ปัจจุบัน
  M0_REPORT.md      หลักฐานส่งมอบ ผลตรวจจริง ข้อจำกัด และข้อเสนอ M1
.github/workflows/ci.yml
```

ดูรายละเอียดใน [Architecture](docs/architecture/README.md), [ADR](docs/adr/0001-modular-monolith.md) และ [รายงาน M0](docs/M0_REPORT.md)

## ฐานข้อมูลและ environment

ไม่ต้องมี `.env`, API key, Cloudflare account หรือ secret สำหรับ M0

```sh
pnpm db:migrate:local
```

ใช้ **D1 ในเครื่องเท่านั้น** สถานะอยู่ใน `apps/api/.wrangler/` ค่า UUID ศูนย์ใน config เป็น placeholder สำหรับ local emulator ไม่ใช่ฐานข้อมูล Production ตรวจ schema generation ได้ด้วย `pnpm --filter @portfolio/database db:generate` โดยไม่เชื่อม cloud

ตาราง `schema_versions` ใช้พิสูจน์ schema/migration/client seam เท่านั้น Full ledger schema เป็น M1; health ไม่ตรวจ database readiness และไม่แสดงข้อมูลพอร์ต

## สิ่งที่ยังไม่ทำ

ไม่มี Transaction Ledger, Compressed FIFO, การอ่าน Dime จริง, PDF/OCR, Provider ภายนอก, Settings สำหรับเก็บ key, authentication, cron, backup หรือ deployment เมนูทั้งหกแสดง placeholder เท่านั้น คำว่า MOCK หมายถึงข้อมูลจำลองจาก fixtures ไม่ใช่ข้อมูลราคาจริง

ห้ามนำข้อมูลจริงเข้า repository หรือเปิดใช้กับพอร์ตจริงก่อนระบบสิทธิ์ผ่านการทดสอบ ไม่มีคำสั่ง deploy ใน scripts และ CI ไม่มีขั้นตอน deploy ต้องประเมินสิทธิ์ข้อมูลและ Free Tier ใหม่ก่อน M5 ตามสเปก

งาน M1 ที่เสนอและเกณฑ์ตรวจรับอยู่ในรายงาน; **ยังไม่ได้ดำเนินการ M1**
