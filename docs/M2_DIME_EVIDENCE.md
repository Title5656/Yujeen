# M2 — หลักฐานรูปแบบเอกสาร Dime

วันที่ 8 พฤศจิกายน 2026 · **ตรวจตัวอย่างในเครื่องแล้วเฉพาะ template ที่ระบุด้านล่าง**

ตอนทำ M2 foundation ยังไม่มีไฟล์ที่เปิดอ่านได้ จึงใช้ unverified parser ต่อมาเจ้าของอนุญาตให้ตรวจเอกสารจริงและแก้ฐานก่อน M3 ตรวจทั้งสองหน้าโดยไม่เพิ่มไฟล์ ข้อความดิบ รหัสผ่าน หรือค่าระบุตัวบุคคลใน repository เอกสารนี้บันทึกเฉพาะหัวข้อ โครงสร้าง และข้อจำกัด ตัวอย่างที่เก็บใน tests ใช้ค่าแต่งใหม่ทั้งหมด

| สิ่งที่ตรวจ                | หลักฐานที่พบ                                                      | ผลต่อการพัฒนา                                                                                       |
| -------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ประเภทแบบฟอร์ม             | สองหน้า ชื่อ Confirmation Note / Receipt / Tax Invoice            | parser เฉพาะ template นี้; ไม่อ้างครอบคลุม Dime ทุกแบบ                                              |
| วันที่ในส่วนหัว            | Effective Date, Issue Date, Settlement Date                       | แยกความหมาย; Effective Date ใช้วันระดับรายการ ไม่ใช้ issue/settlement แทน execution time            |
| ตารางหลัก                  | Order ID, Securities [Exchange], Unit, Unit Price, Currency       | แยก symbol/exchange, quantity, unit price และ currency ตามคอลัมน์/ตำแหน่ง; เลข order ไม่ใช่ fill ID |
| ยอดเงิน                    | Gross Amount, Fee Include Vat, Withholding Tax, Total Amount      | เก็บ gross/net ที่รายงาน; fee รวม VAT แล้ว; withholding แยก; missing ไม่แทนด้วยศูนย์                |
| สกุลเงิน                   | USD หลักพร้อมยอด THB เทียบในเอกสาร                                | ห้ามอ่านข้อความสลับคอลัมน์; THB ไม่ใช่หลักฐาน execution FX                                          |
| ความละเอียดเวลา            | ไม่พบ execution timestamp/offset หรือ per-fill sequence           | ใช้ DOCUMENT_DATE order; ห้ามเติมเที่ยงคืน timezone หรือลำดับอัปโหลด                                |
| หลาย fills                 | ตัวอย่างไม่แสดงการแตก order เป็น fills                            | ไม่สร้าง fills หรือแบ่ง fee เอง                                                                     |
| ความครบถ้วนของผลซื้อขาย    | ตัวอย่างที่ตรวจเป็นการซื้อที่ยืนยันใน confirmation                | จำกัด parser ตามหลักฐาน; pending/cancelled/สถานะคลุมเครือต้องไม่เพิ่มหุ้น                           |
| Text layer และลำดับข้อความ | PDF อ่านข้อความได้ แต่ตารางหลายคอลัมน์ต้องใช้ตำแหน่งประกอบ        | ทดสอบ geometry ด้วย synthetic fixture; text order ล้วนไม่พอ                                         |
| PDF สแกน/OCR               | ตัวอย่างนี้ไม่พิสูจน์ OCR ภาพ                                     | image-only ให้ OCR_REQUIRED; ยังไม่อ้างว่ามี OCR engine จริง                                        |
| Intraday/FIFO/rounding     | หนึ่งรายการซื้อไม่พิสูจน์การขาย partial หรือ BUY/SELL วันเดียวกัน | คงข้อจำกัด broker parity; ข้อมูลลำดับไม่พอให้ cost/P&L unavailable                                  |

## สิ่งที่พิสูจน์ได้และไม่ได้

ตัวอย่างนี้เพียงพอให้พัฒนา field mapping และ structured Review สำหรับ template ดังกล่าว ไม่ต้องบังคับผู้ใช้กรอก execution time/sequence ที่เอกสารไม่ได้ให้ ใช้ยอด gross/net ที่รายงานเป็นหลักของ order เพราะราคาต่อหน่วยที่แสดงอาจถูกปัดไว้แล้ว การใช้ข้อมูลนี้ใน Ledger อธิบายใน [ADR 0006](adr/0006-document-date-orders.md)

ยังต้องมีหลักฐานเพิ่มเติมสำหรับเอกสารขาย หลาย fills, partial execution, layout อื่น, ความคงที่ของ order reference ข้าม confirmation/statement และ intraday/rounding ของโบรกเกอร์ ก่อนเพิ่มขอบเขต parser หรือกล่าวว่าต้นทุนตรง Dime ทุกกรณี กรณี same-day BUY/SELL ที่ไร้ลำดับและประวัติไม่ครบต้องบอกข้อจำกัด ไม่สร้าง opening lots หรือเลขต้นทุนขึ้นเอง

## การตรวจรับที่ต้องเก็บใน repository

- Synthetic PDF รักษาหัวข้อและรูปทรงตารางที่ตรวจแล้ว แต่เปลี่ยนชื่อ เลขบัญชี เลขอ้างอิง หลักทรัพย์ วันที่ และจำนวนเงินทั้งหมดเป็นค่าแต่ง
- ตรวจ PDF extraction → parser → structured Review → internal confirm → D1 ด้วย migration จริง และสร้าง repository ใหม่ก่อนตรวจ replay
- กำหนด expected จำนวน/gross/net/fee/cost แบบ literal ที่คำนวณแยกจาก engine; รวมกรณี unit price × quantity ต่างจาก reported gross เพราะ precision ที่แสดง
- Reupload และ order เดิมจากอีกไฟล์ไม่เพิ่มหุ้นสองครั้ง; changed economics หรือ identity ซ้อนต้องตรวจ; เอกสารย้อนหลังให้ผลข้ามวันเหมือนกันไม่ว่าลำดับอัปโหลดเป็นอย่างไร
- ฟิลด์ขาด คอลัมน์สลับ สถานะคลุมเครือ ไม่มี text layer และ layout ไม่รองรับ ต้องมีเหตุผลให้ตรวจ ไม่มีค่า default ที่แต่งขึ้น
- Full execution-fill tests เดิมยังผ่าน และ private HTTP endpoints/ปุ่มยืนยันจริงยังปิดจน auth ผ่าน

ผลคำสั่งและจำนวน tests สรุปใน [M2_REPORT.md](M2_REPORT.md) ไม่เก็บผลทดลองจากเอกสารจริงที่มีตัวเลขส่วนตัวเป็น log หรือ screenshot แผนงานที่เหลืออยู่ใน [M3_READINESS_PLAN.md](M3_READINESS_PLAN.md)
