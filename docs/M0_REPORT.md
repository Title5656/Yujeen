# รายงานส่งมอบ M0 — Project Foundation

วันที่: 7 พฤศจิกายน 2026 · Workspace: `C:\Users\wpras\Desktop\Yujeen`

**สถานะ: M0 เสร็จตามเกณฑ์ที่ตรวจได้ในเครื่อง** ไม่ได้ดำเนินการ M1–M6, deploy, สมัครบัญชี หรือเปิดบริการเสียเงิน

## งานที่ทำ

อ่าน `PROJECT_SPEC.md` (556 บรรทัด), `AGENTS.md` และ `CODEX_START.md` ครบจาก archive ก่อนสร้างไฟล์โปรเจกต์ สำรวจแล้ว workspace ว่าง ไม่มี code/repository เดิม คัดลอกเอกสารทั้งสามมาไว้ที่ root และตรวจ SHA-256 ว่าตรงกับ archive ทุกไฟล์

สร้าง Git repository ใน branch `codex/m0-project-foundation` ไม่มี commit, remote, push หรือ PR การตรวจ Git ก่อน init เคยติด parent-directory permissions ใน sandbox; ไม่ได้แก้ global Git config

```text
Yujeen/
├── apps/
│   ├── web/
│   │   ├── src/app/                 App และเมนูชั่วคราว 6 หน้า
│   │   ├── src/components/          สถานะ API / ลองใหม่
│   │   ├── src/lib/api.ts           HTTP client + shared runtime validation
│   │   ├── src/styles.css           Responsive shell + Tailwind foundation
│   │   ├── public/favicon.svg
│   │   └── vite.config.ts
│   └── api/
│       ├── src/modules/health/      Health use case และ HTTP route
│       ├── src/middleware/errors.ts Typed safe errors
│       ├── src/app.ts               Composition ของ Hono app
│       ├── src/index.ts             Workers entry point
│       ├── test/                    Workers runtime + D1 integration
│       └── wrangler*.jsonc          Local assets/bindings และ test config
├── packages/
│   ├── domain/                     Types + exact Decimal example + tests
│   ├── contracts/                  Zod health/error/quote/synthetic-import DTO
│   ├── market-data/                Provider port, errors, MockProvider + tests
│   ├── importers/                  Importer port, review drafts, MockParser + tests
│   └── database/                   Drizzle D1 factory/schema/migration + metadata
├── tests/smoke/foundation.spec.ts   Desktop/mobile checks ของ combined build
├── .github/workflows/ci.yml
├── docs/adr/0001-modular-monolith.md
├── docs/adr/0002-single-d1.md
├── docs/adr/0003-api-provider-configuration.md
├── docs/architecture/README.md
├── docs/api/README.md
├── docs/superpowers/plans/2026-11-07-m0-foundation.md
├── docs/M0_FILES.md                 รายการไฟล์ส่งมอบทั้งหมด
├── README.md
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── tsconfig*.json / eslint.config.js / vitest.config.ts
└── .editorconfig / .gitignore / .prettier* / .node-version
```

ทุก package มี manifest และ strict TypeScript config ของตัวเอง ดู [รายการไฟล์ทั้งหมด](M0_FILES.md) และ [วิธีรัน](../README.md)

## ผลตรวจจริงรอบสุดท้าย

เครื่องที่ตรวจ: Windows, Node **24.15.0**, pnpm **11.25.0**, TypeScript **6.0.3** วันที่ 7 พฤศจิกายน 2026

| คำสั่งที่รันจริง                                                     | ผล          | หลักฐาน                                                                                                        |
| -------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm install --store-dir .pnpm-store`                               | ผ่าน exit 0 | ติดตั้ง workspace 8 projects; รอบแรกเพิ่ม 258 packages                                                         |
| `pnpm install --frozen-lockfile`                                     | ผ่าน exit 0 | รอบสุดท้าย lockfile ตรง ไม่มี package เปลี่ยน; [log](../.local/verification/install.log)                       |
| `pnpm lint`                                                          | ผ่าน exit 0 | ESLint ไม่มี error; [log](../.local/verification/lint.log)                                                     |
| `pnpm format:check`                                                  | ผ่าน exit 0 | ทุกไฟล์ที่ตรวจใช้ Prettier format; [log](../.local/verification/format.log)                                    |
| `pnpm typecheck`                                                     | ผ่าน exit 0 | Packages, web, API, Workers tests และ tool configs; [log](../.local/verification/typecheck.log)                |
| `pnpm test`                                                          | ผ่าน exit 0 | **57 Node unit tests + 2 Workers/D1 tests = 59 tests** ใน 6 test files; [log](../.local/verification/test.log) |
| `pnpm build`                                                         | ผ่าน exit 0 | Libraries → Vite SPA → Worker dry-run bundle; [log](../.local/verification/build.log)                          |
| `pnpm test:smoke`                                                    | ผ่าน exit 0 | **8 browser tests**: desktop 4 + mobile 4; [log](../.local/verification/smoke.log)                             |
| `pnpm --filter @portfolio/database db:generate --name m0_foundation` | ผ่าน exit 0 | Generate SQL, snapshot และ journal จริง                                                                        |
| `pnpm --filter @portfolio/database db:generate`                      | ผ่าน exit 0 | ตรวจซ้ำได้ `No schema changes, nothing to migrate`                                                             |
| `pnpm db:migrate:local`                                              | ผ่าน exit 0 | Apply `0000_m0_foundation.sql` บน D1 local สำเร็จ                                                              |
| `pnpm dev` และ HTTP probes                                           | ผ่านการตรวจ | API :8787 และ Vite proxy :5173 ตอบ `{"status":"ok"}`; `/settings` ผ่าน Vite ตอบ 200; หยุด servers หลังตรวจ     |

Browser tests รันบน Microsoft Edge headless ในเครื่อง ครอบคลุมเมนูหกหน้าและ reload deep links, API JSON 404 แม้เป็น navigation, health error/retry, invalid response validation, keyboard skip link และตรวจไม่มี horizontal overflow ของหน้า mobile ภาพ desktop/mobile ถูกเปิดตรวจด้วยตาแล้ว อยู่ใน `test-results/` ซึ่งไม่เข้า Git

Tests ของ core ครอบคลุม Decimal เศษหุ้น/ตัวเลขใหญ่, zero/negative/nonfinite/precision validation, strict DTO, deterministic quote provenance, identity ข้ามตลาด, unsupported securities, fixture mutation isolation, mock-only parser, missing price และ pending/cancelled ที่ไม่ถูก promote เป็น transaction

Log และ screenshot เป็น local artifacts ที่ถูก ignore ไม่ใช่ไฟล์ source สำหรับ commit ไม่มีเอกสารส่วนตัวหรือ API keys ใน fixtures

## การตัดสินใจทางสถาปัตยกรรม

1. **Modular monolith + pnpm**: แยกหน้าที่ตาม package แต่มี backend runtime เดียว ใช้ `workspace:*` และ export libraries จาก `dist`; root scripts build ตาม dependencies ก่อน typecheck/test/dev ไม่มี Nx/Turborepo หรือ microservices
2. **Domain บริสุทธิ์**: ใช้เพียง decimal.js และ TypeScript ตัวอย่าง `calculateMarketValue` ไม่คำนวณ Ledger/FIFO/FX รับ decimal string จำนวนเต็มไม่เกิน 18 หลักและทศนิยมไม่เกิน 12 หลัก ใช้ clone precision 64 เพื่อคูณ operands ตามขอบเขตนี้ได้ตรง ไม่มีการปัดเพื่อแสดงผลหรืออ้างนโยบาย Dime ล่วงหน้า
3. **Ports และ DTO**: MockProvider ใช้ securityId + market + symbol และส่ง source/feed/asOf/fetchedAt/dataMode; ไม่พบ fixture ให้ UNSUPPORTED MockParser รับ synthetic JSON ที่มี format tag เท่านั้น ส่ง NEEDS_REVIEW และ confirmable false เสมอ
4. **D1 ตัวเดียว**: M0 สร้างเพียง `schema_versions` เพื่อพิสูจน์ schema/client/migration seam ด้วย Drizzle และ local D1 ตารางการเงินจริงเป็นงาน M1
5. **เชื่อม Web/API**: Vite proxy `/api` → Wrangler ระหว่าง dev; preview ใช้ Worker JS ที่ build แล้ว + static SPA จากเว็บใน origin เดียว `run_worker_first` ครอบคลุม `/api` และ `/api/*` เพื่อรักษา JSON errors ส่วน SPA deep links fallback ไป index.html แนวทางนี้อ้างอิง [Cloudflare SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
6. **เครื่องมือที่เข้ากันได้**: pin exact versions และ lockfile เลือก TypeScript 6 เพราะ typescript-eslint ยังไม่รองรับ 7; settings ของ pnpm 11 อยู่ใน workspace YAML ตาม [เอกสาร pnpm](https://pnpm.io/settings); scripts ใช้ double quotes ที่ทำงานบน Windows พร้อม fail-if-no-match
7. **ไม่เชื่อมบริการจริงใน M0**: UI แสดง M0/MOCK, ไม่แสดงมูลค่าลงทุนสมมติเป็นข้อมูลจริง Settings ยังไม่มี key storage; แนวทางเลือก provider ที่รองรับและเข้ารหัส secrets ในอนาคตอยู่ใน ADR 0003

รายละเอียดเพิ่มเติม: [Architecture](architecture/README.md), ADR [0001](adr/0001-modular-monolith.md), [0002](adr/0002-single-d1.md), [0003](adr/0003-api-provider-configuration.md)

## ข้อผิดพลาดระหว่างพัฒนาและการตรวจทาน

- รอบก่อนมี implementation ทดสอบล้มเหลวจากโมดูลที่ยังไม่มี จากนั้นเพิ่มโค้ดและตรวจจน suite ผ่าน
- แก้ Windows workspace filter ที่ single quotes ทำให้ไม่เลือก package โดยใช้ double quotes และ `--fail-if-no-match`
- แก้ typecheck ให้แยก DOM ของ browser smoke tests, Node configs และ Workers types; แก้ type import ใน test environment ให้ผ่าน lint
- Worker tests ภายใน sandbox เคยเริ่มไม่ได้และ Wrangler เขียน config/log ไม่ได้ เมื่อรัน local tools นอก sandbox ด้วยสิทธิ์ที่ระบบอนุมัติ runtime ทำงานได้ ไม่ได้แก้ source ของ Cloudflare หรือปิด tests เพื่อให้ผ่าน
- D1 test เริ่มแรกใช้ `DB.exec` กับ SQL หลายบรรทัดแล้วถูกแยกไม่ถูกต้อง จึงใช้ prepared statement รันทดสอบ SQL ของ migration จริง และตรวจด้วย Wrangler migration CLI อีกทาง
- จัดรูปแบบ smoke test ที่เปลี่ยนล่าสุดแล้วรันชุดตรวจทั้งหมดซ้ำจนผ่าน
- ผู้ตรวจโค้ดอิสระอ่าน spec และ source/config แบบ read-only ไม่พบ Critical/Important/Minor findings ผู้ตรวจไม่ได้รัน full suite แทนผู้พัฒนา; ผลในตารางมาจากการรันจริงของผู้พัฒนา

## วิธีรันต่อ

```sh
pnpm install
pnpm dev
```

เปิด <http://127.0.0.1:5173> สำหรับ Vite + API proxy หรือใช้ `pnpm preview` เปิด <http://127.0.0.1:8787> เพื่อดู combined build บน Workers local ไม่ต้องใช้ Cloudflare account หรือ credentials

หลังแก้ `packages/*/src` ระหว่างเปิด dev ให้รัน `pnpm build:packages` เพื่ออัปเดต dist ปัจจุบัน M0 ยังไม่มี shared-package watch orchestration

## สิ่งที่ยังไม่เสร็จและข้อจำกัด

- **ยังไม่ได้รัน GitHub-hosted CI**: มี workflow และ local checks ครบ แต่ไม่มี remote/push; Linux/Chromium บน runner ยังไม่ได้ยืนยันจาก execution จริง
- **ไม่มีการ deploy**: ทดสอบ Wrangler dry-run และ Workers/D1 emulator ในเครื่องเท่านั้น ยังไม่ตรวจสิทธิ์ Free Tier ของบัญชีจริง
- Authentication/authorization, credentials encryption, real providers/FX, retry/quota, cron, backup/restore และ production operations ยังไม่อยู่ใน M0
- ยังไม่มี Transaction Ledger, Compressed FIFO, cost basis, P/L หรือ portfolio snapshots
- ยังไม่อ่าน Dime PDF/ภาพจริง, ไม่มี PDF.js/Tesseract หรือ upload flow และไม่มีข้อมูลส่วนตัวในชุดทดสอบ
- หน้า Dashboard/Holdings/Transactions/Import/Watchlist/Settings เป็น placeholder; shadcn/ui, charts และ query-cache integration รอ feature ที่ต้องใช้จริงตาม milestone
- Mock quote timestamps คงที่และข้อมูล TH/AAPL เป็น synthetic identity สำหรับทดสอบ ไม่ใช่หลักทรัพย์/ราคาตลาดไทยจริง
- Install มี warnings จาก deprecated transitive dependencies ของ drizzle-kit (`@esbuild-kit/*`); browser test runner มี NO_COLOR/FORCE_COLOR warning จาก environment ทั้งสองไม่ทำให้ขั้นตรวจล้มเหลว

## ข้อเสนอ M1 — ยังไม่ได้ลงมือ

1. ออกแบบ Trade/Account/Security และ Ledger พร้อม Drizzle schema/repositories, unique constraints, indexes, audit trail และ atomic/idempotent writes
2. สร้าง financial engine สำหรับ positions, daily compressed lots/FIFO, buy/sell fees, fractional shares, realized/unrealized P/L และ oversell validation
3. ยืนยัน timezone ของวันซื้อขายและนโยบาย fees/rounding/FX ก่อนถือว่าผลตรง Dime; หากยังไม่มี execution FX ให้แยก THB reference valuation อย่างชัดเจน

**Acceptance criteria ที่ตรวจได้:** rebuild positions จาก Ledger ซ้ำแล้วผลตรงกัน; confirm ธุรกรรมเดียวกันซ้ำไม่เพิ่มจำนวน; ซื้อหลายครั้งวันเดียวกัน/ข้ามวัน/ขายบางส่วน/เศษหุ้น/fee/oversell มี offline tests ที่ตรวจผลมือได้; pending/cancelled ไม่เข้ายอด holdings; migrations และ repository integration ผ่าน local D1 โดยไม่ใช้บัญชีหรือข้อมูลจริง
