# ADR 0003 — Built-in provider adapters และการตั้งค่าในอนาคต

วันที่: 2026-11-07 · สถานะ: ยอมรับตาม PROJECT_SPEC.md

## การตัดสินใจ

M0 มี `MarketDataProvider` และ `MockProvider` แบบ deterministic เท่านั้น ไม่เรียก Market API และไม่มี registry/configuration endpoint ที่ใช้งานจริง เมนู Settings เป็น placeholder

Quote ต้องมี security identity, market, decimal price, currency, source/feed, asOf/fetchedAt, quality และ dataMode MOCK fixture timestamp คงที่เพื่อไม่แสดงราคาจำลองเป็นข้อมูลสด ไม่พบ security ให้ตอบ error UNSUPPORTED แทนสร้างราคาโดยเดา ห้ามใช้ symbol อย่างเดียวระบุหลักทรัพย์ข้ามตลาด

ใน M3 ให้เพิ่ม adapters และ registry ของ provider ID ที่รองรับจริง แล้วเปิดเลือก provider/API key ผ่าน Settings โดยไม่แก้ source หรือ redeploy เก็บ configuration ที่ไม่ลับใน D1 และเข้ารหัส credentials ฝั่ง server ด้วย AES-GCM; master key เป็น Worker Secret ห้ามส่ง plaintext key กลับ frontend ห้ามให้ผู้ใช้ระบุ URL อิสระ

## ผล

Provider เปลี่ยนได้โดยไม่เปลี่ยน Ledger หรือต้นทุน ไม่มี provider SDK ใน web/domain และไม่มี key ใน browser bundle Contract errors เตรียมหมวด RATE_LIMITED, AUTH_FAILED, UNSUPPORTED, NETWORK, STALE_DATA และ PROVIDER_ERROR; retry/quota/fallback จริงเป็นงาน M3

สิทธิ์ข้อมูล US/TH และเงื่อนไขฟรียังต้องตรวจเมื่อเชื่อม provider จริง ไม่มีการอ้าง feed real-time หรือทำระบบซื้อขาย
