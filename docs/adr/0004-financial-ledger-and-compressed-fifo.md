# ADR 0004 — Confirmed Ledger และ Dime US Compressed FIFO (M1)

วันที่: 8 พฤศจิกายน 2026 · สถานะ: ใช้ใน M1; นโยบายเทียบยอด Dime ยังต้องพิสูจน์ใน M2

## บริบทและขอบเขต

เจ้าของอนุญาต M1 โดยตรงแล้ว จึงทำต่อจาก M0 ตาม PROJECT_SPEC ส่วน 6 และ M1 ได้ ข้อความ M0-only ในเอกสารเริ่มงานยังเป็นข้อกำหนดของรอบแรก ไม่ใช่การห้าม M1 ครั้งนี้

ใช้ modular monolith และ D1 ตัวเดียวเช่นเดิม ไม่มี dependency ภายนอกใหม่ ไม่มี UI/HTTP endpoints สำหรับข้อมูลส่วนตัว ไม่มีการ deploy หรือเปิดบริการ การบันทึกผ่าน internal use case จึงยังไม่ใช่ระบบ Import สำหรับผู้ใช้

## การตัดสินใจ

### 1. Ledger เป็นหลักฐาน ไม่แก้ยอด position โดยตรง

Trade รับเฉพาะ DIME / US / USD / FILLED และอ้าง `accountId`, `securityId` ภายใน ไม่ใช้ ticker เป็น identity บัญชีและหลักทรัพย์ตลาดอื่นเก็บแยกได้ แต่ engine M1 ปฏิเสธ cost policy ที่ยังไม่รองรับ

เก็บ quantity, executionPrice, fee และ tax เป็น decimal strings ชัดเจน แม้ fee/tax เป็นศูนย์ก็ต้องส่ง `"0"` ห้ามแปลงค่าที่อ่านไม่ออกเป็นศูนย์ Gross และ net cash flow คำนวณจากข้อมูลเหล่านี้ ไม่ใช้ราคาตลาดมาแทนราคา execution

แต่ละรายการมี importBatchId/sourceRow และ external fill reference (nullable เมื่อเอกสารไม่มี) ชุดยืนยันเก็บ document SHA-256, parserVersion และ confirmedAt เท่านั้น ไม่เก็บ PDF หรือข้อความเอกสารต้นฉบับ

Ledger/import batches/trade_sources/audit events เป็น append-only ใน M1 ทั้ง repository และ SQL triggers ปฏิเสธ update/delete ยังไม่รองรับการแก้ธุรกรรมเก่าจนกว่าจะมี workflow แก้ไขพร้อม audit ที่ตรวจสอบได้ การสร้าง batch/trades/sources/audit events ต้อง commit พร้อมกัน

### 2. การป้องกันรายการซ้ำและการบันทึกพร้อมกัน

- Document hash แยกตาม account ตรวจไฟล์เดิม; source row แยกตาม batch ตรวจบรรทัดเดิม
- externalRef ต้องเป็นเลขอ้างอิง **fill** ในขอบเขต account ไม่ใช้ order id ที่มีหลาย fills โดยไม่มีการแยก
- Fingerprint `trade:v1:` ตามด้วย canonical JSON ของ broker/market/account/security/side/instant/sequence/quantity/price/fee/tax/currency/feeCurrency ไม่รวม transaction id หรือชื่อไฟล์ Canonical JSON ไม่ใช่ cryptographic hash; SHA-256 เป็น hash ของเอกสารที่ caller ต้องคำนวณจาก bytes ใน M2
- Normalize timestamp เป็น UTC milliseconds และ normalize trailing decimal zeros ก่อนเทียบ รายการเดิมในคนละไฟล์จึงไม่เพิ่มหุ้นอีก
- `trade_sources` เชื่อมทุกบรรทัดที่ยืนยันกับ canonical trade รวมบรรทัดซ้ำจากเอกสารอื่น จึงเก็บเลขอ้างอิง/id ที่พบเพิ่มและตรวจ conflict ได้หลัง restart โดยไม่เพิ่มจำนวนหุ้น Metadata alias ไม่เข้า engine เป็นธุรกรรมอีกครั้ง
- ไฟล์เดิมที่ยืนยันแล้ว replay ได้เมื่อ source rows/transaction IDs/fingerprints/เลขอ้างอิงและ parserVersion ตรงชุดที่บันทึกไว้ทั้งหมด confirmedAt ของคำขอใหม่เปลี่ยนได้ และ batch ID ที่สร้างใหม่ไม่เปลี่ยนหลักฐานเดิม หาก parser พบ identity เพิ่มหรือเปลี่ยน ให้ conflict เพื่อ review แทนการตอบสำเร็จแล้วทิ้ง alias; M2 ต้องกำหนด stable IDs สำหรับไฟล์เดิมและออกแบบ audited reparse workflow แยก
- หาก identity เดิมมี economics เปลี่ยน ให้ conflict และส่งตรวจ ไม่ overwrite หรือ ignore; หาก economics เหมือนแต่ external fill refs ต่างกัน ให้ conflict เพื่อป้องกันการทิ้ง fill ที่เกิดขึ้นจริง
- `sequence` ต้องมาจากลำดับ execution ที่เชื่อถือได้และคงเดิมข้ามเอกสาร ห้ามใช้ลำดับอัปโหลด หากไม่มีข้อมูลพอแยก identical fills ให้หยุดเพื่อ review ใน M2
- Application อ่าน snapshot ของบัญชี → merge → rebuild ทั้ง ledger เพื่อกัน oversell/backdated invalidity → append ด้วย expected revision ใน D1 batch หาก revision เปลี่ยนให้อ่านและตรวจใหม่สูงสุด 3 ครั้ง
- D1 guard, batch metadata, ledger rows และ audit เป็น transaction เดียว Unique/FK constraints เป็นแนวป้องกันซ้ำอีกชั้น ไม่ใช้ blanket INSERT OR IGNORE ปิดบัง conflict
- Source identity triggers ตรวจการใช้ id/เลขอ้างอิงกับ fingerprint ที่ขัดกัน รวมกรณีเรียก adapter ตรง และ rollback ทั้ง batch ไม่ฝากการตรวจไว้เฉพาะ precheck

เลือก optimistic revision ของ account แทนระบบ lock service เพิ่มเติม เพราะเป็นเว็บผู้ใช้เดียวและยังต้องป้องกันการยืนยันสองหน้าต่างพร้อมกัน D1 repository ไม่มีสูตร FIFO; raw prepared SQL ที่ guard ใช้เพื่อควบคุม atomic batch ส่วน schema/client ใช้ Drizzle เดิม

### 3. Precision และสูตรต้นทุน

Inputs คงขอบเขต M0: จำนวนเต็มไม่เกิน 18 หลัก ทศนิยมไม่เกิน 12 หลัก ห้าม exponent, NaN, Infinity หรือ JavaScript number สำหรับเงิน Decimal clone precision **96 significant digits**, **ROUND_HALF_EVEN** โดยไม่แก้ config global

- ต้นทุนซื้อ = quantity × executionPrice + fee + tax; fee/tax ต้องเป็น USD เหมือน trade
- Daily lot รวมจำนวนและต้นทุนซื้อของ account/security/tradeDate เดียวกันที่เกิดก่อนการขาย ณ จุดนั้น
- เมื่อขาย ตัด lot เก่าสุดก่อน: allocated cost = remaining lot cost × quantity consumed / remaining lot quantity
- Partial allocation ปัด HALF_EVEN ที่ **24 fractional digits**; ขาย lot ทั้งหมดใช้ต้นทุนคงเหลือเต็มจำนวนเพื่อไม่ทิ้ง residual
- Net sale proceeds = quantity × executionPrice − fee − tax
- Realized P/L = net sale proceeds − sum(allocated costs)
- Remaining cost basis = sum(remaining lot costs); average cost = remaining cost / remaining quantity (24 fractional digits); เมื่อไม่มีหุ้น average cost เป็น null
- Holdings value = quantity × supplied quote price; unrealized P/L = holdings value − remaining cost basis

ไม่มีการปัดเป็น cents ระหว่างคำนวณ การปัดเพื่อแสดงผลต้องทำแยกใน UI ภายหลัง และห้ามนำค่า averageCost ที่ปัดแล้วกลับไปเป็นฐานตัด lot

ตัวอย่างตรวจมือ: ซื้อวันแรก 100×10 + 50×12 = 1,600 USD / 150 หุ้น; วันถัดไป 30×15 = 450 USD; ขาย 120 หุ้น ตัดต้นทุน 1,600×120/150 = 1,280 USD เหลือ 60 หุ้น ต้นทุน 320+450 = **770 USD**

### 4. วันซื้อขายและการสลับซื้อ–ขายภายในวัน (ชั่วคราว)

ทุก execution instant ต้องมี UTC offset และเป็นวันที่จริง ใช้ **America/New_York** รวมวันซื้อขาย รองรับ DST โดยไม่พึ่ง timezone เครื่อง `tradeDate` ต้องตรงกับ date ที่ derive ได้ ชื่อหลักทรัพย์หรือ timezone ที่ caller เดาไม่ได้ใช้แทนข้อมูลจริง

เรียงตาม instant แล้ว `sequence` หากบัญชี/หลักทรัพย์เดียวกันมี instant และ sequence ซ้ำจนลำดับไม่ชัด ให้ปฏิเสธ ขายต้องมีจำนวนพอ **ณ เวลานั้น** ไม่ดึงซื้อที่เกิดทีหลังมาช่วยขาย และไม่เปลี่ยน realized P/L ของการขายก่อนหน้าเมื่อมีซื้อภายหลังในวันเดียวกัน ซื้อภายหลังรวมกับ daily lot ที่ยังเหลือ; หากขายหมดแล้วให้เริ่ม lot ใหม่

นี่เป็น **การตัดสินใจของโปรเจกต์ที่ยังไม่ผ่านการเทียบ Dime** บทความ Dime ยืนยันการรวมต้นทุนรายวันก่อน FIFO แต่ไม่บอก timezone, intraday ordering, fees หรือ exact rounding ตัวเลขต้นทุนเฉลี่ยที่แสดงในบทความปัดเพื่ออธิบาย ไม่ควรนำ 10.67 ไปคูณจริงแล้วคาดหวัง 770 พอดี หากเอกสาร M2 พิสูจน์นโยบายต่างออกไป ต้องออก ADR/เวอร์ชัน policy และ replay Ledger ใหม่อย่างมีหลักฐาน

### 5. Quote และ FX เป็นข้อมูลแยกจากต้นทุน

Engine รับ quote และเวลาประเมินจาก caller เท่านั้น ไม่ fetch ตลาด ราคา/FX มี source, asOf และ dataMode ที่ส่งต่อไปผลลัพธ์ ขาด quote ให้ null; quote เก่าให้ STALE พร้อมมูลค่าอ้างอิงจากราคานั้น ไม่แอบอ้างว่าราคาปัจจุบัน คุณภาพ DELAYED/EOD/UNKNOWN และป้าย MOCK คงอยู่ แม้ผ่านเกณฑ์อายุที่ caller กำหนด

Current USD/THB FX ใช้แปลงมูลค่าและ unrealized P/L เป็น **REFERENCE_ONLY** แยกสถานะ missing/stale FX จาก quote; historical THB realized P/L เป็น null / UNAVAILABLE เพราะ M1 ยังไม่มี execution cash flows และ historical FX ที่ยืนยันแล้ว Daily P/L เป็น null เช่นกันเมื่อไม่มี previous close/snapshot

ไม่ใช่ระบบคำนวณภาษีหรือยอดบัญชี Dime ทั้งหมด ยังไม่รวม cash balance, deposits, dividends, transfers, stock split, corporate actions หรือ FX execution spread

## หลักฐานและเอกสารทางการ

- [Dime: วิธีคิดต้นทุน Compressed FIFO](https://dime.co.th/th/articles/compressed-fifo-dime) — ยืนยัน daily compression; ไม่สรุป broker parity เกินหลักฐาน
- [D1 batch transaction](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) — statement ล้มเหลว rollback ทั้ง batch
- [Cloudflare migration tests](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/#readd1migrationsmigrationspath) — ใช้ migration จริงใน local Workers tests
- [decimal.js API](https://mikemcl.github.io/decimal.js/) — clone แยก config และกำหนด precision/rounding

## สิ่งที่ M2 ต้องพิสูจน์

ใช้เอกสารที่ปิดข้อมูลส่วนตัวเท่านั้น ระบุ fill reference/ลำดับ execution/timezone/fee/tax ที่พบจริง คำนวณ SHA-256 จากไฟล์ใน browser และยืนยันหลัง review ทดสอบกรณีเอกสารซ้ำข้ามรูปแบบ/หลายไฟล์/partial fills และเทียบ intraday policy กับ Dime ถ้าข้อมูลไม่พออย่าเดาเลขหรือลำดับ M1 ไม่ได้เริ่ม PDF.js/OCR/parser หรือ Import UI เหล่านี้
