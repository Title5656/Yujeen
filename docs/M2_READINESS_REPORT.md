# ผลแก้ฐาน M1–M2 ก่อนเริ่ม M3

วันที่ 8 พฤศจิกายน 2026 · ทำตามคำสั่งเจ้าของให้รองรับเอกสารที่ต้องการใช้จริงและปรับแผน · ยังไม่เริ่มเชื่อมบริการ M3

## ผลที่เปลี่ยน

- หน้า Import แสดงหุ้น/ตลาด ซื้อหรือขาย วันที่มีผลตามใบ จำนวน ราคาต่อหน่วย ยอดซื้อขาย ค่าธรรมเนียมรวม VAT ภาษีหัก ณ ที่จ่าย และยอดสุทธิ แยกจากข้อความดิบ ไม่ใช้คำเตือนว่าไม่มีตัวอย่างกับแบบฟอร์มที่อ่านได้แล้ว
- ตัวอ่านรองรับแบบ Confirmation Note / Receipt / Tax Invoice ที่ตรวจในเครื่อง ใช้ตำแหน่งข้อความจัดคอลัมน์ USD/THB และตรวจแถวที่อ่านไม่ครบโดยไม่ข้ามไปเงียบ ๆ
- เพิ่มรายการคำสั่งที่ยืนยันด้วยวันที่เอกสารใน Ledger เดิม ไม่มีการเติมเวลาเที่ยงคืน ลำดับ fill หรือราคา execution ขึ้นเอง ไม่ต้องให้ผู้ใช้กรอกข้อมูลที่ใบไม่มี
- ใช้ยอด gross/net ที่รายงานจริง ไม่คูณราคาต่อหน่วยที่อาจปัดแล้วกลับไปสร้างยอดเงิน; fee รวม VAT อยู่แล้ว ภาษีแยกคือ withholding ไม่คิด VAT ซ้ำ
- ประวัติครบและวันซื้อ/ขายแยกกันคำนวณ FIFO จากยอดเงินได้ หากซื้อ–ขายวันเดียวกันแต่ไม่รู้ลำดับ หรือประวัติขาด ให้จำนวนสุทธิพร้อมเหตุผล และต้นทุน/P&L ที่พิสูจน์ไม่ได้เป็น unavailable ไม่ใช้ต้นทุนศูนย์
- รักษา execution fills เดิม รูปแบบข้อมูลและ fingerprint เดิม การตรวจ oversell, revision guard, append-only, aliases และ atomic rollback; เพิ่ม migration0004 แบบ additive ใน D1 ตัวเดียว ไม่แก้ข้อมูล fill เก่าเป็น order
- ป้องกันการนับหลักฐานซ้อน: ยังไม่ยอมรวมใบสรุปคำสั่งกับ fills ของหุ้น/บัญชีเดียวกันจนกว่าจะพิสูจน์การเชื่อมโยง และ Order ID เดิมที่เปลี่ยนวัน/หุ้น/ตัวเลขจะเข้าตรวจ ไม่เพิ่มเป็นรายการใหม่
- เพิ่ม tests สำหรับขอบเขต decoder, timeout และยกเลิกหลังเริ่มอ่าน พร้อม cleanup/recovery ที่รอบก่อนยังขาด

## หลักฐานเอกสารจริงและความเป็นส่วนตัว

เปิดตัวอย่างเข้ารหัสสองหน้าในเครื่องผ่านรหัสใน memory เท่านั้น ใช้ PDF.js เช่นเดียวกับแอปและเทียบผลหุ้น/ฝั่ง/จำนวน/ราคาต่อหน่วย/gross/fee/withholding/net กับการอ่านข้อความด้วย pypdf อีกตัว ผลตรงกัน ไม่มีเวลา execution หรือ sequence ในตัวอย่าง จึงเก็บเป็นรายการระดับคำสั่งที่มีวันที่

ไม่บันทึก PDF ข้อความดิบ ชื่อ เลขบัญชี เลขเอกสาร หลักทรัพย์ วันที่ ยอดเงินจริง รหัสผ่าน หรือ screenshot ของต้นฉบับลง repository/logs/CI ไม่ยืนยันหรือเขียนพอร์ตจริงลง D1 ตัวอย่างที่ใช้กับ browser/CI/D1 และภาพตรวจหน้าเว็บทั้งหมดเป็นข้อมูลแต่งขึ้นที่รักษาเฉพาะรูปแบบตาราง

หลักฐานนี้ยืนยัน template และการอ่านฟิลด์จากตัวอย่างหนึ่งชุด ไม่ใช่การรับรองทุกแบบฟอร์ม/ทุกสถานะ ค่าต้นทุน intraday หรือ rounding ตรง Dime ทุกกรณี นโยบายและข้อจำกัดอยู่ใน [ADR0006](adr/0006-document-date-orders.md)

## การตรวจ

ผล final CI-equivalent ในเครื่องผ่านครบ วันที่8พฤศจิกายน2026 บน Windows / Node24.15.0 / pnpm11.25.0 ไม่ใช่ผล GitHub-hosted Actions

| คำสั่งที่รันจริง                                | ผลล่าสุด                                                            | หลักฐาน local (ignored)                                         |
| ----------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                | ผ่าน exit0                                                          | [install.log](../.local/verification-readiness/install.log)     |
| `pnpm lint`                                     | ผ่าน exit0                                                          | [lint.log](../.local/verification-readiness/lint.log)           |
| `pnpm format:check`                             | ผ่าน exit0                                                          | [format.log](../.local/verification-readiness/format.log)       |
| `pnpm typecheck`                                | ผ่าน exit0 ทุก package/apps/tests/tools                             | [typecheck.log](../.local/verification-readiness/typecheck.log) |
| `pnpm test`                                     | ผ่าน exit0 **350 Node + 34 Workers/D1 = 384 tests** ใน25files       | [test.log](../.local/verification-readiness/test.log)           |
| `pnpm build`                                    | ผ่าน exit0 packages → SPA → Worker dry-run; มี PDF.js chunk warning | [build.log](../.local/verification-readiness/build.log)         |
| `pnpm test:smoke`                               | ผ่าน exit0 **16 tests** desktop/mobile                              | [smoke.log](../.local/verification-readiness/smoke.log)         |
| `pnpm benchmark:import`                         | ผ่าน exit0 พร้อม literal assertions ทุกขนาด                         | [benchmark.log](../.local/verification-readiness/benchmark.log) |
| `pnpm --filter @portfolio/database db:generate` | ผ่าน exit0; 9tables ไม่มี schema drift                              | command output / migration tests                                |
| `git diff --check`                              | ผ่าน exit0 (มีเพียง LF/CRLF notices)                                | working tree                                                    |

ผลคำสั่งหลักเก็บใน [results.json](../.local/verification-readiness/results.json) การตรวจภาพหน้า Review ใช้ synthetic template บน desktop/mobile เท่านั้น ไม่ถ่ายภาพต้นฉบับส่วนตัว

ผลก่อน Optimize: execution fills จำลอง1k/10k/50k replay26/331/1131ms; แบบวันที่เอกสาร15,000รายการ replay234ms, dedup282ms ผลคงเหลือ5000หุ้น ต้นทุน50050 และ realized9850 ตรงค่าตรวจมือ เป็น single Node local run ไม่ใช่ Worker CPU benchmark หรือ p95 ไม่มีการ optimize/เปิด paid plan จากผลนี้

`pnpm db:migrate:local` ผ่าน exit0 ด้วย ใช้ migration0004 กับ D1 จำลองในเครื่องสำเร็จ23statements ไม่มี remote database ดู [migrate.log](../.local/verification-readiness/migrate.log)

ระหว่างพัฒนาได้สังเกต RED→GREEN ของ parser, structured browser preview, unreadable row, changed order identity, mixed evidence และ legacy oversell regressions จริง PDF decoder cold import ในเครื่องทำให้ชุด PDF บางกรณีเกิน test timeout เดิม5วินาที จึงให้เฉพาะสาม integration cases มี test budget30วินาที; production extraction limit15วินาทียังเดิม ไม่ปิด tests

ผู้ตรวจอิสระพบสี่ประเด็นสำคัญแล้วแก้พร้อม regressions: แถวที่ขาดทั้งฝั่งและcurrencyถูกข้าม, order ID เดิมเปลี่ยนวัน/หุ้นหลุดตรวจ, หลักฐาน order+fill นับซ้ำ, documentary buy ในอนาคตทำให้ fill oversell เดิมผ่าน ทั้งหมดแก้ RED→GREEN แล้วรวม full suite ข้างบน ส่วนข้อความ THB และการแสดง exchange ปรับให้ตรงกับสิ่งที่เก็บจริง

## สิ่งที่ยังต้องทำในช่วงถัดไป

- ปุ่มบันทึกผ่านเว็บยัง disabled และไม่มี public import/ledger endpoints จนระบบเข้าใช้เฉพาะเจ้าของพร้อม ยืนยันแบบ internal use case และ D1 emulator ผ่าน tests เท่านั้น
- OCR สำหรับภาพ/หน้าไม่มี text layer, workflow แก้เฉพาะช่อง และ audited correction/reconciliation ยังไม่รองรับ; ไม่อ้างว่า PDF Dime ทุกแบบอ่านได้
- Order ID ยังไม่ได้พิสูจน์ขอบเขตความไม่ซ้ำทุกวัน/ทุกบัญชี จึงใช้ identity ตามบัญชีแบบ conservative การใช้ซ้ำกับหลักฐานต่างกันต้องตรวจ ไม่ทิ้งรายการจริงหรือ overwrite
- ยอด THB, exchange และ settlement เป็นข้อมูลอ้างอิงใน local preview; Ledger ยืนยันเก็บเศรษฐศาสตร์ USD, documentary date และ provenance ที่ต้องใช้ ไม่มีการอ้างว่าเก็บข้อมูลเทียบ THB ระยะยาวแล้ว
- ผล benchmark Node ในเครื่องไม่พิสูจน์งบ CPU/rows read/written บน Workers Free ต้องวัด runtime ก่อนเปิดใช้จริง ไม่แก้ด้วยการเพิ่ม paid plan
- คงค่าใช้จ่ายประจำเป้าหมาย0บาท ไม่มี provider/API key/บริการเสียเงิน/deployment เพิ่ม

## วิธีรันและแผนใหม่

```sh
pnpm install
pnpm db:migrate:local
pnpm dev
```

เปิด http://127.0.0.1:5173/import เพื่อตรวจ PDF ในเครื่อง ส่วน combined preview ใช้ `pnpm preview` ที่พอร์ต8787

แผนใหม่สำหรับเจ้าของ: [M3_READINESS_PLAN.md](M3_READINESS_PLAN.md) · รายการไฟล์ทั้งหมด: [M2_FILES.md](M2_FILES.md)

M3 คือราคา/FX/cache/provider settings; M4 คือหน้าพอร์ต/กราฟ; Authentication ต้องพร้อมก่อน private endpoint แรก แม้ต้องนำงานบางส่วนจาก M5 มาทำก่อน เปิด production หลังความปลอดภัย/backup/quota ผ่านตามแผน ไม่มีการอนุญาตทำ M3 ต่อเองจากรายงานนี้
