# ADR 0006 — คำสั่งซื้อขายที่ยืนยันด้วยวันที่ในเอกสาร

วันที่: 8 พฤศจิกายน 2026 · สถานะ: การตัดสินใจสำหรับแก้ฐาน M2 ก่อนเริ่ม M3; ผลตรวจ implementation ดู M2_REPORT

## บริบท

เจ้าของอนุญาตให้ตรวจเอกสารตัวอย่างและแก้ฐานนำเข้า/คำนวณที่จำเป็นก่อน M3 โดยตรง รอบนี้ไม่เริ่ม Provider, Dashboard หรือ deployment ข้อความ M0-only ใน AGENTS.md และ CODEX_START.md ยังคงเป็นประวัติคำสั่งเริ่มงานครั้งแรก

M1 รับเฉพาะ execution fill ที่มีเวลา offset และ sequence ส่วน M2 foundation ยังคืนคำเตือนทั่วไปเพราะตอนนั้นเปิดไฟล์ตัวอย่างไม่ได้ ภายหลังตรวจตัวอย่าง Dime ในเครื่องได้แล้ว พบแบบฟอร์มสองหน้าชื่อ **Confirmation Note / Receipt / Tax Invoice** มี Effective Date, Issue Date, Settlement Date และตาราง Order ID, Securities [Exchange], Unit, Unit Price, Currency, Gross Amount, Fee Include Vat, Withholding Tax, Total Amount มี USD และยอดเทียบ THB แต่ไม่พบ execution timestamp หรือ sequence ราย fill

การบังคับให้ข้อมูลแบบนี้เป็น fill จะทำให้ต้องเดาเวลา/ลำดับ หรือให้ผู้ใช้กรอกทุกครั้ง ซึ่งขัดกับเป้าหมายอัปโหลดแล้วตรวจข้อมูล ตัวอย่างหนึ่งรายการซื้อยังไม่พิสูจน์เอกสารทุกแบบ การขายหลาย fills นโยบาย intraday หรือ rounding ของโบรกเกอร์

## การตัดสินใจ

### 1. เก็บชนิดหลักฐานตามที่มีจริงใน Ledger เดียว

- เพิ่มรายการยืนยันชนิด **DOCUMENT_DATE** สำหรับคำสั่งซื้อขายที่เอกสารยืนยันผลและมีวันที่ระดับรายการ เก็บวันที่ตาม Effective Date แยกจาก Issue Date และ Settlement Date ไม่แปลงเป็นเที่ยงคืน ไม่อนุมาน timezone และไม่สร้าง sequence จากลำดับแถวหรืออัปโหลด
- ยังคง execution fill เดิมที่มี instant/sequence ชัดเจนและพฤติกรรมเดิม ไม่ลดความละเอียดของประวัติที่มีหลักฐานครบ
- รายการทั้งสองชนิดอยู่ใน Transaction Ledger เชิงตรรกะชุดเดียว ใช้เส้นทางยืนยัน การป้องกันซ้ำ provenance และ account revision เดียวกัน ไม่สร้างยอดหุ้นหรือต้นทุนอีกชุดใน importer/UI
- Order ID เป็น **order reference** ของรายการชนิดนี้ เก็บในขอบเขตบัญชีด้วย `dime-order:v1:<orderId>` ไม่เปลี่ยนชื่อให้เป็น fill reference และไม่แตก order เป็น fills ที่เอกสารไม่แสดง ยังไม่มีหลักฐานว่าเลขนี้ไม่ซ้ำทั่วโลก หากเลขเดิมในบัญชีเดียวกันกลับมาพร้อมวัน หลักทรัพย์ หรือยอดเงินที่เปลี่ยน ต้องตรวจแทนการเพิ่มรายการใหม่อัตโนมัติ
- ยังไม่รับ DOCUMENT_DATE และ FILLED ปนกันสำหรับบัญชี/หลักทรัพย์เดียวกันจนมีวิธีเทียบหลักฐานและยืนยันการซ้อนอย่างชัดเจน ตรวจปฏิเสธทั้งก่อน append และที่ D1 triggers เพื่อไม่ให้ order รวมกับ fills เพิ่มหุ้นสองครั้ง

### 2. ยอดเงินที่รายงานเป็นหลักฐานของ order

เก็บ quantity, unit price, reported gross, fee ที่รวม VAT, withholding tax และ reported total/net เป็น Decimal String ในสกุล USD หลัก ยอด THB ที่พิมพ์เทียบในเอกสารไม่ใช่หลักฐาน execution FX หรือ cash conversion ส่วน THB, settlement date และ exchange เป็นหลักฐานใน local preview รอบนี้ ไม่ persist ใน Trade/D1 และไม่รับประกันว่าเรียกดูย้อนหลังได้หลังล้างหน้า

- ใช้ **reported gross/net** เป็นยอดหลักของ DOCUMENT_DATE เพราะ unit price อาจเป็นราคาเฉลี่ยที่แสดงแบบปัดแล้ว ไม่บังคับให้ quantity × displayed unit price เท่ากับ gross ทุกหลัก
- ต้นทุนซื้ออิงยอดสุทธิที่จ่ายตามเอกสาร; เงินรับขายอิงยอดสุทธิที่รับตามเอกสาร ความสัมพันธ์ gross + fee + withholding สำหรับ BUY และ gross − fee − withholding สำหรับ SELL ต้องตรวจด้วย Decimal หากไม่สอดคล้องให้ Review
- `Fee Include Vat` รวม VAT แล้ว ห้ามบวก VAT ซ้ำ `Withholding Tax` แยกจาก fee และห้ามถือเป็น VAT
- ฟิลด์ขาดหรืออ่านไม่ได้เป็น missing/NEEDS_REVIEW ไม่ใส่ศูนย์ ไม่ใช้ quote ตลาดเติม unit price ไม่เลือก USD/THB จากตำแหน่งข้อความที่คลุมเครือ
- สูตร quantity × executionPrice ของ fill เดิมคงอยู่ตาม ADR 0004 เฉพาะข้อมูลชนิดนั้น ไม่ใช้เปลี่ยนยอดที่เอกสาร order รายงาน

### 3. คำนวณเท่าที่ลำดับหลักฐานรองรับ

วันที่ DOCUMENT_DATE ใช้เรียงประวัติข้ามวันอย่างคงที่ ไม่ขึ้นกับลำดับการอัปโหลด ซื้อวันเดียวกันที่ไม่มีการขายปะปนรวมต้นทุนรายวันแล้วตัด FIFO ข้ามวันได้ โดยคง Decimal precision/partial residual policy เดิม

หากมีทั้ง BUY และ SELL ในวันเดียวกันโดยไม่มีหลักฐานลำดับที่พอเชื่อถือได้ ระบบยังหาจำนวนหุ้นสุทธิได้ แต่ให้ต้นทุนและ realized/unrealized P/L ที่ได้รับผลเป็น **unavailable พร้อมเหตุผล** ไม่เรียง BUY ก่อน SELL เพื่อให้คำนวณได้ ไม่ใช้อัปโหลดเป็น execution order และไม่ใช้ราคาเฉลี่ยย้อนสร้าง fills

หากประวัติก่อนหน้าขาดจนไม่สามารถยืนยันจำนวนที่ขายหรือต้นทุนได้ ให้บอกว่าประวัติไม่ครบ ไม่สร้าง opening lot หรือต้นทุนศูนย์ ช่วงที่มี execution fills ครบคงตรวจจำนวน ณ execution เดิม ข้อมูล ambiguous ไม่ควรทำให้ตัวเลขดูเหมือนยืนยันแล้ว

การตัดสินใจนี้เป็นนโยบายที่ซื่อสัตย์ต่อข้อมูลที่มี ไม่ใช่คำยืนยันว่า Compressed FIFO, intraday และ rounding ตรง Dime ทุกกรณี

### 4. Parser สำหรับ template ที่ตรวจแล้วเท่านั้น

PDF extraction เก็บ page/ตำแหน่งข้อความเพื่อจัดหัวตารางและคอลัมน์ ก่อนตีความ field ตาม template ที่มีหลักฐาน ไม่พึ่งลำดับ text items ที่อาจสลับ USD/THB หลายบรรทัด ใช้ขอบเขตไฟล์ หน้า ข้อความ จำนวนรายการ และเวลาเดิม พร้อมตรวจ teardown/cancellation ใน tests

ผล Review แสดง symbol/exchange, BUY/SELL, quantity, unit price, fee รวม VAT, withholding, gross/net, currency และวันที่แยกตามชนิด รวม field evidence/คำเตือน อ่าน template ไม่ครบ/ต่างแบบ/ไม่มี text layer ให้ NEEDS_REVIEW หรือ OCR_REQUIRED ตามเหตุ ไม่อ้างว่ามี OCR จริงแล้ว

Fixtures รักษาเฉพาะหัวข้อและรูปทรงตารางจาก template แต่ใช้ชื่อ เลขอ้างอิง หลักทรัพย์ วันที่ และจำนวนเงินที่แต่งใหม่ทั้งหมด ไม่เก็บ PDF ข้อความดิบ รหัสผ่าน หรือค่าจริงจากเอกสารเจ้าของใน repository/logs/screenshots/CI

### 5. ขอบเขตความปลอดภัยและการยืนยัน

Preview ไม่มี write การยืนยันภายใน reparse/revalidate, ตรวจ review digest และ pin account revision ก่อน atomic append ใน D1 เก็บ duplicate provenance โดยไม่เพิ่มหุ้นซ้ำ ต้องทดสอบหลังสร้าง repository ใหม่ด้วย migration จริง

ยังไม่เปิด HTTP imports/ledger/transactions หรือปุ่มยืนยันข้อมูลจริงผ่านเว็บจน Authentication และ Authorization ผ่านการทดสอบ การทดสอบ internal use case กับ D1 ไม่ใช่การอนุญาต transport สาธารณะ ไม่มี production deploy, secret storage หรือบริการเสียเงินในรอบนี้

## ผลกระทบและการตรวจรับ

ADR นี้แทนข้อกำหนด fill-only/ต้องมี execution instant/sequence และสูตรยอดเงินที่คำนวณเองของ ADR 0004/0005 **เฉพาะ DOCUMENT_DATE orders** ส่วน privacy, append-only/audit, validation, revision guard, review digest, full execution fill policy และ single D1 ยังคงเดิม

ตรวจด้วย synthetic template extraction, literal gross/net/cost expectations, duplicate order จากไฟล์เดิมและข้ามไฟล์, ย้อนลำดับเอกสารข้ามวัน, same-day ambiguity, missing history, missing fields, changed economics และ full-fill regressions ผลคำสั่งจริงและข้อจำกัดต้องรายงานใน M2_REPORT ไม่ใช้ผลจาก engine เองเป็น expected

วัด replay/preview และ D1 runtime ตามขนาดประวัติที่คาดว่าจะใช้ก่อนเปิด private transport ผล Node benchmark ไม่รับประกัน Workers Free CPU โควตาต้องตรวจจากเอกสารทางการอีกครั้งก่อน M3/M5 ไม่ optimize หรือเปิด paid plan เพื่อแก้ข้อจำกัดโดยยังไม่มีผลวัด

รายละเอียดแผน: [M3_READINESS_PLAN.md](../M3_READINESS_PLAN.md) · หลักฐานเฉพาะ template: [M2_DIME_EVIDENCE.md](../M2_DIME_EVIDENCE.md)
