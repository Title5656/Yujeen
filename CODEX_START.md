# CODEX_START.md — คำสั่งเริ่มพัฒนา Portfolio Tracker (ทำเฉพาะ M0)

## 1. เป้าหมายของงานครั้งแรก

เริ่มสร้าง **Personal Investment Portfolio Tracker** จากศูนย์ โดยยึดรายละเอียดใน `PROJECT_SPEC.md` และกฎการพัฒนาใน `AGENTS.md` เป็นหลัก

เงื่อนไขที่เจ้าของโปรเจกต์กำหนดไว้แล้ว:

- เป้าหมายค่าบริการรายเดือน **0 บาท**; ไม่สมัครบริการเสียเงินหรือเปิดระบบที่อาจเกิดค่าบริการเอง
- เว็บส่วนตัวสำหรับผู้ใช้คนเดียวและแสดงผลภาษาไทยเป็นหลัก
- ในอนาคตให้นำเข้าข้อมูลซื้อขายผ่านเอกสาร Dime แทนการคีย์ธุรกรรมเอง
- มี Financial Domain Engine ที่แยกจาก UI/Framework และคำนวณได้อย่างถูกต้อง
- มีระบบเลือก API ราคาหุ้นจากหน้า Settings สำหรับ Provider ที่ระบบรองรับ แต่ **ยังไม่ต้องทำระบบใช้งานจริงใน M0**
- ใช้ Cloudflare D1 เป็นฐานข้อมูลหลักเพียงตัวเดียว

**ครั้งนี้ให้ทำเฉพาะ Milestone M0 — Project Foundation เท่านั้น** ไม่ต้องทำ Dashboard สมบูรณ์ ไม่ต้องเชื่อม API ของนายหน้า และไม่ Deploy Production

## 2. รายการงานใน M0

1. **สำรวจ Workspace ปัจจุบัน** — ตรวจว่ามีไฟล์หรือ Git Repository เดิมอยู่หรือไม่ ห้ามเขียนทับงานเดิมโดยไม่ตรวจสอบ
2. **ตั้งค่า pnpm Workspace Monorepo** ให้มีโฟลเดอร์ต่อไปนี้:
   - `apps/web`: React + Vite + TypeScript SPA; มีโครงหน้าเว็บที่เข้าถึงได้ง่ายและเมนูชั่วคราวสำหรับ `Dashboard`, `Holdings`, `Transactions`, `Import`, `Watchlist`, `Settings`; หากมีตัวเลขตัวอย่างต้องระบุว่าเป็น `MOCK`
   - `apps/api`: Hono + Cloudflare Workers; Endpoint `GET /api/health` ตอบ JSON `{ "status": "ok" }` และมีรูปแบบตอบข้อผิดพลาดที่กำหนดชนิดข้อมูลชัดเจน
   - `packages/domain`: ชนิดข้อมูลพื้นฐานและตัวอย่างฟังก์ชันคำนวณด้วย Decimal ที่ไม่มี Dependency ต่อ Framework พร้อม Unit Tests ใน Vitest
   - `packages/market-data`: Interface `MarketDataProvider` และ `MockProvider` ที่ให้ผลแน่นอน พร้อม Tests; ห้ามเรียก API ภายนอกจริง
   - `packages/contracts`: Zod Schema / DTO อย่างน้อยหนึ่งรายการที่ใช้เป็นสัญญาข้อมูลระหว่าง Web กับ API
   - `packages/importers`: Interface/Types สำหรับการนำเข้าเอกสาร และสัญญา Mock Parser; ห้ามกล่าวอ้างว่าอ่านเอกสาร Dime จริงได้แล้ว
   - `packages/database`: ตั้งโครง D1/Drizzle และ Schema เริ่มต้นหรือ Placeholder ที่มีเหตุผล โดยยังไม่ต้องใช้ฐานข้อมูล Production
3. **ตั้งค่าคุณภาพโค้ด** — TypeScript strict, `tsconfig.base.json`, ESLint, Prettier, `.editorconfig`, `.gitignore`, README เบื้องต้น, `AGENTS.md` และ `docs/adr/`
4. **เพิ่ม Scripts ใช้งานได้จริง** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` และคำสั่งรัน Local Development; ห้ามใช้คำสั่งหลอกที่เพียงพิมพ์ข้อความว่าผ่าน
5. **เพิ่ม GitHub Actions CI** — รัน Lint, Typecheck, Tests และ Build โดยไม่ต้องใช้ External Secrets และไม่เปิดบริการมีค่าใช้จ่าย
6. **ตรวจการเชื่อม Frontend กับ Backend** — เลือกแนวทาง React/Vite + Cloudflare Workers ที่ใช้งานได้จริง รวมทั้งบันทึกวิธี Build/Preview และแผน Deploy ร่วมกันในอนาคต แม้แยกโค้ดสองแอป
7. **รันตรวจสอบจริง** — ติดตั้ง Dependency เท่าที่ทำได้ รันคำสั่งทดสอบ แก้ข้อผิดพลาด และรายงานผลตามจริง

## 3. ข้อจำกัดที่ห้ามละเมิด

- `packages/domain` ห้าม Import React, Hono, Worker Runtime, ORM หรือ Provider SDK
- ห้าม Hardcode API Key, เพิ่ม Database Switcher, เชื่อม Webull Trading API, เขียนระบบ Auto Trading หรือเดารูปแบบเอกสาร Dime จริง
- ใช้เฉพาะข้อมูลจำลองใน Repository และ Demo
- ไม่ต้องติดตั้ง Nx, Turborepo, Docker, Kafka หรือ Microservices เว้นแต่มีเหตุผลที่จำเป็นและได้รับอนุญาตก่อน
- หากทดสอบ Runtime ของ Cloudflare ให้ตรวจเอกสารแพ็กเกจ `@cloudflare/vitest-plugin` และอย่าใช้ตัวอย่างจากแพ็กเกจที่ล้าสมัยโดยไม่ตรวจสอบ
- ห้าม Deploy Production, เปิดบริการเสียเงิน หรือสร้างบัญชีบริการให้เจ้าของโปรเจกต์

## 4. หลักฐานที่ต้องส่งเมื่อจบงาน

- แสดงแผนผังไฟล์/โฟลเดอร์ที่สร้าง
- แสดงคำสั่งที่รันจริง เช่น `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` พร้อมผลลัพธ์ผ่าน/ไม่ผ่าน
- อธิบายว่า Web, API, Domain, Importers, Market Data, Database และ Contracts แยกความรับผิดชอบกันอย่างไร
- ให้คำสั่งที่เจ้าของโปรเจกต์ใช้รันเว็บและ Backend ในเครื่องได้
- ระบุงานที่ยังไม่เสร็จและข้อจำกัดของสภาพแวดล้อมอย่างชัดเจน
- เสนอรายการงาน M1 ถัดไปพร้อม Acceptance Criteria แต่ **ยังไม่ลงมือทำ M1**

## 5. ลำดับวิธีทำงานที่แนะนำ

1. สำรวจไฟล์เดิมและวางแผนสั้น ๆ
2. สร้างโครงสร้าง Workspace และแต่ละ Package
3. ตรวจ TypeScript และ Build ทีละส่วน
4. เพิ่ม Unit Tests และ Mock Contracts
5. เขียน README และ Architecture Decision Records (ADR)
6. รันคำสั่งตรวจสอบชุดสุดท้ายแบบเดียวกับ CI
7. สรุปผลเป็นภาษาไทย พร้อมไฟล์ที่แก้ ผลทดสอบ และอุปสรรค

> **สำคัญ:** ให้ความสำคัญกับโค้ดที่รันและทดสอบได้จริง มากกว่าการสร้างโฟลเดอร์จำนวนมากที่ยังใช้งานไม่ได้

## 6. ข้อความสั่งงานสั้น ๆ สำหรับส่งให้ Codex

> อ่าน `PROJECT_SPEC.md`, `AGENTS.md` และ `CODEX_START.md` ทั้งหมดก่อนลงมือทำงาน แล้วพัฒนา **Milestone M0 เท่านั้น** ตามข้อกำหนด สร้าง pnpm Monorepo ที่แยกแอปและแพ็กเกจชัดเจน ใช้ Mock Data โดยไม่เชื่อม API จริง ไม่ Deploy Production และไม่เปิดบริการเสียเงิน เมื่อเสร็จแล้วให้รัน Lint, Typecheck, Test และ Build เท่าที่สภาพแวดล้อมรองรับ พร้อมรายงานผลจริงเป็นภาษาไทยและระบุงานที่ยังติดขัด
