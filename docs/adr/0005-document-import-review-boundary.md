# ADR 0005 — Local document extraction and reviewed M2 import

วันที่: 8 พฤศจิกายน 2026 · สถานะ: ใช้สำหรับ M2 foundation; รูปแบบ Dime จริงยังไม่ยืนยัน

## บริบท

เจ้าของสั่งเริ่ม M2 โดยตรง จึงทำต่อจาก M1 ได้ แม้เอกสาร bootstrap เดิมระบุ M0-only สำหรับรอบแรก ต้องพิสูจน์ execution/timezone/sequence/fee/tax/cost จากไฟล์ที่เจ้าของจะนำเข้าก่อนเปิด automatic import

รอบนี้ข้อความระบุว่ามีเอกสารแนบ แต่ `list_artifacts` คืนรายการว่างและไม่พบ PDF ใน workspace จึงใช้ข้อ 7.3 ของ PROJECT_SPEC: parser interface, mock parser และ synthetic fixtures เท่านั้นสำหรับการตีความธุรกรรม ไม่ถือว่าการอ่านข้อความ PDF เป็นหลักฐานว่าอ่านธุรกรรม Dime จริงถูกแล้ว ไม่ใช้รหัสผ่านที่ส่งในแชตเป็น fixture หรือบันทึกลงไฟล์

## การตัดสินใจ

1. **Extraction ในเครื่อง:** ใช้ PDF.js 6.5.438 แบบ pinned (Apache-2.0) อ่าน bytes โดยตรง ไม่รับ URL/remote endpoint, hash SHA-256 ของ bytes ต้นฉบับก่อนส่งสำเนาเข้า PDF.js รวมถึงไฟล์ที่เข้ารหัส หน้า Import ใช้ PDF worker asset ที่ build/serve จาก origin เดียวกัน ไม่มี CDN หรือ OCR service
2. **ขอบเขตทรัพยากร:** ไฟล์ >0 ถึง 10 MiB, สูงสุด 20 หน้า, 500,000 text characters, 10,000 lines, 100 draft rows, เวลา extraction หลังโหลด PDF.js สูงสุด 15 วินาที อ่านข้อความแบบ stream และหยุดเมื่อเกินขอบเขต ไม่ตัดทิ้งเงียบ ๆ รองรับ AbortController และทำลาย loading task เมื่อจบ/ผิดพลาด/ยกเลิก
3. **รหัสผ่านและ privacy:** รหัสผ่านเป็น state ชั่วคราว ล้างช่องหลังทุก attempt และเมื่อเปลี่ยน/ล้างไฟล์ ไม่ใส่ localStorage/sessionStorage/URL/log/database แปลง library errors เป็น safe codes; ไม่ส่งเนื้อหาที่เสียหายหรือ exception details กลับให้ UI ไม่มีการ upload เอกสารหรือเก็บ raw extraction ใน D1
4. **แยกอ่านข้อความกับตีความ:** ExtractedDocument มี hash/page/line/method/confidence; DimeParser เวอร์ชัน `dime-unverified-v1` คืน UNVERIFIED_DIME_FORMAT และไม่มี trade drafts สำหรับรูปแบบที่ยังไม่พิสูจน์ หน้าไม่มี text layer คืน OCR_REQUIRED; ยังไม่ติดตั้ง/อ้างว่ามี OCR อ่านภาพจริงสำเร็จ
5. **Synthetic protocol แยกชัด:** SyntheticDimeParser รับเฉพาะ header `YUJEEN_SYNTHETIC_DIME_V1` ตามด้วย JSON หนึ่ง fill ต่อบรรทัด เวอร์ชัน `synthetic-dime-v1`, dataMode MOCK และ formatVerified=false เสมอ โปรโตคอลนี้แต่งขึ้นเพื่อทดสอบ pipeline ไม่ใช่รูปแบบ Dime ที่คาดเดาและไม่เปิดให้หน้า UI ใช้แทน parser จริง
6. **Draft ไม่ใช่ Ledger:** ใช้ Zod ที่ extraction/input/output boundaries; ค่าฟิลด์ที่ไม่มีเป็น null ไม่ตั้ง fee/tax เป็น 0 ไม่ใช้เวลาวันที่เอกสาร/เวลา upload แทน execution ไม่ใช้ราคาตลาดเป็น executionPrice ไม่สร้าง sequence จากตำแหน่งบรรทัด
7. **Identity ที่ตรวจได้:** ต้องมี explicit execution instant พร้อม offset, sequence เป็น nonnegative safe integer, fill reference ที่ระบุ referenceKind=FILL และ field evidence confidence ≥0.98 ใน synthetic workflow (เกณฑ์ 0.98 เป็นนโยบาย conservative ของโปรเจกต์ ยังไม่ผ่านการปรับกับ OCR จริง) ใช้ sourceRow ระบุตำแหน่งเท่านั้น; account ภายในและ mapping symbol+market+currency → securityId ต้องกำหนดชัด มีหลาย mapping/ไม่มี mapping ให้ตรวจ ไม่ใช้ ticker เป็น identity
8. **Stable provenance:** batch ID เป็น `import:v1:<encoded accountId>:<documentSha256>`; source trade ID เป็น `<batch ID>:row:<sourceRow>` ไม่ขึ้นกับเวลานำเข้า/การ reload ไม่ใช้ order ID แทน fill ID เก็บ alias และ dedup ตาม M1 ไม่แยก/เฉลี่ยค่าธรรมเนียมรวมของ order โดยเดาเอง
9. **Preview และ confirm:** Preview ไม่เขียนข้อมูล ใช้ M1 TradeSchema/validateTrade/mergeLedger/rebuildPositions ตรวจทุกแถว, same-file identity, cross-file duplicates, ambiguous fills, oversell และ backdated invalidity ผล NEEDS_REVIEW/NOT_FILLED ห้ามยืนยันทั้ง batch ในรอบนี้ (ยังไม่มี workflow เลือกตัดบางแถว) review digest SHA-256 ผูก extraction/mapping/rows/ledger revision; เป็น change detector ไม่ใช่ auth token
10. **ยืนยันผ่าน use case ภายใน:** confirmImport ต้องได้รับ reviewed=true, digest และ source rows ครบ แล้ว reparse/re-read/revalidate ก่อนส่งเข้า recordConfirmedTrades ของ M1 โดย pin expectedRevision ให้ตรง revision ที่ผู้ใช้ review ทุกครั้ง ถ้าข้อมูลเปลี่ยนระหว่าง revalidation/write หรือ append guard conflict ให้ PREVIEW_CHANGED และต้อง review ใหม่ ผู้เรียก M1 เดิมที่ไม่ส่ง expectedRevision ยัง retry/rollback เช่นเดิม ใช้ confirmedAt จริงจาก caller ที่ผ่าน M1 validation ไม่เปลี่ยนสูตร FIFO/precision/schema ไม่สร้างยอด position อีกชุด
11. **HTTP ปิดจนมี auth:** ไม่มี imports/ledger/transactions routes เพิ่ม; GET/POST private paths ยัง 404 ทั้ง Node API tests หน้า Import ตรวจไฟล์ในเครื่องได้ แต่ปุ่มบันทึก disabled จน format verification และ authentication/authorization ผ่าน ไม่สร้าง Dashboard หรือระบบสิทธิ์ลัดเพื่อเปิด import
12. **Valuation แยกอายุ:** ValuationContext เปลี่ยนจาก maxAgeMs เป็น quoteMaxAgeMs และ fxMaxAgeMs ที่ต้องส่งทั้งคู่ ไม่มี implicit fallback ทดสอบทั้งสองทิศทาง/ขอบเขต/invalid thresholds โดยคง quote quality, MOCK, reference FX และ historical unavailable semantics

## ผลต่อ dependencies และค่าใช้จ่าย

Web ใช้ importers สำหรับ local extraction/parser ได้ตาม spec; ESLint ยังกัน direct domain/database/market-data imports ใน UI Importers ไม่เขียน D1; domain ยังไม่ขึ้นกับ Zod/PDF/React/Worker/ORM ไม่มี migration ใหม่เพราะเก็บ drafts ใน memory ส่วนการยืนยันใช้โมเดล M1 เดิม

เพิ่มเพียง PDF.js และ optional canvas dependencies ที่ package ใช้สำหรับ local Node tests; ไม่เพิ่ม subscription, cloud OCR, storage service, provider/API key หรือ deploy การจำกัด 100 rows เป็น project limit เพื่อให้ review และงานต่อครั้งมีขอบเขต ไม่ใช่การอ้างว่า D1 batch ถูกจำกัด 50 statements: เอกสาร D1 ปัจจุบันระบุว่า batch นับเป็น query เดียว แต่ข้อจำกัดแต่ละ statement ยังใช้

ผล Node benchmark ใน M2_REPORT เป็น baseline ก่อน optimize ไม่ใช่ CPU quota benchmark บน Workers Free การ replay ทั้งประวัติอาจเกินงบ CPU เมื่อ Ledger ใหญ่ ต้องวัด runtime/budget และออกแบบแก้ด้วยหลักฐานก่อนเปิด transport จริง เป้าหมาย 0 บาทยังคงเดิม ไม่แก้ด้วยการเปิด paid plan

## แหล่งทางการที่ตรวจ

- [PDF.js getDocument API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) — byte input, password และ TypedArray ownership; ตรวจเทียบ declarations ของ package ที่ติดตั้งจริงด้วย
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) — batch query accounting และขอบเขตต่อ statement
- หลักฐานจากไฟล์ของเจ้าของ: **ยังไม่มีไฟล์ที่เปิดอ่านได้** จึงไม่อนุมานข้อมูล execution/cost ของ Dime จากเอกสารเว็บแทน

## เงื่อนไขปลดข้อจำกัด

ทำ checklist ใน [M2_DIME_EVIDENCE.md](../M2_DIME_EVIDENCE.md) กับเอกสารจริงในเครื่องโดยไม่ commit เอกสาร/ข้อความส่วนตัว สร้าง fixture ปิดข้อมูลส่วนตัวหรือ synthetic ที่รักษา layout ที่พิสูจน์แล้ว เพิ่ม parser version ใหม่และ tests โดยยังไม่เปลี่ยน alias ของเอกสารที่ยืนยันแล้ว หากนโยบายวัน/rounding/cost ต่างจาก ADR0004 ต้องมี policy ADR ใหม่ก่อนใช้จริง
