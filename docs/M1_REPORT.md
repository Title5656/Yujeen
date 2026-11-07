# รายงาน M1 — Financial Domain & Transaction Engine

วันที่: 8 พฤศจิกายน 2026 · ขอบเขต: M1 ต่อจาก M0 ตามคำสั่งเจ้าของ ไม่มีการเริ่ม M2

## งานที่ส่งมอบ

- Pure Domain: confirmed Trade, validation, fingerprint/duplicate conflict, repository port, daily Compressed FIFO, positions, purchase/sale fees+tax, realized/unrealized P/L และนโยบาย reference/historical FX
- D1: accounts/securities/import batches/canonical ledger/source aliases/audit, TEXT decimals, FK/unique/indexes, migrations ต่อจาก M0 และ append-only triggers
- Internal application use case: validate ทั้ง batch → อ่าน snapshot → dedup → replay ตรวจ oversell → atomic revision-guarded append; concurrent writes อ่านตรวจใหม่สูงสุด 3 ครั้ง
- เก็บ provenance ของเอกสารที่มีธุรกรรมซ้ำแยกจาก canonical ledger จึงไม่เพิ่มหุ้นอีกและไม่ลืมเลขอ้างอิงใหม่หลัง restart
- Tests ใช้ synthetic trades/doc hashes และ expected values แบบ literal จากการคำนวณมือ ไม่ใช้ผล engine เป็น expected ของตัวเอง
- อัปเดต [Architecture](architecture/README.md), [ADR 0004](adr/0004-financial-ledger-and-compressed-fifo.md), [README](../README.md) และ [รายการไฟล์](M1_FILES.md)

ไม่มีการแก้ UI หรือเปิด private HTTP routes ไม่มี provider/API จริง, PDF/OCR, credential storage, external package ใหม่, service เสียเงิน หรือ deployment สิ่งที่เพิ่มใน manifests/lockfile เป็น workspace links ที่โค้ดใช้จริงเท่านั้น

## สูตรและตัวอย่างตรวจสอบ

| ค่า                   | สูตร                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| จำนวนหุ้น             | ผลรวม BUY quantity − SELL quantity ของ FILLED ณ ลำดับ execution               |
| ต้นทุนซื้อ            | quantity × execution price + buy fee + buy tax                                |
| Daily compressed lot  | รวม quantity/cost ของ account/security/NY trade date เดียวกันที่มีอยู่ก่อนขาย |
| ต้นทุนขายจากแต่ละ lot | remaining lot cost × consumed quantity / remaining lot quantity; ตัด FIFO     |
| Realized P/L          | sell quantity × sell price − sell fee − sell tax − allocated basis            |
| Cost basis คงเหลือ    | ผลรวมต้นทุน lot ที่ยังไม่ขาย                                                  |
| Holdings value        | remaining quantity × supplied market quote                                    |
| Unrealized P/L        | holdings value − remaining cost basis                                         |

ตัวอย่าง: ซื้อ 100×10 และ 50×12 วันแรก ต้นทุน 1,600 / 150 หุ้น; ซื้อ 30×15 วันต่อมา ต้นทุน 450; ขาย 120 หุ้น ต้นทุนขาย 1,280 จึงเหลือ 60 หุ้น ต้นทุน **770** โดยไม่ใช้ต้นทุนเฉลี่ยที่ปัดเป็น cents

ตัวอย่าง fee/tax: ซื้อ 2×10 + fee1 + tax0.2 = 21.2; ซื้ออีกวัน 1×20 + fee0.4 = 20.4; ขาย 2.5×30 − fee0.5 − tax0.1 = 74.4 ตัดต้นทุน 21.2+10.2 = 31.4 ได้ realized **43** เหลือ 0.5 หุ้น ต้นทุน **10.2**

ใช้ decimal.js clone precision96, HALF_EVEN; inputs 18 integer/12 fractional digits; partial basis allocation และ averageCost 24 fractional digits; final depletion ตัด residual ทั้งหมด ไม่มี cent rounding ระหว่าง engine อ่านสูตร/เหตุผล/แหล่งอ้างอิงใน ADR

## หลักฐานการตรวจ

เครื่องที่ตรวจ: Windows, Node **24.15.0**, pnpm **11.25.0**, TypeScript strict เดิม วันที่ 8 พฤศจิกายน 2026

| คำสั่งที่รันจริง                                | ผล                                                                                | หลักฐาน                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `pnpm install --frozen-lockfile`                | ผ่าน exit0; 8 workspace projects, already up to date                              | [log](../.local/verification-m1/install.log)      |
| `pnpm lint`                                     | ผ่าน exit0                                                                        | [log](../.local/verification-m1/lint.log)         |
| `pnpm format:check`                             | ผ่าน exit0 หลังจัดรูปแบบ test ที่เพิ่มล่าสุด                                      | [log](../.local/verification-m1/format.log)       |
| `pnpm typecheck`                                | ผ่าน exit0; packages, web, API, Worker tests และ tool configs                     | [log](../.local/verification-m1/typecheck.log)    |
| `pnpm test`                                     | ผ่าน exit0; **200 Node unit tests + 16 Workers/D1 tests = 216 tests** ใน 13 files | [log](../.local/verification-m1/test.log)         |
| `pnpm build`                                    | ผ่าน exit0; packages → Vite SPA → Wrangler dry-run                                | [log](../.local/verification-m1/build.log)        |
| `pnpm --filter @portfolio/database db:generate` | ผ่าน exit0; 7 tables, no schema changes                                           | [log](../.local/verification-m1/schema-drift.log) |
| `pnpm db:migrate:local`                         | ผ่าน; ผู้พัฒนาส่วน persistence รัน local CLI และ apply 0001/0002/0003 สำเร็จ      | ตรวจ migration ทั้งชุดซ้ำผ่าน Worker tests ด้านบน |
| `git diff --check`                              | ผ่าน exit0; มีเพียงข้อความ Git เตือน LF/CRLF ของ working copy                     | ไม่มี whitespace errors                           |

ครอบคลุม daily weighted buys, FIFO ข้ามวัน, partial/full sale, 12-place fractional shares, buy/sell fee/tax, HALF_EVEN และ residual conservation, oversell ก่อนซื้อภายหลัง, intraday sell/rebuy, account/security separation, invalid calendar/DST/currency/status, quote missing/stale/quality, reference FX missing/stale และ historical FX unavailable

Integration tests ใช้ real migration set + local D1 binding ตรวจ exact TEXT values/provenance, duplicate file/cross-file replay, aliases หลังสร้าง repository ใหม่, changed-identity conflict, same-file reparse rejection, raw SQL unique/FK/immutability, rollback ทั้ง batch และ concurrent oversell ที่มีเพียงรายการเดียวบันทึกได้ รวมทั้ง bounded retry unit tests

ก่อน implementation มี RED assertions ของ engine, validation, ledger และ repository จากนั้น GREEN ทั้งชุด ผู้ตรวจอิสระตรวจสูตรและเส้นทาง persistence พบช่องโหว่ alias ของ same-document replay จึงเพิ่ม regression และปฏิเสธ replay ที่เปลี่ยน identity; ตรวจรอบท้ายไม่เหลือ actionable findings

Baseline Node57 ผ่าน แต่ Workers ใน sandbox เริ่มไม่ได้พร้อม EPERM ที่ log directory และ cloudflare:test-internal error รันโค้ดเดิมนอก sandbox แล้ว Worker2 ผ่าน จึงใช้สิทธิ์รัน local tools นอก sandbox สำหรับ final Worker suite/build ไม่ได้แก้ dependencies หรือปิด tests เพื่อหลบปัญหา

Logs เป็น local artifacts ที่ถูก ignore ไม่ใช่ source สำหรับ commit ไม่ได้รัน browser smoke ซ้ำใน M1 เพราะไม่มีการแก้ web/UI และไม่ได้กล่าวอ้างผล browser/CI/production ที่ไม่ได้รัน

## ข้อจำกัดที่ยังมี

- ยังไม่ยืนยัน broker parity: NY timezone, ลำดับ intraday, fee/tax และ rounding เป็น policy ชั่วคราวที่มี tests ต้องเทียบเอกสาร Dime ที่ปิดข้อมูลส่วนตัวใน M2
- Engine M1 รองรับ DIME US/USD; Thai cost policy, short selling, dividend/cash/transfer/corporate actions และ tax reporting ยังไม่รองรับ Positions ไม่ใช่ยอดสินทรัพย์ทั้งบัญชี
- Historical THB realized P/L เป็น null / UNAVAILABLE ไม่มีการใช้ current FX แทน execution FX; THB valuation/unrealized ที่แปลงด้วย current FX ติด REFERENCE_ONLY; ไม่มี previous close ให้ daily P/L เป็น null
- ไม่มีการแก้/ลบธุรกรรม การแก้เอกสารที่ยืนยันแล้วต้องส่งตรวจ ไม่เปลี่ยน ledger เงียบ ๆ
- ไฟล์เดิม replay ต้องมีชุด source rows/IDs/fingerprints/refs และ parserVersion เดิมครบ; ถ้าพบ identity เพิ่มให้ conflict เพื่อ review การ reparse ที่เปลี่ยนหลักฐานยังไม่รองรับใน M1 จึงต้องกำหนด stable IDs ใน M2
- `sequence` และ externalRef ต้องอ้าง execution/fill จริงและคงที่ข้ามเอกสาร ไม่ใช้ลำดับ upload หรือ order id ที่รวมหลาย fills
- ยังไม่มี authentication จึงไม่มี ledger HTTP endpoints/UI และไม่มี production deploy
- ผลทั้งหมดเป็นการรันในเครื่อง ไม่ได้รัน GitHub-hosted CI หรือพิสูจน์ข้อมูลจริง/บริการภายนอก

## วิธีรันในเครื่อง

```sh
pnpm install
pnpm db:migrate:local
pnpm test
pnpm dev
```

เว็บ placeholder เดิมอยู่ที่ http://127.0.0.1:5173 และ health ที่ http://127.0.0.1:8787/api/health การทดสอบ financial engine ทำได้ด้วย `pnpm test:unit` หรือ `pnpm exec vitest run packages/domain/src` หลัง `pnpm build:packages` ส่วน `pnpm test` รวม D1 emulator ด้วย ใช้ `pnpm preview` ดู combined local build ที่ :8787 ไม่ต้องมี key/account

## สิ่งที่ต้องเตรียมสำหรับ M2 (ยังไม่ลงมือ)

1. เอกสาร Dime ที่ปิดข้อมูลส่วนตัวสำหรับระบุ fill identity, ราคา, จำนวน, fee/tax, สกุลเงิน, status, execution time/sequence และ timezone; ถ้าไม่มีข้อมูลต้อง NEEDS_REVIEW ไม่เดา
2. เทียบ intraday ซื้อ–ขายสลับกัน, DST และ fee/rounding กับ engine; ออก policy/ADR ใหม่หากหลักฐานต่างจากสมมติฐาน M1
3. คำนวณ SHA-256 จากไฟล์ใน browser, versioned PDF/OCR parser, draft ที่แยกจาก confirmed trades, Preview และ validation ฝั่ง backend ซ้ำก่อน internal use case
4. ใช้ fill-level reference และ stable IDs/sequence; ทดสอบเอกสารเดิม/ต่างไฟล์/หลาย fills ที่ economics เหมือนกัน และเส้นทาง conflict ที่ต้อง review
5. ออกแบบขอบเขต import ตามจำนวนแถว/ขนาดไฟล์ให้สอดคล้อง D1 quota/limits ก่อนเปิดใช้งานจริง พร้อม atomic confirmation/provenance และไม่มีเอกสารส่วนตัวใน fixtures/logs

เกณฑ์ M2 ที่เสนอ: เอกสารตัวอย่างที่ตรวจแล้วอ่านถูกฟิลด์, missing/pending/cancelled ไม่เข้า ledger, ยืนยันซ้ำไม่เพิ่มหุ้น, source aliases ตรวจ conflict ได้หลัง reload, batch ที่ผิดไม่เขียนบางส่วน และผล positions ตรงรายการที่ตรวจด้วยมือ หากไม่มีตัวอย่างจริงให้รายงานข้อจำกัดและทดสอบ synthetic เท่านั้น
