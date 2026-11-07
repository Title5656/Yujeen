# ADR 0002 — Cloudflare D1 เพียงฐานข้อมูลเดียว

วันที่: 2026-11-07 · สถานะ: ยอมรับตาม PROJECT_SPEC.md

## การตัดสินใจ

ใช้ D1 ผ่าน Drizzle เท่านั้น Package database export schema และ factory ที่รับ D1 binding โดยไม่สร้าง connection เอง ไม่สร้าง Database Switcher, ORM-based financial logic หรือ cloud resource

M0 มีเพียง `schema_versions(version PRIMARY KEY, label NOT NULL)` เพื่อพิสูจน์ Drizzle schema, SQL migration และ local D1 integration ด้วยข้อมูลสังเคราะห์ ยังไม่สร้างตารางธุรกรรมก่อนออกแบบ Ledger ใน M1 ให้ครบ

Migration ถูกเก็บใน repository; Wrangler apply ด้วย `--local` เท่านั้น UUID ศูนย์เป็น local placeholder ไม่มี production ID หรือ credential ตัว runtime test apply SQL จริงและ query ผ่าน Drizzle บน D1 emulator

## ผล

M1 จะเพิ่ม accounts, securities, transactions และ indexes/constraints ที่จำเป็น พร้อม transaction/idempotency ตามสเปก ตัวเลขทางการเงินใน schema ที่เพิ่มภายหลังต้องเป็น decimal string ไม่ใช้ SQLite REAL หรือตัดสิน cost basis ใน persistence

ไม่มี remote migration หรือ deploy ใน M0; การ restore/backup และ provisioning ต้องรอ milestone ที่กำหนด

## อ้างอิง

- https://orm.drizzle.team/docs/get-started/d1-new
- https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/

ใช้ Drizzle stable 0.45.4 สำหรับ M0 แม้คู่มือปัจจุบันแสดงตัวอย่าง rc; ไม่ย้ายไป release candidate โดยไม่จำเป็น ใช้ `@cloudflare/vitest-plugin` รุ่นปัจจุบัน ไม่ใช้ pool-workers รุ่นเก่า
