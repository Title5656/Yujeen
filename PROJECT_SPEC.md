# Personal Investment Portfolio Tracker

## งบ 0 บาทแบบบังคับ — 10 พฤศจิกายน 2026

ค่าใช้จ่ายบริการของโปรเจกต์ต้องเป็น 0 บาท ทั้งเริ่มต้น รายเดือน รายปี และเมื่อใช้เกินโควตา ไม่ใช้ free trial, เครดิตชั่วคราว, paid plan ที่มี free allowance, auto-renew เป็นเสียเงิน หรือ usage-based overage ห้ามสมัคร/อัปเกรด/เปิดการคิดเงินเอง เมื่อโควตาไม่พอต้องหยุดงาน ลดความถี่ หรือให้ใช้ข้อมูลเก่าที่ระบุเวลา ห้ามลดความปลอดภัยเพื่อให้อยู่ในงบ

ก่อนเลือกบริการต้องพิสูจน์จากเงื่อนไขทางการและการตั้งค่าบัญชีว่าเป็น Free Plan ที่ไม่หมดอายุแบบ trial และเมื่อเกินโควตาจะหยุด ไม่คิดเงิน Budget alert อย่างเดียวไม่ใช่ spending cap หากยืนยัน hard stop ไม่ได้ ห้ามเปิดบริการนั้น รวม Hosting, Database, Auth, Quote/FX, CI/CD, Storage, Logs, Backup, Domain และบริการ M6 ทั้งหมด ดู [นโยบายและแบบคำนวณโควตา](docs/ZERO_BUDGET_POLICY.md)

ไม่รับประกันว่าบริษัทภายนอกจะคงแผนฟรีตลอดไป หากเงื่อนไขเปลี่ยนให้หยุด integration ก่อนมีค่าใช้จ่าย แจ้งเจ้าของและหาทางฟรีที่สอดคล้องสเปก โดยไม่เปลี่ยน D1 หรือเปิดแผนเสียเงินเอง

## รายงานข้อกำหนดซอฟต์แวร์และแผนพัฒนาสำหรับส่งต่อให้ Codex

**รหัสเอกสาร:** PT-PRD-001  
**เวอร์ชัน:** 1.0 — ฉบับภาษาไทยสำหรับเริ่มพัฒนา  
**วันที่จัดทำ:** 7 พฤศจิกายน 2026  
**ผู้อ่านหลัก:** เจ้าของโปรเจกต์, Codex, Software Engineer  
**สถานะ:** ตรวจ template Dime ตัวอย่างแล้วและแก้ฐาน M2 ก่อน M3 ตามคำสั่งเจ้าของภายหลัง; ยังต้องพิสูจน์ layout เพิ่มเติม สิทธิ์ข้อมูลตลาด และระบบสิทธิ์ก่อนใช้ Production

> **เป้าหมาย:** สร้างเว็บติดตามพอร์ตลงทุนส่วนตัวที่มีค่าใช้จ่ายรายเดือนเป้าหมาย **0 บาท** ผู้ใช้แทบไม่ต้องกรอกข้อมูลการซื้อขายเอง แต่ใช้การอัปโหลดเอกสาร Dime แล้วตรวจสอบผลการอ่าน ระบบจะคำนวณจำนวนหุ้น ต้นทุน กำไรขาดทุน และอัปเดตมูลค่าตามราคาตลาด โดยเปลี่ยนผู้ให้บริการ API ที่รองรับผ่านหน้า Settings ได้ **ไม่ทำระบบเปลี่ยน Database**

**วิธีใช้เอกสารชุดนี้:** `PROJECT_SPEC.md` เป็นสเปกหลัก, `AGENTS.md` เป็นกฎที่ Codex ต้องปฏิบัติ, และ `CODEX_START.md` เป็นคำสั่งเริ่มงานครั้งแรก โดยครั้งแรกให้ทำเฉพาะ **M0**

**ปรับสมมติฐาน 8 พฤศจิกายน 2026:** เอกสาร Dime ที่ตรวจมีข้อมูลระดับ order และ Effective Date แต่ไม่มี execution timestamp/sequence จึงรองรับ `DOCUMENT_DATE` ใน Ledger เดียวกับ execution fills โดยไม่เดาเวลา ใช้ reported gross/net และแสดง cost/P&L unavailable เมื่อหลักฐานลำดับหรือประวัติไม่พอ ดู [ADR 0006](docs/adr/0006-document-date-orders.md) และ [แผนเตรียม M3](docs/M3_READINESS_PLAN.md) รอบนี้ยังไม่เริ่ม M3

---

## 1. บทสรุปโครงการ

ระบบนี้เป็น **Private Web Application** สำหรับติดตามพอร์ตหุ้นสหรัฐฯ และ US ETF ออกแบบมาสำหรับผู้ใช้งานคนเดียว รองรับทั้งคอมพิวเตอร์และมือถือ และใช้ภาษาไทยเป็นหลัก

ขั้นตอนใช้งานที่ต้องการคือ ผู้ใช้อัปโหลด **Dime Confirmation Note (PDF)** หรือภาพหลักฐานซื้อขายที่รองรับ → ระบบอ่านข้อมูล → แสดงหน้า Preview ให้ตรวจสอบเฉพาะจุดที่อ่านไม่แน่ใจ → ผู้ใช้ยืนยัน → ระบบบันทึกธุรกรรมที่เกิดขึ้นจริง → คำนวณพอร์ต → ดึงราคาจาก Market Data API และอัปเดต Dashboard อัตโนมัติ

สถาปัตยกรรมที่เลือกคือ **Modular Monolith + Clean Architecture / Ports & Adapters + pnpm Monorepo** เพื่อแยกหน้าที่ให้ชัดโดยไม่จำเป็นต้องสร้างหลาย Microservices

**ปรับขอบเขต 10 พฤศจิกายน 2026 ตามคำสั่งเจ้าของ:** เน้นหุ้นสหรัฐฯ และ US ETF ก่อน เลื่อนหุ้นไทยจนกว่าเจ้าของจะสั่งเพิ่มเติม ไม่ต้องทำ Thai Provider หรือหน้าตั้งค่าหุ้นไทยแม้เป็น Experimental ใช้ Cloudflare D1 ตัวเดียว ไม่ทำระบบเปลี่ยน Database/API ของฐานข้อมูลผ่าน Settings ส่วนการเลือก Market Data Provider ที่รองรับสำหรับหุ้นสหรัฐฯ และ FX ยังอยู่ในแผน การแสดงมูลค่าเป็น THB ไม่ถือเป็นการรองรับหุ้นไทย

### 1.1 ข้อตกลงที่ตัดสินใจแล้ว

**เพิ่มเติม 10 พฤศจิกายน 2026:** เจ้าของต้องการดูข้อมูลพอร์ตได้ทั้งเงินบาท (THB) และดอลลาร์สหรัฐฯ (USD) แบบการเลือกสกุลใน Dime ใช้ Ledger เดิมและแยกยอดแปลงด้วย FX อ้างอิงออกจากยอด THB ตามเอกสารและกระแสเงินสดจริง รายละเอียดงาน M3–M6 และเกณฑ์ตรวจรับอยู่ใน [ร่างแผน USD/THB](docs/superpowers/specs/2026-11-10-m3-m6-usd-thb-roadmap.md) ซึ่งเป็นร่างสำหรับตรวจขอบเขต ยังไม่ใช่การอนุญาตเริ่ม implementation ทุก Milestone

- เป็นเว็บส่วนตัว ใช้งานเพียงคนเดียว ไม่ใช่ระบบเทรดหุ้น และห้ามส่งคำสั่งซื้อขายจริง
- ตั้งเป้าค่าบริการรายเดือน **0 บาท**; ห้ามเปิดบริการแบบเสียเงินโดยไม่ได้รับอนุญาต และไม่ถือว่า Free Tier ปัจจุบันรับประกันว่าจะฟรีตลอดไป
- ใช้ **Cloudflare D1** เป็นฐานข้อมูลหลักเพียงชนิดเดียว ไม่สร้าง Database Switcher หรือ Migration Wizard ข้ามผู้ให้บริการ
- หน้า **Settings → Integrations** ต้องเปลี่ยน Market Data Provider และ API Key ของ Provider ที่เขียน Adapter รองรับไว้แล้วได้ โดยไม่แก้ Source Code หรือ Redeploy
- Source of Truth ของข้อมูลพอร์ตคือ **Transaction Ledger** ที่ผ่านการยืนยัน ไม่ใช่ยอดจำนวนหุ้นที่กรอกมือเป็นประจำ
- ฟีเจอร์ MVP ได้แก่ นำเข้า Dime, Holdings, Portfolio Dashboard, Transactions, Watchlist, Market Quotes/FX และ Provider Settings
- Price Alerts และ Gmail Auto Import เป็นงานหลัง MVP ไม่ใช่สิ่งที่ต้องทำในรอบแรก
- ตรวจพบ Unit, Unit Price, Fee Include Vat, Withholding Tax และยอด gross/net ใน template Confirmation Note / Receipt / Tax Invoice ตัวอย่างแล้ว แต่ไม่พบ execution time/sequence; ยังไม่ยืนยันทุก layout หรือ broker parity จากตัวอย่างเดียว

### 1.2 เกณฑ์ความสำเร็จของระบบ

1. อัปโหลดเอกสารที่รองรับ ตรวจ Review แล้ว Confirm จนบันทึกธุรกรรมได้โดยไม่ต้องคีย์ข้อมูลใหม่ทั้งรายการ
2. เมื่อราคา Market Quote เปลี่ยน ระบบอัปเดตมูลค่าหุ้นที่ถือและ Unrealized P/L ได้ โดยจำนวนหุ้นยังคำนวณจาก Ledger เดิม
3. รองรับเศษหุ้น การซื้อหลายครั้ง การขายบางส่วน ค่าธรรมเนียม สกุล USD/THB และนโยบาย **Dime US Compressed FIFO**
4. สลับ Provider ที่ระบบรองรับแล้วผ่านหน้า Settings ได้หลัง Test Connection โดยไม่แก้โค้ด
5. สูตรคำนวณทดสอบแบบ Offline ได้ ไม่มี API Key อยู่ในโค้ดหรือ Frontend Bundle และไม่เปิดเผยข้อมูลพอร์ตโดยไม่มี Authentication
6. ใช้งานภายใต้ Free Tier ที่เลือกไว้ได้ โดยแสดงโควตา ข้อผิดพลาด และความล่าช้าของราคาอย่างตรงไปตรงมา

---

## 2. ขอบเขตของ MVP

**MVP (Minimum Viable Product)** คือเวอร์ชันเล็กที่สุดที่ทำงานครบเส้นทางสำคัญและมีความถูกต้องมากพอให้ใช้จริง ไม่ใช่เพียงหน้าตาจำลอง

### 2.1 สิ่งที่ต้องทำใน MVP

| หมวด | สิ่งที่จะพัฒนา | ความสำคัญ | ข้อสังเกต |
|---|---|---|---|
| พื้นฐาน | Monorepo, TypeScript strict, Lint, Format, Tests, CI | P0 | ต้องมีตั้งแต่ต้น |
| การเงิน | Transaction Ledger, Positions, Cost Basis | P0 | เป็นข้อมูลหลักของระบบ |
| นำเข้า | Parser สำหรับ PDF Confirmation Note ของ Dime | P0 | ต้องพิสูจน์กับไฟล์จริง |
| นำเข้า | OCR ภาพสลิป, Preview และแก้ไขเฉพาะฟิลด์ | P1 | ห้ามเดาตัวเลขที่ไม่ทราบ |
| ตลาด | Provider Contract, Mock Provider, API หุ้น US ที่มีสิทธิ์ใช้งานจริงอย่างน้อย 1 ตัว | P0 | ตรวจ Free Tier/License |
| ค่าเงิน | แหล่งอ้างอิงอัตรา USD/THB | P0 | ต่างจากเรตที่โบรกเกอร์ใช้จริง |
| หน้าจอ | Dashboard, Holdings, Transactions, Import, Watchlist | P0 | รองรับมือถือ |
| ตั้งค่า | เลือก Provider, บันทึก/เปลี่ยน API Key, Test Connection | P0 | Provider ที่มี Adapter แล้วเท่านั้น |
| จัดเก็บ | Cloudflare D1, Schema Migration, Export และทดสอบ Restore | P0 | ไม่สลับฐานข้อมูล |
| ความปลอดภัย | การเข้าใช้งานเฉพาะเจ้าของและปกป้อง Secrets | P0 | ห้ามนำข้อมูลจริงขึ้นเว็บก่อนปลอดภัย |
| ความเสถียร | แหล่งข้อมูล เวลาอัปเดต Error และ Rate Limit | P0 | ไม่แสดงข้อมูลเก่าว่าเป็นข้อมูลสด |

### 2.2 สิ่งที่ยังไม่ทำใน MVP

- หุ้นไทย รวมถึง Thai Market Data Adapter และหน้าตั้งค่าหุ้นไทย; เลื่อนไว้จนกว่าเจ้าของจะสั่งเพิ่มเติม

- Auto Trading, การส่ง/ยกเลิกคำสั่งซื้อขาย และการเชื่อมบัญชี Webull Trading (เจ้าของโปรเจกต์อายุ 19 ปีและยังไม่ผ่านข้อกำหนดบัญชีซื้อขาย/API ของ Webull Thailand)
- ระบบหลายผู้ใช้ การขาย Subscription การกระจายข้อมูลตลาดสู่สาธารณะ และระบบคำนวณภาษีอย่างเป็นทางการ
- การเปลี่ยน Database Engine, Kafka และ Infrastructure สำหรับ Event Streaming
- การเพิ่ม Custom REST Endpoint อิสระใน MVP; อาจเพิ่ม Custom REST Mapper ที่ปลอดภัยในระยะถัดไป
- Gmail Auto Import, ระบบปันผล/Corporate Actions แบบครบถ้วน, Telegram Alerts, Options, Crypto, การเก็บราคา Tick-by-Tick และ Performance Ratios ขั้นสูง
- การอ้างว่ามูลค่า Holdings เท่ากับยอดสินทรัพย์ทั้งบัญชี Dime หากยังไม่ได้อ่านเงินสดคงเหลือ การโอนเงิน ปันผล และเรต FX จริงจาก Statement

### 2.3 คำศัพท์ที่ควรเข้าใจ

| คำศัพท์ | ความหมายในโปรเจกต์นี้ |
|---|---|
| **Trade / Fill** | รายการซื้อขายที่จับคู่สำเร็จแล้วเท่านั้น; Pending/Cancelled ไม่เพิ่มหรือลดจำนวนหุ้น |
| **DOCUMENT_DATE Order** | รายการคำสั่งที่ confirmation ยืนยันด้วยวันที่ในเอกสาร; ไม่อ้างว่าเป็น fill ที่ทราบ execution time/sequence |
| **Transaction Ledger** | บัญชีประวัติธุรกรรมที่ตรวจสอบแล้ว เป็นแหล่งข้อมูลหลักสำหรับการคำนวณ; หากแก้ไขต้องมีประวัติการแก้ |
| **Position / Holdings** | จำนวนหุ้นคงเหลือและต้นทุนที่คำนวณได้จาก Ledger |
| **Cost Basis** | ต้นทุนของหุ้นที่ยังถืออยู่ตามวิธีคำนวณที่กำหนด |
| **Market Quote** | ราคาตลาดที่ได้จาก Provider พร้อมแหล่งข้อมูลและเวลา ไม่ใช่ราคาที่ผู้ใช้ซื้อจริง |
| **Unrealized P/L** | กำไรหรือขาดทุนของหุ้นที่ยังไม่ได้ขาย |
| **Realized P/L** | กำไรหรือขาดทุนจากการขายหุ้นแล้ว |
| **Holdings Value** | มูลค่าหุ้นที่ยังถือ ไม่รวมเงินสดหรือทรัพย์สินอื่นหากยังไม่มีข้อมูล |
| **Adapter** | ส่วนโค้ดที่แปลงวิธีทำงานเฉพาะบริการภายนอกให้เป็นรูปแบบมาตรฐานของระบบ |
| **Mock Data** | ข้อมูลจำลองสำหรับพัฒนาและทดสอบ ไม่ใช่ข้อมูลเงินจริง |
| **Milestone** | ช่วงงานที่มีผลลัพธ์และเกณฑ์ตรวจรับชัดเจน |

---

## 3. หลักสถาปัตยกรรมซอฟต์แวร์

### 3.1 แนวคิดที่ใช้

1. **Modular Monolith:** แบ่งโมดูลตามหน้าที่ แต่ Deploy Backend เป็นระบบเดียวก่อน ไม่เพิ่ม Microservices โดยไม่จำเป็น
2. **Separation of Concerns:** หน้าเว็บไม่เขียนสูตรต้นทุนหลักเอง, Route ไม่ยัด Business Logic, Parser ไม่เขียน Database โดยตรง
3. **Dependency Rule:** `domain` ห้าม Import `react`, `hono`, `drizzle`, `cloudflare:*`, `fetch` หรือ SDK ผู้ให้บริการข้อมูล
4. **Ports & Adapters:** Application เรียกผ่าน Contracts เช่น `MarketDataProvider`, `TransactionRepository`, `FxRateProvider`, `DocumentImporter` โดยไม่ต้องรู้รายละเอียดของผู้ให้บริการจริง
5. **Data Provenance:** Quote, FX และ Imported Trade ต้องมีแหล่งที่มา เวลา และสถานะความน่าเชื่อถือที่ตรวจสอบย้อนหลังได้
6. **Correctness First:** ไม่เดาราคา Execution, จำนวนหุ้น หรือ Fee จากราคาตลาดปัจจุบันหรือ OCR ที่อ่านไม่แน่ใจ
7. **ควบคุมงบ:** Integration ทุกตัวต้องมีการรับมือโควตา, Retry/Backoff แบบจำกัด และปิดใช้งานได้
8. **Deploy อย่างง่าย:** เริ่มพัฒนาในเครื่องด้วย Mock Data และค่อยเปิดใช้งานบน Cloudflare หลังระบบ Authentication ผ่านการทดสอบ

### 3.2 ภาพรวมการไหลของข้อมูล

```text
Browser (React SPA)
  ├── Dashboard / Holdings / Watchlist
  ├── Import Wizard [PDF.js + OCR in-browser]
  └── Settings / Provider Management
              │ HTTPS / JSON contract
              ▼
Hono Application API (Cloudflare Workers)
  ├── Auth / Validation / Rate-limit middleware
  ├── Transaction Use Cases ────────┐
  ├── Portfolio Query Use Cases ────┤
  ├── Import Verification Use Cases ┤──> Pure Domain Package
  ├── Provider Configuration ───────┤    Holdings / Compressed FIFO
  └── Quote / FX Sync Use Cases ────┘    Decimal valuations
              │ Ports / contracts
              ▼
Infrastructure Adapters
  ├── Cloudflare D1 repositories (one DB)
  ├── Market Data adapters (Mock, Alpaca, ...)
  ├── FX Provider adapter
  └── Cron scheduled quote refresh
```

**หมายเหตุ:** ลูกศรในภาพแสดงเส้นทางการทำงานของข้อมูล ส่วน Dependency ของ Source Code ต้องรักษากฎว่า Domain ไม่อ้างอิง Infrastructure หรือ UI และ Adapter เป็นฝ่ายนำ Interface จาก Core ไป Implement

### 3.3 สิ่งที่ไม่ควรทำ

- ไม่สร้างระบบทั้งหมดไว้ใน `app.ts`, `page.tsx` หรือไฟล์เดียว
- ไม่ให้ Dashboard Components เรียก Alpaca/Finnhub โดยตรง
- ไม่ให้ Database Layer เป็นผู้ตัดสินใจสูตร Compressed FIFO
- ไม่สร้าง Packages แยกตามทุกไฟล์เล็ก ๆ จนดูแลลำบาก
- ไม่เพิ่มบริการ Backend หลายตัวโดยไม่มีความจำเป็นด้านการใช้งานจริง

---

## 4. เทคโนโลยีที่ตัดสินใจใช้

| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| ภาษาหลัก | **TypeScript strict** | มีระบบชนิดข้อมูลตลอด Web/API/Core |
| จัดการ Packages | **pnpm Workspaces** | ทำ Monorepo และเชื่อม Packages ภายในด้วย `workspace:*` |
| Frontend | **React + Vite** | เหมาะกับเว็บ Dashboard แบบ SPA ไม่จำเป็นต้องใช้ SEO/SSR |
| UI | **Tailwind CSS + shadcn/ui** | สร้าง Components ซ้ำได้และปรับ Design System ง่าย |
| Charts | **Recharts** | กราฟ Allocation และประวัติมูลค่าพอร์ต |
| ดึงข้อมูลในหน้าเว็บ | **TanStack Query** | จัดการ Loading, Error และ Cache |
| Backend HTTP API | **Hono + Cloudflare Workers** | เบา เหมาะกับ API ของเว็บส่วนตัว |
| ตรวจสอบข้อมูล | **Zod** | ตรวจ Schema ณ จุดรับ/ส่งข้อมูลจริง |
| สูตรการเงิน | **decimal.js** | รองรับทศนิยมและกฎปัดเศษที่กำหนดชัดเจน |
| Database | **Cloudflare D1** | SQL/SQLite อยู่ใน Free Tier ภายใต้โควตา |
| ORM | **Drizzle ORM** | Type-safe Schema และ Migrations |
| อ่านข้อความ PDF | **PDF.js** ใน Browser | ลดการส่งเอกสารจริงไป Server |
| OCR รูปภาพ | **Tesseract.js** ใน Browser | ไม่ต้องจ่ายบริการ AI/OCR ภายนอก |
| Unit Tests | **Vitest** | ทดสอบ Domain แบบไม่พึ่ง Cloud |
| Worker Tests | **`@cloudflare/vitest-plugin`** | การทดสอบ Worker Runtime; ตรวจแพ็กเกจเวอร์ชันล่าสุดก่อนติดตั้ง |
| E2E Tests | **Playwright** | ทดสอบเส้นทาง Import และ Settings |
| CI | **GitHub Actions Free** | ตรวจ Lint/Types/Tests/Build โดยไม่ใช้ Secrets จริง |
| Hosting | **Cloudflare Workers + Static Assets** | ให้บริการ Web/API ได้โดยไม่ซื้อโดเมนภายใต้แผนฟรี |
| ตั้งเวลาซิงก์ | **Cloudflare Cron Triggers** | รันงานตรวจราคาเมื่อปิดคอม โดยขึ้นกับโควตา Provider |

**แนวทาง Build/Deploy:** แยก `apps/web` และ `apps/api` เป็นคนละส่วนเชิงโค้ด แต่ตั้งเป้า Deploy ร่วมกันใน Worker พร้อม Static Assets เมื่อพร้อมใช้งานจริง โดยให้ Codex ตรวจตัวอย่าง Build Integration ของ Cloudflare/Vite ปัจจุบัน ไม่สมมติว่า Config ที่คิดขึ้นจะใช้งานได้ทันที

### 4.1 ข้อจำกัด Free Tier ที่ต้องตรวจซ้ำก่อน Deploy

เอกสารที่นำมาใช้กำหนดแผนในวันที่จัดทำระบุข้อมูลอ้างอิงดังนี้:

- Cloudflare Workers Free: ประมาณ **100,000 Requests/วัน**, **10 ms CPU ต่อ Invocation**, **50 Subrequests ต่อ Invocation** และ **5 Cron Triggers ต่อบัญชี**; เวลา CPU ต่างจากเวลารอ Network
- Cloudflare D1 Free: ประมาณ **5 ล้าน Rows Read/วัน**, **100,000 Rows Written/วัน**, **500 MB ต่อ Database** และ **5 GB รวมในบัญชี**
- Market Data API ฟรีไม่ได้แปลว่ามีราคาหุ้น US แบบ Consolidated Real-time ทุกตลาด; Alpaca Basic ให้ Feed **IEX** ซึ่งอาจต่างจากตลาดรวม

**ห้ามถือว่าตัวเลขโควตานี้คงที่ตลอดไป** ให้ตรวจเอกสารทางการและสิทธิ์ของบัญชีจริงก่อนเปิดบริการ และห้ามเปิด Upgrade แบบคิดเงินอัตโนมัติ โครงสร้างข้อมูลควรเก็บราคาล่าสุดพร้อม Daily Snapshot แทนการเก็บราคาทุกนาทีไม่จำกัดจำนวนปี

---

## 5. โครงสร้าง Repository ที่แนะนำ

```text
portfolio-tracker/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/             # Router, Providers, เริ่มต้นแอป
│   │       ├── features/
│   │       │   ├── dashboard/
│   │       │   ├── holdings/
│   │       │   ├── transactions/
│   │       │   ├── imports/
│   │       │   ├── watchlist/
│   │       │   └── settings/
│   │       └── components/ui/   # UI ส่วนกลางที่นำกลับมาใช้ซ้ำได้
│   └── api/
│       └── src/
│           ├── modules/
│           │   ├── portfolio/
│           │   ├── transactions/
│           │   ├── imports/
│           │   ├── market-data/
│           │   └── provider-config/
│           ├── middleware/
│           ├── jobs/
│           └── index.ts
├── packages/
│   ├── domain/                # กฎธุรกิจและสูตรคำนวณการเงิน
│   ├── importers/             # อ่านเอกสาร Dime และสร้างข้อมูลรอตรวจ
│   ├── market-data/           # Provider Interfaces, Registry, Adapters
│   ├── database/              # Drizzle Schemas, D1 Repositories, Migrations
│   └── contracts/             # Zod Schemas และ DTO ที่ใช้ร่วมกัน
├── tests/fixtures/           # ใช้เอกสารจำลอง/ปิดข้อมูลส่วนตัวเท่านั้น
├── docs/
│   ├── adr/                  # บันทึกการตัดสินใจทางสถาปัตยกรรม
│   ├── api/                  # สัญญาของ REST API
│   ├── architecture/         # แผนภาพและขอบเขต Dependencies
│   └── runbooks/             # วิธี Backup, Recovery, รับมือ API ล้มเหลว
├── .github/workflows/
├── .gitignore
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── AGENTS.md
└── README.md
```

### 5.1 ตารางความรับผิดชอบแต่ละส่วน

| ส่วน | สิ่งที่รับผิดชอบ | สิ่งที่ไม่ควรรับผิดชอบ |
|---|---|---|
| `packages/domain` | ต้นทุน, Lots, จำนวนหุ้นคงเหลือ, P/L | HTTP, Database, OCR |
| `packages/importers` | อ่าน PDF/OCR, กฎการตีความ Dime, ข้อมูลรอตรวจ | เขียน Database เอง, ดึงราคาตลาด |
| `packages/market-data` | ต่อ Provider API, ปรับรูปแบบราคาให้เป็นมาตรฐาน, ระบุคุณภาพราคา | คำนวณต้นทุนแบบ Dime |
| `packages/database` | SQL Schema, Repository, Migration | กฎคำนวณทางการเงิน |
| `packages/contracts` | DTO และ Zod Schemas ที่ใช้เป็นขอบเขตข้อมูล | งานที่ทำให้ข้อมูลเปลี่ยนโดยตรง |
| `apps/api` | Authentication, Use Cases, Orchestration, HTTP Routes, Cron | OCR หนัก, สูตร Domain ที่ซ้ำกัน |
| `apps/web` | ขั้นตอนใช้งาน, Forms, Charts, Preview | สูตรการเงินหลักที่มีผลต่อยอดพอร์ต |

**หมายเหตุ:** การแยก Package ไม่ได้บังคับให้ Deploy แยก และไม่ต้องสร้างหนึ่ง Package สำหรับทุกฟังก์ชันเล็ก ๆ

---

## 6. โมเดลข้อมูลทางการเงินและกฎการคำนวณ

### 6.1 Entities หลัก

- `BrokerAccount`: รหัสภายใน, Broker เช่น `DIME`, ขอบเขตตลาด, สกุลเงินหลัก/สกุลที่แสดงผล
- `Security`: รหัสหลักทรัพย์ภายใน, Symbol, Exchange/MIC, ประเภทสินทรัพย์, สกุลเงิน Quote, ISIN ถ้ามี และชื่อ/รหัสเดิม
- `Trade` / confirmed ledger entry: รหัสรายการ, บัญชี, หลักทรัพย์, ฝั่ง BUY/SELL, ชนิดหลักฐาน execution fill หรือ `DOCUMENT_DATE` order, จำนวนหุ้น, ราคาต่อหุ้น, สกุลเงิน, Gross Amount, Fee/Tax, Net Cash Flow, เลขอ้างอิงตามชนิด, รหัส Import และหลักฐานยืนยันผล; fill มี execution instant/sequence ส่วน order มี Effective Date โดยไม่มีเวลา/sequence ที่แต่งขึ้น ต้องแยก Issue/Settlement ใน Review; ยอด THB, Settlement Date และ Exchange ยังเป็น local preview evidence ไม่ persist ใน Trade/D1 รอบแก้ฐานนี้
- `ImportBatch`: รหัสชุดนำเข้า, Hash เอกสาร, ประเภท, เวอร์ชัน Parser, เวลา, ผลการนำเข้า และสถานะซ้ำ
- `ImportDraft`: รายการซื้อขายชั่วคราวที่อ่านได้พร้อมระดับความมั่นใจ ฟิลด์ขาด และคำเตือน; **ยังไม่ถือเป็นธุรกรรมจริง** จนผู้ใช้ยืนยัน
- `MarketQuote`: รหัสหลักทรัพย์, ราคา, Currency, ประเภทราคา (`LAST`, `CLOSE` ฯลฯ), Feed, Source, `asOf`, `fetchedAt`, คุณภาพ (`REALTIME`, `DELAYED`, `EOD`, `UNKNOWN`)
- `FxRate`: คู่สกุลเงิน, Rate, Source, `asOf` และสถานะคุณภาพข้อมูล
- `ProviderConfig`: ประเภท/รหัส Provider, ตลาดที่รองรับ, เปิดใช้งาน, ลำดับความสำคัญ, กฎโควตา, ตัวอ้างอิง Credentials ที่เข้ารหัส และผลตรวจสุขภาพล่าสุด
- `PortfolioSnapshot`: เวลา, มูลค่าหุ้นที่ถือ, สกุลเงิน, ที่มาของ Quote และสถานะความครบถ้วนของข้อมูล
- `WatchlistItem`: หลักทรัพย์, หมายเหตุ และลำดับความสำคัญ

### 6.2 ตารางขั้นต่ำใน D1

`accounts`, `securities`, `transactions`, `import_batches`, `import_drafts`, `market_quotes`, `fx_rates`, `portfolio_snapshots`, `provider_configs`, `watchlist_items` และ `audit_events` หากจำเป็น

**ข้อกำหนดฐานข้อมูล:** มี Unique Constraint ที่เหมาะสมกับชนิดเลขอ้างอิงธุรกรรม, Index สำหรับ `accountId`, `securityId`, execution instant หรือ document date ตามชนิด, การยืนยัน Import ต้องบันทึกอย่างเป็น Transaction, มีทั้ง SHA-256 ตรวจไฟล์เดิมซ้ำและ Fingerprint ตรวจรายการเดียวกันที่อาจอยู่ในคนละไฟล์; order/fill อยู่ใน Ledger เชิงตรรกะชุดเดียว ไม่เพิ่มหุ้นซ้ำเมื่อหลักฐานซ้อน; ไม่เก็บ PDF ต้นฉบับลง D1 โดยค่าเริ่มต้น

### 6.3 กฎคำนวณที่ต้องปฏิบัติ

1. คำนวณด้วย **Decimal**; เก็บ/ส่งค่าที่ต้องแม่นยำเป็น Decimal String หรือรูปแบบที่ไม่สูญเสียความเที่ยงตรง หลีกเลี่ยง JavaScript `number` สำหรับเงินและเศษหุ้น
2. หุ้นสหรัฐฯ ของ Dime ใช้ **Compressed FIFO**: รวม Lot ซื้อรายวันแล้วตัด FIFO ข้ามวัน ข้อมูล execution fill ครบใช้ลำดับเดิมตาม ADR 0004 ส่วน `DOCUMENT_DATE` ใช้วันที่ที่เอกสารรายงาน ไม่สร้าง execution time/timezone/sequence; หาก BUY/SELL วันเดียวกันโดยไม่ทราบลำดับ ให้จำนวนหุ้นที่หาได้พร้อมสถานะ cost/P&L unavailable ไม่เดาลำดับ ทั้ง intraday/rounding ของ Dime ยังต้องพิสูจน์เพิ่มตาม ADR 0006
3. `positionQty = sum(BUY qty) - sum(SELL qty)` เฉพาะ fill ที่ยืนยันแล้วหรือ order ที่ confirmation ยืนยันผล; pending/cancelled ไม่เพิ่มหุ้น ประวัติขาดหรือจำนวนขายยืนยันไม่ได้ต้องแจ้ง ไม่สร้าง opening lot/ต้นทุนศูนย์เพื่อให้คำนวณผ่าน
4. `holdingsMarketValue = quantity × marketPrice` และ `unrealizedPL = marketValue − remainingCostBasis` ในสกุลเงินของหุ้น โดยต้องกำหนดชัดว่า Fee ของฝั่งซื้อรวมต้นทุนอย่างไร
5. `realizedPL = netSaleProceeds − allocatedCostBasis` โดยหัก fee/withholding ตามหลักฐานเพียงครั้งเดียว สำหรับ `DOCUMENT_DATE` ใช้ reported gross/net เป็นหลัก ไม่แทนด้วย quantity × displayed unit price ที่อาจปัดแล้ว; BUY net เป็นต้นทุนรวม, SELL net เป็นเงินรับสุทธิ, Fee Include Vat รวม VAT แล้วและ Withholding Tax แยกจาก VAT หากยอดไม่สอดคล้องให้ Review สูตร execution fill เดิมคงเดิม
6. แสดง P/L ใน USD แยกจากค่าที่แปลงเป็น THB; **Current FX ไม่ใช่ Execution FX** หากขาดอัตราแลกเปลี่ยนจริงตอนซื้อขาย ห้ามอ้างว่าคำนวณ THB Realized P/L ได้ตรงกับ Dime
7. Daily P/L ต้องมีราคาปิดก่อนหน้า หรือ Snapshot ที่เทียบกันได้ ถ้าไม่มีให้แสดง `N/A` ไม่ใช่ศูนย์
8. กราฟย้อนหลังต้องใช้ Snapshot จริง หรือข้อมูลย้อนหลังที่เชื่อถือได้บวกธุรกรรมตามเวลา; ห้ามสร้างกราฟสมมติจากยอดปัจจุบันแล้วแสดงเป็นผลงานจริง
9. Stock Split, Reverse Split, เงินปันผล, เงินสด, โอนหลักทรัพย์ ต้องระบุว่าเป็นรายการที่ยังไม่รองรับหรืออยู่ในระยะถัดไป ไม่อ้างว่าเป็นยอดบัญชีครบถ้วน
10. กำหนด Precision/Rounding และทดสอบด้วย Fixtures; การแก้ธุรกรรมเก่าต้องมี Audit Trail ไม่แก้โดยไร้ประวัติ

### 6.4 Test Cases ที่ต้องครอบคลุม

1. ซื้อหุ้น 1 หุ้น แล้วราคา Market Quote เพิ่มและลด
2. ซื้อหุ้นเดียวกันหลายครั้งในวันเดียวกันด้วยราคาต่างกัน: Compressed FIFO
3. ซื้อข้ามวันแล้วขายบางส่วน: การตัด Lot ต้องถูกต้อง
4. เศษหุ้นหลายตำแหน่งทศนิยม
5. Fee ฝั่งซื้อ/ขายในสกุลเงินที่ถูกต้อง
6. อัปโหลด PDF เดิมซ้ำ และธุรกรรมซ้ำที่อยู่ในคนละเอกสาร
7. รูปสลิปที่มีสถานะ `PENDING` หรือ `CANCELLED` ต้องไม่เพิ่มหุ้น
8. ขาดราคา Execution ต้องเข้าหน้าตรวจสอบ ไม่เติมราคาเอง
9. Quote เก่า/ขาด FX ต้องแสดงสถานะไม่ครบหรือข้อมูลล่าช้า
10. หุ้นคนละตลาดแต่ใช้ Ticker เหมือนกันต้องแยกจาก `Security` Identity ไม่อ้างอิง Symbol อย่างเดียว
11. ขายเกินจำนวน วันเวลาผิด หรือราคาเป็นศูนย์/ติดลบ ต้องไม่ผ่าน Validation
12. ลบ Cache แล้วสร้าง Positions กลับจาก Ledger ได้ผลเหมือนเดิม
13. `DOCUMENT_DATE` order อ่าน reported gross/net ที่ต่างจากผลคูณราคาแสดงได้; fee รวม VAT ไม่บวกซ้ำและ withholding แยก ตรวจ expected แบบ literal
14. เอกสารย้อนหลังต่างลำดับอัปโหลดได้ผลข้ามวันเหมือนกัน; order ซ้ำจากอีกไฟล์ไม่เพิ่มหุ้นซ้ำ และหลักฐานขัดแย้งต้องตรวจ
15. Same-day BUY/SELL ที่ไร้ลำดับและ missing history แสดงเหตุผล cost/P&L unavailable โดยไม่ทำให้ execution-fill regression เดิมเปลี่ยน

---

## 7. ระบบอ่านหลักฐานซื้อขาย Dime

**ลำดับแหล่งข้อมูลที่อยากรองรับ:** PDF Confirmation Note ที่ยืนยันซื้อขายแล้ว → รูปภาพสลิป/OCR เป็นทางเลือก → แก้ไขด้วยมือเฉพาะฟิลด์ที่อ่านไม่ออก

ตรวจตัวอย่างสองหน้าชนิด Confirmation Note / Receipt / Tax Invoice แล้ว พบข้อมูล order, quantity, unit price, fee รวม VAT, withholding, gross/net และวันที่หลายชนิด แต่ไม่มี execution time/sequence การรองรับจำกัด template ที่มีหลักฐาน ไม่ถือว่า Dime ทุกแบบอ่านได้ ดู [M2_DIME_EVIDENCE.md](docs/M2_DIME_EVIDENCE.md) ซึ่งไม่มีค่าจริงหรือข้อมูลส่วนตัวจากเอกสาร

### 7.1 ขั้นตอนการทำงาน

```text
ผู้ใช้เลือกไฟล์ใน Browser
  -> ตรวจประเภทไฟล์และคำนวณ SHA-256
  -> ใช้ PDF.js อ่าน Text พร้อมตำแหน่ง page/column (OCR ใน Browser เป็นงานที่ยังต้องพัฒนา)
  -> ส่งข้อมูลที่อ่านได้เข้า Dime Parser ที่ระบุ Version ตาม template ที่รองรับ
  -> แปลงเป็น ImportDraft[] พร้อมสถานะและหลักฐานที่อ่านพบ
  -> ตรวจราคา จำนวน วันเวลา สถานะซื้อขาย และข้อมูลซ้ำ
  -> แสดง Review UI ให้เทียบข้อมูลกับเอกสารต้นทาง
  -> ผู้ใช้กดยืนยันเฉพาะ fill/order ที่มีหลักฐานซื้อขายสำเร็จและตรวจแล้ว
  -> Backend ตรวจซ้ำและบันทึก Ledger แบบ Transaction
  -> คำนวณ Holdings ใหม่และล้าง Cache ที่เกี่ยวข้อง
```

### 7.2 เงื่อนไขความถูกต้องและความปลอดภัย

- ตรวจว่าไฟล์เป็น PDF หรือรูปภาพก่อนประมวลผล; ถ้า PDF มีรหัสผ่านและเปิดไม่ได้ ให้แจ้งวิธีจัดการอย่างปลอดภัย ไม่ขอรหัสผ่านมาในแชตหรือ Log
- กำหนดขนาดไฟล์/จำนวนหน้าสูงสุดเพื่อป้องกันการใช้ CPU/RAM เกินจำเป็น
- ไม่เก็บภาพหรือ PDF ต้นฉบับบน Cloud โดยค่าเริ่มต้น เก็บเฉพาะ Hash, Metadata, ธุรกรรมที่ยืนยันแล้ว และข้อมูลสำหรับ Audit เท่าที่จำเป็น
- มีสถานะ Parser Version เพราะรูปแบบเอกสาร Dime อาจเปลี่ยน
- ฟิลด์สำคัญต้องมีหลักฐานจากเอกสารจริง และแจ้งเมื่อ OCR ไม่มั่นใจ
- หากมีเพียงภาพคำสั่งซื้อที่ยังไม่จับคู่ ต้องไม่สร้างรายการ `FILLED`
- Order ที่มีเพียงวันที่ต้องเก็บเป็น `DOCUMENT_DATE` ไม่สร้างเวลา/sequence; ยอด USD หลักและ THB เทียบต้องแยกตามคอลัมน์ ไม่ใช้ THB เทียบเป็น execution FX
- หน้าเว็บยืนยันข้อมูลจริงและ private HTTP endpoints ต้องรอ Authentication/Authorization ผ่าน แม้ parser และ internal D1 confirmation ทดสอบผ่านแล้ว

### 7.3 เงื่อนไขก่อนยืนยันว่าใช้กับ Dime ได้จริง

ต้องตรวจตัวอย่างในเครื่องว่าข้อมูล Symbol/Exchange, Side, Quantity, Unit Price, Fee, Withholding, Gross/Net, Currency, วันที่และหลักฐานผลซื้อขายแสดงที่ใด บันทึกเฉพาะ field mapping/layout ที่ไม่มีข้อมูลส่วนตัว ใช้ fixture ที่แต่งค่าใหม่ทั้งหมดแต่รักษา template ที่พิสูจน์แล้ว ตัวอย่างที่ตรวจไม่มี execution timestamp/sequence จึงใช้ `DOCUMENT_DATE` ตาม ADR 0006; layout ที่ไม่มีหลักฐาน/ฟิลด์ขาดยังเป็น NEEDS_REVIEW และ image-only เป็น OCR_REQUIRED จนมี OCR จริง ไม่อ้าง intraday/rounding parity หรือทุก layout จากตัวอย่างเดียว

---

## 8. ระบบ Market Data และการเปลี่ยน API ผ่านหน้าเว็บ

### 8.1 Requirement หลักที่ตกลงกัน

ผู้ใช้ต้องเลือกหรือเปลี่ยน **Built-in Market Data Provider** และ Credentials ผ่าน `Settings → Integrations → Market Data` โดย **ไม่แก้ Source Code และไม่ Redeploy** ตราบใดที่ Provider นั้นมี Adapter รองรับอยู่แล้ว

หน้า Settings ต้องมี:

- รายชื่อ Provider และตลาดที่รองรับ ได้แก่ หุ้น US และ FX
- เพิ่ม/เปลี่ยน API Key แบบซ่อนค่า, Test Connection, Activate/Disable และเลือก Primary Provider
- แสดงเวลาซิงก์สำเร็จล่าสุด Error ล่าสุด สถานะ Rate Limit และประเภท Feed
- รองรับ Provider สำรองและนโยบาย Fallback แบบระบุชัดในระยะต่อไป
- เปลี่ยน API Provider แล้ว **ห้ามแก้ Transaction Ledger หรือ Cost Basis เดิม** เพราะราคาและต้นทุนเป็นคนละเรื่อง
- เก็บค่าตั้งที่ไม่ลับไว้ใน D1; Credentials เข้ารหัสฝั่ง Server ด้วย Web Crypto AES-GCM และ Master Key ที่เก็บเป็น Worker Secret; ห้ามตอบ Secret กลับออกไปเป็น Plaintext

**ข้อจำกัดสำคัญ:** MVP อนุญาตเฉพาะ Provider ID จาก Registry ที่เขียนไว้ เช่น `mock`, `alpaca` ห้ามให้ผู้ใช้ใส่ URL แล้ว Backend ยิงคำขอตามนั้นโดยตรง การเพิ่ม Custom REST Mapper เป็นงานภายหลังและต้องออกแบบป้องกัน SSRF/Signature Auth

### 8.2 ตัวอย่าง Interface ที่ให้แต่ละ Adapter ปฏิบัติตาม

```typescript
interface MarketDataProvider {
  id: string;
  supportedMarkets(): readonly string[];
  healthCheck(): Promise<ConnectionHealth>;
  getQuotes(requests: readonly QuoteRequest[]): Promise<readonly MarketQuote[]>;
}

interface TransactionRepository {
  saveConfirmedTrades(trades: readonly Trade[]): Promise<void>;
  listTrades(accountId: string): Promise<readonly Trade[]>;
}
```

**แนวทาง Implementation:** Adapter ต้องคืนผลลัพธ์/ข้อผิดพลาดที่จำแนกได้ เช่น `RATE_LIMITED`, `AUTH_FAILED`, `UNSUPPORTED`, `NETWORK`, `STALE_DATA`, `PROVIDER_ERROR`; รองรับ Batch เมื่อ API ทำได้; จำกัดจำนวน Retry โดยมี Exponential Backoff และ Jitter; Frontend ต้องไม่เรียก Third-party API ด้วย Secret โดยตรง

### 8.3 Provider เริ่มต้น

| Provider | บทบาท | ข้อจำกัดสำคัญ |
|---|---|---|
| `MockProvider` | ใช้ Fixtures จำลองสำหรับพัฒนาและทดสอบ Offline | ห้ามนำผลจำลองมาแสดงเป็นราคาจริง |
| `AlpacaProvider` | ตัวเลือกแรกสำหรับหุ้น US เมื่อเจ้าของโปรเจกต์สมัครได้และมีสิทธิ์ | Free Feed เป็น IEX ไม่ใช่ราคาตลาดรวม |
| `FxProvider` | แหล่งอ้างอิง USD/THB แยกจากหุ้น | Reference FX ไม่เท่ากับเรตซื้อขายจริงของ Dime |
| `WebullProvider` | พิจารณาภายหลัง | เจ้าของยังไม่ถึงเกณฑ์บัญชีซื้อขาย/API; ห้ามทำให้ MVP ติดขัดเพราะ Webull |

### 8.4 กระบวนการอัปเดตราคา

1. เริ่มจาก Cron ทุกประมาณ **15 นาที** และค่อยปรับเป็น 5–15 นาทีเมื่อโควตาและสิทธิ์ข้อมูลรองรับ
2. รวม Symbols ที่ซ้ำกันระหว่าง Holdings/Watchlist แล้วดึงเพียงครั้งเดียวต่อ Provider/ตลาดเมื่อ API รองรับ Batch
3. Cache Quote พร้อม Timestamp และ Source ไว้ใน D1; Dashboard อ่าน Cache เป็นหลัก
4. เมื่อเจอ HTTP 429 หรือ API ล่ม ให้ใช้ Backoff/Circuit Breaker และไม่มี Retry Loop ที่ไม่สิ้นสุด
5. แสดงชัดเมื่อราคาเก่าหรือไม่รองรับ ไม่รับประกันความแม่นยำระดับวินาที
6. ตรวจสิทธิ์ Market Data แต่ละเจ้าก่อนนำราคาไปแสดงหรือส่งต่อ แม้ใช้ส่วนตัวก็ตาม

---

## 9. โครงหน้าจอและประสบการณ์ผู้ใช้

1. **Dashboard:** มูลค่าหุ้นที่ถือ (`Holdings Value`), Unrealized P/L, การเปลี่ยนแปลงรายวันเมื่อมีข้อมูลพอ, ป้ายความสดของ Quote, กราฟ 7 วัน/1 เดือนที่มาจาก Snapshot จริง, หุ้นที่เปลี่ยนแปลงมาก และ Asset Allocation
2. **Holdings:** Symbol/ตลาด, จำนวนหุ้น, ต้นทุน, ต้นทุนเฉลี่ย, Quote ล่าสุด, มูลค่าปัจจุบัน, P/L สกุลหลักและ THB อ้างอิง พร้อมเวลา `asOf`
3. **Transactions:** ประวัติซื้อขายที่ยืนยันแล้ว ค้นหา/กรองได้ ดูหลักฐาน Import ที่มา และระบุการแก้ไขรายการอย่างชัดเจน
4. **Import Wizard:** ลากไฟล์เข้า → แสดงความคืบหน้า → แสดงข้อมูลที่อ่านพร้อมต้นทาง → Preview ให้แก้ฟิลด์มีปัญหา → เตือนซ้ำ → Confirm → สรุปรายการที่บันทึก
5. **Watchlist:** หุ้นที่สนใจแม้ยังไม่ได้ถือ พร้อมราคาล่าสุด ตลาด Source และเวลาอัปเดต
6. **Settings / Integrations:** รายชื่อ Provider, เลือก Primary, เพิ่ม/แทน API Key, Test Connection, สถานะ Sync/Error; แยกหน้า Preferences, Account และ Backup
7. **Data Health:** มีหน้าตา/ข้อความสำหรับ Loading, Empty, Partial, Stale, Unsupported และ API Error/429 ไม่แอบแทนค่าที่ไม่มีด้วยศูนย์

**แนวทางออกแบบ UI:** ใช้งานได้บน Desktop/Mobile, Typography สม่ำเสมอ, มี Skeleton/Empty States, ใช้ Keyboard ได้ มี Focus/Contrast เหมาะสม รองรับสลับหน่วย THB/USD พร้อมระบุที่มาของอัตราแลกเปลี่ยน โดยภาษาเริ่มต้นเป็นภาษาไทยแต่ยอมใช้คำลงทุนภาษาอังกฤษที่เป็นมาตรฐาน

---

## 10. ความปลอดภัย ความเป็นส่วนตัว และความเสถียร

- **ห้าม Deploy ระบบเก็บพอร์ตจริงก่อน Authentication/Authorization ทำงานและผ่านการทดสอบ** วิธีล็อกอินที่เลือกต้องฟรีและเปิดใช้ได้จริง หาก Cloudflare Access ต้องใช้วิธีชำระเงินที่ไม่ต้องการ ให้ประเมิน OAuth สำหรับผู้ใช้คนเดียวที่ป้องกันอย่างถูกต้อง
- ห้ามเปิด `/api/*` ที่มีข้อมูลพอร์ตให้คนทั่วไปเรียกได้ ห้ามใช้ URL ยาก ๆ เป็นวิธีล็อกอินแทนการตรวจสิทธิ์
- หากใช้ Session/Cookies ให้พิจารณา CSRF Protection, `HttpOnly`, `Secure`, `SameSite`, Token Expiry และตรวจ Authorization ฝั่ง Server ทุกครั้ง
- API Key ต้องส่งให้ Backend เท่านั้น เก็บเข้ารหัสด้วย AES-GCM และ Master Secret ฝั่ง Server; ออกแบบการเปลี่ยน Key/Version และห้ามแสดง Key เดิมแบบ Plaintext หลังบันทึก
- ห้าม Commit `.env`, `.dev.vars`, สลิปและ Statement จริง; ห้ามเขียน Credential ลง Log
- ตรวจ Input ด้วย Zod จำกัดขนาดไฟล์ ขนาด Response และเวลาประมวลผล ระวัง Content Type และ Query Parameters
- หากเพิ่ม Custom REST ในอนาคต ต้องป้องกัน SSRF ด้วยกฎ Egress/Allowlist ที่เหมาะสม บล็อก Loopback/Private/Metadata IP ตรวจ Redirect ใช้ TLS และกำหนด Timeout
- มี Export Backup เป็น JSON แบบมี Version, **ไม่รวม Secrets**, มี Checksum และทดสอบ Restore ใน Local/Test Database จริง อย่าใช้ D1 Time Travel เป็น Backup ทางเดียว
- ติดตามสถานะ `health`, `readiness`, `last_successful_sync`, หมวดข้อผิดพลาด, Import Failure และ Request Correlation ID โดยปิดบังข้อมูลส่วนบุคคล
- เป้าหมายประสิทธิภาพเบื้องต้น: Dashboard จาก Cache เปิดได้ประมาณ 2 วินาทีบนเครือข่ายทั่วไป (เป็นเป้าหมาย ไม่ใช่ผลทดสอบ) และหลีกเลี่ยง OCR หนักใน Worker Free
- ใช้ Code Review, Branch/PR Checks, ADR และเอกสาร Environment Variables เพื่อให้กลับมาดูแลในอนาคตได้ง่าย

---

## 11. ร่าง REST API Contracts

Endpoint ต่อไปนี้เป็นร่างเริ่มต้น ต้องปรับตาม Data Model และการทดสอบจริง

```text
GET    /api/health
GET    /api/portfolio/summary
GET    /api/holdings
GET    /api/transactions?cursor=...&limit=...
POST   /api/imports/preview          # ดูข้อมูลที่อ่านได้ ยังไม่บันทึก Ledger
POST   /api/imports/confirm          # ยืนยันรายการ โดยป้องกันการนำเข้าซ้ำ
GET    /api/imports
GET    /api/quotes?symbols=...
GET    /api/watchlist
POST   /api/watchlist
DELETE /api/watchlist/:id
GET    /api/integrations/providers    # ห้ามส่ง Secrets กลับไป
POST   /api/integrations/providers/:id/test
PUT    /api/integrations/providers/:id/config
POST   /api/integrations/providers/:id/activate
POST   /api/backup/export
```

ปกป้องทุก Endpoint ที่มีข้อมูลส่วนตัว ยกเว้น Health Check แบบจำกัดข้อมูล ใช้ Zod DTO Contracts ร่วมกัน และตรวจข้อมูลซ้ำฝั่ง Backend แม้ผู้ใช้เคย Preview แล้ว แยกรหัสผิดพลาด เช่น `401` (ยังไม่ล็อกอิน), `403` (ไม่มีสิทธิ์), `409` (ข้อมูลซ้ำ/ขัดแย้ง), `422` (ข้อมูลไม่ผ่าน Validation), `429` (เกินโควตา) และ `503` (Provider ใช้งานไม่ได้)

---

## 12. แผนพัฒนา Milestones และเกณฑ์ส่งมอบ

### M0 — วางรากฐานโปรเจกต์และสถาปัตยกรรม (เริ่มที่นี่)

**สิ่งที่ส่งมอบ:** pnpm Monorepo รันได้, TypeScript Strict, โครง React + Hono Workers, Packages หลัก, Unit Tests ขั้นต้น, Scripts สำหรับ Lint/Format/Typecheck/Build, GitHub Actions CI, README, `AGENTS.md`, เอกสาร ADR และ Mock Data

**Definition of Done (เกณฑ์ถือว่าเสร็จ):**

- รัน `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` ได้จริงและผ่านทั้งหมดในสภาพแวดล้อมที่รองรับ
- Frontend เปิดในเครื่อง มี Layout และเมนูชั่วคราว; ถ้าแสดงตัวเลขตัวอย่างต้องติดป้าย `MOCK`
- `GET /api/health` ตอบ JSON มีสถานะ `ok` โดยไม่ต้องเชื่อมโบรกเกอร์หรือ Market API จริง
- `packages/domain` มี Pure Function ตัวอย่างใช้ Decimal และ Unit Test ที่ให้ผลแน่นอน
- `packages/market-data` มี Provider Contract และ Deterministic MockProvider
- `packages/contracts` มี DTO พร้อม Validation; `packages/database` วางโครง D1/Drizzle โดยไม่ต้องใช้ Production Credentials
- มี `docs/architecture/` และ ADR อย่างน้อย `0001-modular-monolith.md`, `0002-single-d1.md`, `0003-api-provider-configuration.md`
- CI ทำงานโดยไม่ใช้ Secrets จริง ไม่มี Paid Services ไม่มี Production Deploy และไม่มีข้อมูลลงทุนจริงที่แต่งขึ้นให้เหมือนของจริง
- Codex รายงานไฟล์ที่ทำ คำสั่งที่รันจริง ผลทดสอบ สิ่งที่ติดขัด และงานต่อไป

### M1 — Transaction Ledger และ Financial Domain

สร้าง Trade Entities, D1 Schema/Repositories, Compressed FIFO Engine, Positions, Realized/Unrealized P/L, กฎ Decimal และ Historical FX Policy พร้อมทดสอบการซื้อหลายไม้วันเดียวกัน เศษหุ้น การขายบางส่วน และ Fee

**เกณฑ์ผ่าน:** สามารถคำนวณ Positions กลับจาก Ledger ได้เหมือนเดิม Unit Tests ผ่าน และการบันทึกรายการป้องกันการซ้ำ (Idempotent)

### M2 — พิสูจน์การอ่านเอกสาร Dime และระบบ Import

ใช้เอกสารตัวอย่างจริงที่ปิดข้อมูลส่วนตัวเพื่อระบุฟิลด์ พัฒนา PDF Extraction, OCR Fallback, Parser แบบมี Version, Preview, Duplicate Detection และยืนยันธุรกรรมแบบ Transaction

**เกณฑ์ผ่าน:** template ที่ตรวจแล้วให้ structured Review ถูกต้อง ยืนยันภายในกับ D1 แบบ atomic ได้ และไฟล์เดิม/ข้ามไฟล์ไม่ทำให้หุ้นเพิ่มสองครั้ง; DOCUMENT_DATE รองรับ reported gross/net และเอกสารย้อนหลังโดยไม่แต่งเวลา ข้อมูลลำดับ/ประวัติไม่พอให้ cost/P&L unavailable พร้อมเหตุผล Full-fill regressions เดิมยังผ่าน OCR ภาพจริง/field correction/layout อื่นที่ยังไม่มีต้องระบุค้างอย่างตรงไปตรงมา และไม่เปิด private transport ก่อน auth ดูแผนเกณฑ์ละเอียดใน `docs/M3_READINESS_PLAN.md`

### M3 — จัดการ Provider และข้อมูลราคาตลาด

สร้าง Quote Contracts, Mock Provider, US Provider ที่เจ้าของใช้งานได้จริงอย่างน้อยหนึ่งตัว, FX Adapter, D1 Quote Cache และหน้า Settings สำหรับบันทึก Key แบบเข้ารหัส/Test Connection/Activate; หุ้นไทยอยู่นอกขอบเขตจนกว่าเจ้าของจะสั่งเพิ่มเติม

**เกณฑ์ผ่าน:** เปลี่ยน Provider ที่เขียนรองรับได้ผ่านหน้าเว็บโดยไม่แก้ Source Code และแสดง source/time/quality/Stale/Error อย่างถูกต้อง Credentials เข้ารหัสด้วย Master Key ใน Worker Secret; ต้องทำ Authentication/Authorization ที่จำเป็นก่อนเปิด Settings/private endpoints แม้งานสิทธิ์อยู่ในหัวข้อ M5 ของแผนเดิม รอบแก้ฐาน M2 ยังไม่เริ่ม M3

### M4 — Dashboard และประสบการณ์ใช้งานครบวงจร

ทำ Holdings, Allocation, P/L, Watchlist, ประวัติมูลค่าจาก Snapshot, Transactions, Import Wizard และ Responsive UI

**เกณฑ์ผ่าน:** เมื่อนำเข้าเอกสารหรือราคาเปลี่ยน Dashboard คำนวณใหม่ตรงกับ Domain Tests และใช้บนมือถือได้ cost/P&L unavailable มีเหตุผล กราฟมาจาก snapshot/ประวัติจริง; private endpoints ต้องมีระบบสิทธิ์ก่อนเปิด

### M5 — เตรียมใช้งานจริงและ Deploy

ทำ Authentication/Secure Session/API ให้ครบและตรวจซ้ำก่อน deploy, Export/Backup และทดสอบ Restore, Cron Sync/Monitoring, E2E Tests และ Deploy ใน Free Plan หลังตรวจค่าใช้จ่าย งาน Authentication/Authorization ขั้นที่จำเป็นต้องมาก่อน private endpoints ใน M3/M4 ไม่รอถึง M5 จึงค่อยเริ่มป้องกัน

**เกณฑ์ผ่าน:** ผู้ไม่ได้รับอนุญาตเปิดข้อมูลไม่ได้ Backup กู้คืนได้ ไม่มี Key รั่ว และผู้ใช้เปิดเว็บได้แม้ปิดคอม

### M6 — ฟีเจอร์หลัง MVP

ทำ Price Alerts ผ่าน Telegram, Gmail Confirmation Ingestion, Data Providers เพิ่มเติม, Custom REST Mapper ที่ปลอดภัย, Dividend/Cash Statement Support และ Portfolio Analytics

**กฎการทำงาน:** การสั่ง Codex ครั้งแรก **ทำเฉพาะ M0** เท่านั้น ห้ามรีบสร้างเว็บครบทุกฟีเจอร์โดยใช้ข้อมูลจำลองแล้วกล่าวว่าใช้งานจริงได้

---

## 13. มาตรฐานคุณภาพที่ต้องมี

- **Architecture:** เคารพขอบเขต Dependencies; `domain` ไม่ขึ้นกับ Framework; UI ไม่ใช้ Provider SDK โดยตรง
- **Code Quality:** TypeScript strict, ตั้งชื่อสื่อความหมาย, หลีกเลี่ยง `any`, ไม่มีไฟล์ยักษ์ที่รวมทุกหน้าที่ และไม่สร้าง Abstraction ที่ไม่จำเป็น
- **Testing:** Unit Tests สำหรับสูตรการเงิน, Provider Tests ใช้ Mock/Fixtures, Worker API Integration Tests และ Playwright สำหรับเส้นทางใช้งานสำคัญ
- **Financial Integrity:** ทศนิยมแม่นยำ กำหนด Rounding ไม่เดาราคา ไม่บันทึกธุรกรรมซ้ำ และมีแหล่งหลักฐานย้อนกลับ
- **Security:** ไม่มีข้อมูลส่วนตัวแบบไม่ล็อกอิน, ไม่เก็บ Key Plaintext, จัดการไฟล์อย่างปลอดภัย, Logs ไม่มีข้อมูลลับ
- **Operations:** มี Cache/Freshness Logic, Retry แบบจำกัด, ควบคุมโควตาฟรี, Backup/Restore และแสดงข้อผิดพลาดได้
- **Documentation:** README สำหรับติดตั้ง/รัน, AGENTS สำหรับกฎ Codex, ADR, API Contracts และ Architecture Map
- **UX:** Responsive เข้าถึงได้ มี Loading/Error/Empty/Stale States และแสดงคุณภาพข้อมูลเสมอ

---

## 14. เรื่องที่ยังต้องพิสูจน์และสมมติฐานชั่วคราว

| เรื่องที่ยังไม่แน่ใจ | แนวทางจนกว่าจะตรวจสอบได้ |
|---|---|
| สลิป Dime มีราคาและ Fee ครบไหม | template ตัวอย่างมี Unit Price, Fee Include Vat, Withholding, Gross/Total แต่ไม่มี execution time/sequence; รองรับ DOCUMENT_DATE เฉพาะหลักฐานที่มี ไม่เหมารวมทุกแบบ |
| PDF Dime ทุกใบมีหน้าตาเหมือนกันไหม | **ยังไม่ทราบ** แยก Parser Version และ Fixtures ไว้รองรับการเปลี่ยนรูปแบบ |
| มีข้อมูลเงินสดคงเหลือ Dime ครบไหม | ยังไม่อยู่ใน MVP; ใช้ชื่อ `Holdings Value` แทนยอดบัญชีทั้งหมด |
| เจ้าของสมัคร Alpaca และได้รับสิทธิ์ข้อมูลอะไร | ต้องตรวจในบัญชีจริง; ใช้ Mock Provider เพื่อไม่ให้โปรเจกต์หยุด |
| วิธี Authentication ที่ใช้ได้ฟรีโดยไม่ต้องมีบัตร | ต้องทดสอบก่อน private endpoint แรกและก่อน deploy ห้ามเปิดพอร์ตจริงจนกว่าจะได้วิธีที่ปลอดภัย |
| Timezone/intraday/rounding ของ Compressed FIFO ใน Dime | ตัวอย่างซื้อเดียวไม่พิสูจน์; fill เดิมใช้นโยบาย ADR 0004 ส่วน DOCUMENT_DATE ไม่เดาเวลาและแสดง unavailable เมื่อไม่ทราบลำดับ |
| ค่า FX อ้างอิงกับ FX ตอนซื้อขายจริงต่างกันอย่างไร | แสดงแยกกัน ไม่อ้าง THB P/L ตรงโบรกเกอร์หากไม่มีหลักฐาน |
| เคยเกิด Stock Split หรือ Corporate Action ไหม | ต้องตรวจและระบุข้อจำกัด หรือมีรายการ Adjustment เมื่อรองรับจริง |

---

## 15. ลิงก์เอกสารอ้างอิงสำหรับทีมพัฒนา

ลิงก์ต่อไปนี้ใช้เป็นฐานเลือกเทคโนโลยีและตรวจข้อจำกัด ณ วันที่จัดทำ ควรเปิดเอกสารทางการล่าสุดอีกครั้งก่อนเชื่อม Production

1. Hono + Cloudflare Workers/Vite — https://hono.dev/docs/getting-started/cloudflare-workers-vite
2. บทเรียน React SPA + API บน Cloudflare — https://developers.cloudflare.com/workers/vite-plugin/tutorial/
3. ข้อจำกัด Cloudflare Workers — https://developers.cloudflare.com/workers/platform/limits/
4. ข้อจำกัด Cloudflare D1 — https://developers.cloudflare.com/d1/platform/limits/
5. ราคาและโควตา Cloudflare D1 — https://developers.cloudflare.com/d1/platform/pricing/
6. การเก็บ Worker Secrets — https://developers.cloudflare.com/workers/configuration/secrets/
7. การทดสอบ Workers ด้วย Vitest — https://developers.cloudflare.com/workers/testing/vitest-integration/
8. pnpm Workspaces — https://pnpm.io/workspaces/
9. Dime Confirmation Note และการอ้างอิงยอดเงินบาท — https://dime.co.th/th/articles/trade-us-get-dollar
10. วิธีคำนวณ Dime Compressed FIFO — https://dime.co.th/th/articles/compressed-fifo-dime
11. Alpaca Basic Feed และข้อจำกัด — https://docs.alpaca.markets/us/docs/about-market-data-api
12. Alpaca Paper Trading — https://docs.alpaca.markets/us/docs/trading-api

---

## 16. คำสั่งส่งต่องานให้ Codex

ให้ Codex อ่านเอกสารนี้ร่วมกับ `AGENTS.md` และ `CODEX_START.md` ทั้งหมดก่อนสร้างไฟล์หรือเปลี่ยนสถาปัตยกรรม เริ่มจาก **M0 เท่านั้น** สร้างระบบทีละส่วนโดยตรวจสอบว่ารันได้จริง ไม่สร้างสลิป Dime ปลอมแล้วกล่าวว่าอ่านเอกสารจริงสำเร็จ ไม่ใช้ API แบบเสียเงิน ไม่ Deploy Production และเมื่อเสร็จให้รายงานคำสั่งทดสอบพร้อมผลจริง รวมถึงข้อจำกัดที่ยังทำไม่ได้เป็นภาษาไทย

**คำตัดสินที่ต้องยึดระยะยาว:** แยก Domain, Importers, Market Data, Database, API และ UI อย่างชัดเจน แต่ Deploy อย่างง่าย ใช้ Cloudflare D1 ตัวเดียว และให้ผู้ใช้จัดการ Provider/API Key ที่รองรับผ่านหน้า Settings ได้เอง
