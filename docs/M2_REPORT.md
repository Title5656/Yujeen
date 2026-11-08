# รายงาน M2 — Document Import foundation

> รายงานด้านล่างเป็น snapshot ก่อนเจ้าของส่งไฟล์ตัวอย่างเพิ่มเติม สถานะล่าสุดหลังแก้ฐาน M1–M2 ให้อ่าน [M2_READINESS_REPORT.md](M2_READINESS_REPORT.md) และ [แผนฉบับใหม่](M3_READINESS_PLAN.md) แทนข้อความข้อจำกัดเรื่องไม่มีไฟล์ใน snapshot เดิม

วันที่ 8 พฤศจิกายน 2026 · **ยังไม่ผ่าน acceptance สำหรับเอกสาร Dime จริง เพราะไม่มีไฟล์แนบที่เปิดอ่านได้ในรอบนี้**

ทำส่วนที่ไม่ต้องเดา layout แล้วตาม PROJECT_SPEC 7.3 แต่ไม่เรียกว่า M2 จริงเสร็จครบ ต้องตรวจไฟล์ของเจ้าของก่อนเปิด parser อัตโนมัติ เอกสารและรหัสผ่านจริงไม่ได้อยู่ใน source/fixtures/logs ไม่มีการเปิด import/ledger endpoints หรือ deploy

## สิ่งที่ทำและเหตุผล

- Importers แยก PDF extraction / unverified Dime parser / synthetic parser / draft validation / preview ออกจากกัน อ่าน PDF/password ในเครื่อง ใช้ original-byte SHA-256 และ page/line evidence บังคับ limits ไม่ upload หรือเก็บ PDF/text/password ใน D1
- Contracts เพิ่ม strict runtime schemas สำหรับ extraction/drafts/preview/review command และ decimal fields ผ่าน TradeSchema M1 อีกครั้ง ข้อมูลสำคัญขาดเป็น null/NEEDS_REVIEW ไม่ใช้เลข 0 ราคา ณ ปัจจุบัน เวลาที่ upload หรือ sequence จากแถวแทน
- Preview ใช้ M1 identity/fingerprint/dedup/replay จริง แสดง READY/DUPLICATE/NEEDS_REVIEW/NOT_FILLED; input ที่มีแถวผิดไม่ถูกคัดทิ้งเงียบ ๆ Whole-batch confirmation ต้อง review ทุกแถว ไม่มีการบันทึกบางส่วน
- API เพิ่มเฉพาะ internal previewImport/confirmImport ที่ reparse และ re-read Ledger ทุกครั้ง ตรวจ review digest + source rows และ pin reviewed revision ก่อนเรียก recordConfirmedTrades ไม่เพิ่ม storage abstraction, schema migration หรือสูตร FIFO อีกชุด ผู้เรียก M1 ที่ไม่ pin revision คง bounded retry เดิม
- Stable batch/source IDs จาก account + document hash + sourceRow; fill sequence มาจาก explicit field เท่านั้น Source aliases ของ M1 เก็บ duplicate provenance หลัง reload และตรวจ conflict โดยไม่เพิ่มหุ้น
- หน้า `/import` ตรวจ PDF ใน browser รวมรหัสผ่าน/การลองใหม่/ล้างข้อมูล แสดง unverified real layout และปิดการบันทึก หน้าอื่นไม่มีการพัฒนาฟีเจอร์ใหม่
- ValuationContext แยก quoteMaxAgeMs/fxMaxAgeMs พร้อม regression สองทิศทาง/ขอบเขต/invalid inputs คง MOCK, provider quality, reference FX และ historical unavailable semantics
- รายการไฟล์ทั้งหมด: [M2_FILES.md](M2_FILES.md); เหตุผล/limits: [ADR 0005](adr/0005-document-import-review-boundary.md)

## หลักฐานว่าตรง Transaction Model ของ M1

| ข้อมูลนำเข้า       | Trade M1 / กฎที่ใช้                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| บัญชีและหลักทรัพย์ | accountId ภายใน + explicit symbol/market/currency mapping → securityId; ไม่ใช้ ticker ล้วนเป็น identity                 |
| ประเภท/สถานะ       | side BUY/SELL และ tradeStatus FILLED ที่มี evidence; pending/cancelled/partial order ไม่ถูก promote                     |
| จำนวน/ราคา/fee/tax | decimal strings ส่งผ่าน TradeSchema และ validateTrade; fee/tax ศูนย์ต้องระบุ `"0"`                                      |
| execution instant  | ISO timestamp มี offset ผ่าน normalizeExecutedAt; tradeDate derive ตาม America/New_York ของ M1                          |
| sequence/fill ID   | explicit sequence เป็น safe integer และ externalRef ที่อ้าง FILL; order-only/missing sequence ต้องตรวจ                  |
| ที่มา              | original document SHA-256, parserVersion, stable batch/source IDs, sourceRow และ confirmedAt; raw PDF/text ไม่ถูกบันทึก |
| การบันทึก          | recordConfirmedTrades → mergeLedger → rebuildPositions → D1 expected revision/atomic append; append-only triggers เดิม  |

Node test ใช้ PDF.js จริงอ่าน **synthetic PDF** → parser จำลอง → preview → reviewed confirmation → repository โดยไม่ persist text ส่วน Worker tests ต่อ synthetic extraction text → use cases เดียวกัน → D1 จริงใน emulator → สร้าง repository ใหม่ → replay M1 ไม่ใช้ engine เป็น expected ของตัวเอง

ตัวเลขที่ตรวจแบบ literal:

- ซื้อ 2×10 + fee1 + tax0.2 = ต้นทุน 21.2; ซื้อวันถัดไป 1×20 + fee0.4 = 20.4; ขาย 2.5×30 − fee0.5 − tax0.1 = 74.4; ตัดต้นทุน 31.4 → realized **43**, เหลือ **0.5 หุ้น / ต้นทุน 10.2** ทั้ง Node และ D1
- ซื้อวันเดียวกัน 100×10 + 50×12 = 1,600/150 หุ้น; ซื้ออีกวัน 30×15; ขาย 120×20 ตัดต้นทุน 1,280 → เหลือ **60 หุ้น / ต้นทุน 770 / realized 1,120**
- สอง fills economics เดียวกันที่มี sequence1/2 และ fill IDs ต่างกัน → **4 หุ้น / ต้นทุน 42.4**; ไม่มี sequence แยกไม่ยืนยัน; references ขัดแย้งไม่ทิ้ง fill เงียบ ๆ
- replay ไฟล์เดิมไม่เปลี่ยน ledger revision/audit/source count; อีกไฟล์ที่มี fill เดิมเพิ่มเฉพาะ provenance; changed economics หลัง reload ถูกบล็อก

หลักฐานเหล่านี้พิสูจน์ความสอดคล้องกับ **โมเดลและนโยบาย M1** ด้วยข้อมูลจำลอง ยังไม่พิสูจน์ broker parity หรือ field mapping จากเอกสารของเจ้าของ ดู [M2_DIME_EVIDENCE.md](M2_DIME_EVIDENCE.md)

## ผลวัดก่อน Optimize

คำสั่ง `pnpm benchmark:import` ผ่าน assertions ทุกขนาด บน Windows / Node 24.15.0 / pnpm 11.25.0 แต่ละ 5 fills ซื้อ 4×1@10 + fee0.01 ต่อซื้อ ขาย 2@12 − fee0.02 → ต่อรอบเหลือ2/ต้นทุน20.02/realized3.96 เอกสารจำลองละ100แถว; ราคา/จำนวนทั้งหมด MOCK ไม่มี network ระหว่าง benchmark

| Trades | เอกสาร | Parse + preview ทั้งชุด (ms) | Dedup (ms) | M1 replay ย้อนลำดับ (ms) | Preview 100 rows เทียบ Ledger ทั้งชุด (ms) | Quantity / basis / realized |
| ------ | ------ | ---------------------------- | ---------- | ------------------------ | ------------------------------------------ | --------------------------- |
| 1,000  | 10     | 160                          | 30         | 21                       | 38                                         | 400 / 4004 / 792            |
| 10,000 | 100    | 1042                         | 266        | 167                      | 369                                        | 4000 / 40040 / 7920         |
| 50,000 | 500    | 5027                         | 1403       | 821                      | 1478                                       | 20000 / 200200 / 39600      |

เป็น single local run ก่อน Optimize ไม่ใช่ p95, PDF/OCR benchmark, end-to-end D1 latency หรือ Worker CPU time มี log ใน `.local/verification-m2/benchmark.log` ที่ถูก ignore ไม่ได้ Optimize engine หรือเพิ่มบริการจากผลนี้ การ replay ประวัติยาวต้องวัด CPU ใน runtime ก่อนเปิดใช้งานจริง; จำกัด import100แถวไม่ได้แก้ต้นทุน replay ของ Ledger ทั้งหมดโดยตัวมันเอง

## การตรวจจริง

รันคำสั่งทั้งหมดตาม CI ในเครื่องหลังแก้ review findings แล้ว วันที่ 8 พฤศจิกายน 2026 บน Windows / Node24.15.0 / pnpm11.25.0 ไม่ใช้ secrets หรือเอกสารจริง

| คำสั่งที่รันจริง                                | ผลล่าสุด                                                                     | หลักฐาน local (ถูก ignore)                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                | ผ่าน exit0                                                                   | [.local/verification-m2/install.log](../.local/verification-m2/install.log) |
| `pnpm lint`                                     | ผ่าน exit0                                                                   | [lint.log](../.local/verification-m2/lint.log)                              |
| `pnpm format:check`                             | ผ่าน exit0                                                                   | [format.log](../.local/verification-m2/format.log)                          |
| `pnpm typecheck`                                | ผ่าน exit0 รวม packages, web/API, Worker tests, tools/fixtures/benchmark     | [typecheck.log](../.local/verification-m2/typecheck.log)                    |
| `pnpm test`                                     | ผ่าน exit0: **287 Node + 22 Workers/D1 = 309 tests** ใน19files               | [test.log](../.local/verification-m2/test.log)                              |
| `pnpm build`                                    | ผ่าน exit0; packages → Vite → Wrangler dry-run, มี PDF.js chunk-size warning | [build.log](../.local/verification-m2/build.log)                            |
| `pnpm test:smoke`                               | ผ่าน exit0: **14 tests** desktop/mobile รวมหน้าเดิมและ import                | [smoke.log](../.local/verification-m2/smoke.log)                            |
| `pnpm benchmark:import`                         | ผ่าน exit0 และ assertions ทั้ง1k/10k/50k                                     | [benchmark.log](../.local/verification-m2/benchmark.log)                    |
| `pnpm --filter @portfolio/database db:generate` | ผ่าน exit0; 7tables ไม่มี schema changes/migration ใหม่                      | CLI output และ real migration suite ใน Worker tests                         |
| `git diff --check`                              | ผ่าน exit0; Git แจ้งเพียง LF/CRLF working-copy warnings                      | ตรวจ working tree โดยตรง                                                    |

ผลล่าสุดเก็บเพิ่มใน [results.json](../.local/verification-m2/results.json) มีการรัน formatter ใหม่เมื่อพบสองไฟล์ยังไม่ตรง format และแก้ lint preserve-caught-error ให้เก็บ cause ของ revision conflict ก่อน final run ผ่านทั้งหมด ไม่กล่าวอ้างว่า GitHub-hosted Actions หรือ production ผ่าน

ตรวจภาพ screenshot ของ Import ใน desktop/mobile จาก synthetic PDF แล้ว หน้าแสดง NEEDS_REVIEW ชัด ไม่มี horizontal page overflow ภาพ/log/trace ของ tests เป็น local ignored artifacts และใช้เฉพาะข้อมูลจำลอง

## ผลตรวจอิสระและการตัดสินใจ

- ผู้ตรวจอิสระพบ Important หนึ่งจุด: Ledger อาจเปลี่ยนระหว่าง confirm preview กับ recordConfirmedTrades read/retry จึงเพิ่ม optional expectedRevision ใน use case เดิม และ pin จาก confirmation ให้ mismatches/append conflict ต้อง PREVIEW_CHANGED ไม่ retry ลงข้อมูลที่ยังไม่ review
- พิสูจน์ด้วยสอง interleaving regressions ที่ RED เพราะระบบเดิมบันทึกได้1รายการใน revisionใหม่ → GREEN หลังแก้ (ต้องไม่มี trades/batches/aliases ของคำสั่งนั้น) เพิ่ม invalid expected revision4กรณี และรัน M1 bounded retry tests เดิมร่วมกันผ่าน16/16
- Minor ที่เลื่อนไว้: tests ยังไม่ครอบคลุม decoder PAGE_LIMIT/streamed TEXT_LIMIT/timeout/cancellation หลังเริ่มอ่านและ teardown ทุกเส้นทาง แม้มีการบังคับ limit ในโค้ดและทดสอบขอบเขต DTO/file limits, encrypted retry, corrupt/scanned และ pre-start abort แล้ว ต้องเพิ่ม lifecycle regressions ก่อนขยายชนิดเอกสาร/เปิด real import
- เรื่องที่ยังตัดสินไม่ได้: field mapping/broker parity ต้องรอเอกสารจริง; local benchmark ไม่พิสูจน์ quota production; OCR/field correction/authentication ยังอยู่ในรายการที่ไม่เสร็จตามขอบเขตข้างล่าง ไม่มีการปลด gate โดยอ้างว่าทดสอบด้วย synthetic แทนได้

## ข้อจำกัดและงานที่ยังไม่เสร็จ

1. ไม่มีไฟล์ Dime จริงที่เปิดอ่านได้ จึงยังตรวจ Execution/Sequence/fee/cost/layout จริงไม่ได้ DimeParser จริงคืน UNVERIFIED_DIME_FORMAT/NEEDS_REVIEW เสมอ ไม่ใช้ synthetic layout แทนเอกสารที่เจ้าของตั้งใจแนบ
2. ยังไม่มี OCR engine สำหรับภาพหรือ image-only PDF: ส่ง OCR_REQUIRED ให้ตรวจ ไม่เติมข้อมูล PDF.js text order/Thai/CMap ของ Dime จริงยังต้องตรวจจาก sample
3. ยังไม่มี field correction/selection workflow และ persistent import_drafts; drafts อยู่ใน memory การ reload/clear ล้างข้อมูล ไม่รองรับแก้เอกสารที่ยืนยันแล้วโดยเปลี่ยน alias เงียบ ๆ
4. ยังไม่มี Authentication/Authorization จึงไม่มี HTTP import/ledger endpoints และไม่ให้บันทึกเอกสารจริงผ่าน UI; ไม่มี production deployment
5. ไม่ยืนยันเวลา/rounding/intraday/FIFO parity ของ Dime; ค่า THB จาก current FX ยังเป็น reference ไม่ใช่ historical realized P/L
6. ขนาด frontend เพิ่มจาก PDF.js (lazy PDF module ประมาณ500KB, worker1.33MB uncompressed) มี Vite chunk warning; ไม่มี CDN/remote fonts/OCR service ที่เพิ่มค่าใช้จ่าย
7. ผล verification เป็น local ไม่ใช่ผล GitHub-hosted Actions; emulator ต้องรันนอก filesystem sandbox เพราะข้อจำกัด log/runtime เดิมของ M1 ไม่ได้ปิด tests เพื่อให้ผ่าน
8. มี local Worker สำหรับ browser startup crash หนึ่งรอบด้วย exit3221226505 โดยยังไม่เริ่ม tests; rerun คำสั่งเดิมโดยไม่แก้ product code ผ่าน14/14 ถือเป็นอาการของ local runtime ที่ยังระบุ root cause ไม่ได้ ไม่ปิดบัง run ที่ล้มเหลวนี้

## วิธีรันในเครื่อง

```sh
pnpm install
pnpm db:migrate:local
pnpm dev
```

เปิด `http://127.0.0.1:5173/import` เพื่ออ่านข้อความ PDF ในเครื่อง ใส่รหัสผ่านในฟอร์มเฉพาะเมื่อไฟล์ต้องใช้ จากนั้นกดอ่านเอกสาร รหัสจะถูกล้างหลัง attempt และไม่ส่งไป API หน้าแสดง NEEDS_REVIEW จนรูปแบบจริงผ่านการตรวจ

```sh
pnpm test
pnpm build
pnpm test:smoke
pnpm benchmark:import
```

บน Windows browser tests ใช้ Edge ที่มีอยู่; CI ติดตั้ง Playwright Chromium ตาม workflow เดิม ไม่มี API key, บัญชีโบรกเกอร์หรือ private fixtures ที่จำเป็นต่อ CI `pnpm preview` ใช้ combined build ที่ `http://127.0.0.1:8787/import`

## ขั้นถัดไปที่ตรวจรับได้

ก่อนปิด M2: รับ PDF ที่เจ้าของต้องการนำเข้าจริง ตรวจแบบอ่านภาพเทียบ text ทุกหน้าตาม M2_DIME_EVIDENCE, เพิ่ม parser version/fixtures ที่ปิดข้อมูลส่วนตัวตาม layout ที่พิสูจน์แล้ว; ฟิลด์สำคัญขาดต้อง NEEDS_REVIEW ตรวจ reupload/หลาย fills/fees/partial sale บน D1 อีกครั้ง และยืนยันตัวเลขกับผู้ใช้โดยไม่ commit ข้อมูลจริง

M3 ยังไม่เริ่ม เมื่อเจ้าของอนุญาตจึงทำ Provider/FX adapters + Settings ตามสเปก การเปิด private import transport ต้องมี Authentication/Authorization และ tests ยืนยันว่าผู้อื่นเข้าถึงข้อมูลไม่ได้ก่อนเสมอ ไม่มีการเปิด paid plan เพื่อหลีกเลี่ยง quota
