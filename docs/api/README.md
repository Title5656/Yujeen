# HTTP API — สถานะหลังแก้ฐาน M2 ก่อน M3

`GET /api/health` → HTTP 200, `Content-Type: application/json`

```json
{ "status": "ok" }
```

API และ web ตรวจ payload ด้วย `HealthResponseSchema` จาก `@portfolio/contracts` ไม่มี secret, portfolio data หรือ database readiness ใน health

Unknown route → HTTP 404:

```json
{ "error": { "code": "NOT_FOUND", "message": "ไม่พบเส้นทางที่ร้องขอ" } }
```

Unexpected exception → HTTP 500:

```json
{ "error": { "code": "INTERNAL_ERROR", "message": "เกิดข้อผิดพลาดภายในระบบ" } }
```

Error body ตรวจด้วย `ApiErrorSchema`; ไม่ส่ง exception text หรือ stack trace HTTP API อื่นใน PROJECT_SPEC.md เป็นแผน ยังไม่ได้เปิดใช้งานใน M0

M2 เพิ่มเพียง internal `previewImport` และ `confirmImport` ยังไม่ได้ลงทะเบียน HTTP routes: `GET`/`POST /api/imports`, `/api/imports/preview`, `/api/imports/confirm`, `/api/transactions` และ `/api/ledger` ตอบ typed 404 เสมอจน Authentication/Authorization พร้อม หน้า Import อ่านไฟล์ใน browser ไม่ส่ง PDF/text/password ไป API; review digest ไม่ใช่ token สำหรับเข้าถึงระบบ

รอบแก้ฐานก่อน M3 เพิ่มการอ่าน template Confirmation Note และ DOCUMENT_DATE order ในเส้นทางภายในตาม [ADR 0006](../adr/0006-document-date-orders.md) ไม่เปลี่ยน public HTTP surface การทดสอบ internal confirmation ผ่าน D1 ไม่ใช่การเปิด private routes หรือ auth bypass

ก่อนเปิด private endpoint ใด ๆ รวม Provider Settings ใน M3 ต้องมี Authentication/Authorization และ tests ตรวจผู้ไม่มีสิทธิ์ แม้หัวข้อระบบสิทธิ์เต็มชุดอยู่ใน M5 ของแผนเดิม ส่วน import ต้องคง reparse/revalidate, reviewed digest, account revision และ atomic append; cost/P&L unavailable จากหลักฐานไม่พอต้องรักษาเหตุผลใน DTO ที่จะออกแบบเมื่อเปิด endpoint ไม่สร้าง timestamp/sequence เพื่อให้ schema ผ่าน
