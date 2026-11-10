# ร่างแผน M3–M6 — พอร์ตหุ้นสหรัฐฯ และมุมมอง USD/THB

วันที่: 10 พฤศจิกายน 2026 · สถานะ: ร่างสำหรับตรวจขอบเขต ไม่ใช่คำสั่งเริ่ม implementation หรือ deploy

**เงื่อนไขบังคับเพิ่มเติม:** งบบริการ 0 บาท ห้าม trial/paid allowance/overage เมื่อเต็มให้หยุด ไม่ตัดเงิน ต้องผ่าน [นโยบายงบและโควตา](../../ZERO_BUDGET_POLICY.md) ตั้งแต่ M3 ไม่รอ M5 งาน M6 ทุกส่วนอยู่ภายใต้กฎเดียวกัน

## 1. เป้าหมายและขอบเขต

ให้เจ้าของนำเข้าเอกสาร Dime ตรวจยืนยัน แล้วดูหุ้นสหรัฐฯ/US ETF จำนวน ต้นทุน มูลค่า และกำไรขาดทุนได้ทั้ง USD และ THB โดยทุกยอดมีหลักฐานหรืออัตราอ้างอิงที่อธิบายได้ ใช้ภาษาไทยเป็นหลัก ผู้ใช้เดียว ค่าใช้จ่ายประจำเป้าหมาย 0 บาท

ใช้ Modular Monolith และ pnpm Monorepo เดิม, Cloudflare D1 ฐานเดียว ไม่มีระบบเปลี่ยน Database/API ฐานข้อมูล ไม่มีหุ้นไทยหรือ Thai Experimental Provider ในรอบนี้ การเลือก Market Data Provider ที่มี Adapter รองรับยังอยู่ในแผน

คำขอรอบนี้ครอบคลุมการตรวจและร่างงานเท่านั้น M3–M5 คือเส้นทางปิด MVP ส่วน M6 เป็นงานหลัง MVP ที่แบ่งเลือกทำ ไม่ใช่เงื่อนไขบังคับก่อนใช้งานเว็บ และไม่อนุญาตให้เริ่มทุกช่วงโดยอัตโนมัติ

แนวทางที่เล็กที่สุด: ต่อ `valuePosition` และ Ledger เดิมด้วยราคา/FX และชั้นแสดงผล ไม่สร้าง Ledger บาทอีกชุด ไม่ทำระบบหลายฐานข้อมูล ไม่รื้อชนิด TH ที่มีอยู่เฉย ๆ จนเสี่ยง migration; จำกัดฟีเจอร์และ API ที่เปิดใช้งานไว้ที่ US

## 2. ผลตรวจแผนเทียบโค้ดจริง

| ประเด็น                                        | หลักฐานในโค้ดปัจจุบัน                                                                                                                                 | ผลต่อแผน                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ยังไม่มี private API/auth                      | `apps/api/src/app.ts` ลงทะเบียนเฉพาะ health routes                                                                                                    | M3-A ต้องมาก่อน Settings และ transport ของ Import                                      |
| Contract ยังรับ MOCK เท่านั้น                  | `packages/contracts/src/market-quote.ts` และ `packages/market-data/src/provider.ts`                                                                   | ขยาย Contract และทดสอบ LIVE ก่อนเชื่อม Provider ไม่เปลี่ยนป้าย MOCK ให้เป็น LIVE เฉย ๆ |
| มี valuation สกุลบาทบางส่วนแล้ว                | `packages/domain/src/valuation.ts` มี `referenceTHB`, source/asOf, stale และ historical FX unavailable                                                | ใช้ต่อและเพิ่ม conversion ของต้นทุน/ยอดรวม ไม่เขียนสูตรซ้ำใน React                     |
| ยังบันทึกผ่านเว็บไม่ได้                        | `apps/web/src/features/imports/TransactionPreview.tsx` ปุ่ม disabled; `confirm-import.ts` เป็น internal use case                                      | M4-A ต้องต่อ UI → private API → revalidation → D1 ให้ครบ                               |
| THB ในเอกสารยังไม่ persist                     | `DocumentOrderSchema.thbAmounts` ใน `packages/contracts/src/document-import.ts`; `documentOrders` ใน `packages/database/src/schema.ts` ไม่มีฟิลด์ THB | M4-B เก็บหลักฐาน THB ที่ตรวจยืนยันแยกจากต้นทุน USD แบบ additive                        |
| Backend preview ปัจจุบันรับ extracted document | `apps/api/src/modules/imports/preview-import.ts` parse `request.document` ใหม่                                                                        | ต้องกำหนด payload ที่ลดข้อมูลส่วนตัวและทดสอบ server revalidation ก่อนเปิด endpoint     |
| หน้าพอร์ตส่วนใหญ่ยัง placeholder               | `apps/web/src/app/App.tsx`                                                                                                                            | M4 ยังเป็นงานสร้างหน้าจอจริง ไม่ใช่แค่ต่อราคา                                          |
| OCR/field correction ยังค้าง                   | `ImportPage.tsx` รับ PDF และรายงาน `docs/M2_READINESS_REPORT.md`                                                                                      | กำหนดเจ้าของงานใน M4-D เพื่อไม่ให้หายจาก MVP โดยปริยาย                                 |

ผล 350 Node + 34 Workers/D1 + 16 browser tests เป็นผลที่รายงานเมื่อ 8 พฤศจิกายน ไม่ได้รันซ้ำในรอบร่างแผนนี้ ต้องรัน baseline เมื่อเริ่ม implementation

## 3. กติกา USD/THB ที่เสนอ

ข้อกำหนดจากเจ้าของ: ดูได้ทั้งบาทและดอลลาร์แบบ Dime ข้อเสนอการออกแบบของร่างนี้: เริ่มต้นแสดง THB, จำสกุลที่เลือกบนอุปกรณ์, สลับ USD/THB ได้จากตำแหน่งเดียวและใช้ร่วมกันทุกหน้าพอร์ต แสดงยอดอีกสกุลในรายละเอียด โดยไม่เปลี่ยนภาษา UI หรือข้อมูล Ledger

| ข้อมูล                     | USD                                | THB                                                                                                      |
| -------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| จำนวนหุ้น                  | จำนวนเดิม                          | จำนวนเดิม ไม่คูณ FX                                                                                      |
| ราคาหุ้น/มูลค่าปัจจุบัน    | Quote USD และ quantity × price     | USD × reference FX ล่าสุด พร้อม source/asOf และป้าย “ประมาณการ”                                          |
| ต้นทุน/ต้นทุนเฉลี่ยคงเหลือ | ผล Compressed FIFO ที่มีหลักฐานครบ | ต้นทุน USD × FX เดียวกับ valuation พร้อมป้าย “ต้นทุนเทียบบาท ณ เรตอ้างอิง”                               |
| Unrealized P/L             | มูลค่า USD − ต้นทุน USD            | P/L USD × reference FX; ยังไม่รวมกำไรขาดทุนจากการแลกเงินจริง                                             |
| Realized P/L               | ผลขายที่ Ledger คำนวณได้           | แปลงเป็นบาทอ้างอิงได้เมื่อแสดงป้ายชัด; “กำไรเงินบาทจริง” ยัง unavailable จนมีหลักฐาน cash/FX ย้อนหลังครบ |
| ยอดธุรกรรมในเอกสาร         | ยอด USD ที่ยืนยัน                  | แสดง “ยอด THB ตามเอกสาร” เมื่อ persist แล้ว ไม่แทนด้วย FX วันนี้และไม่เรียกว่าเรตแลกเงินจริง             |
| กราฟมูลค่าพอร์ต            | snapshot USD ณ แต่ละเวลา           | snapshot USD × FX ของจุดเวลานั้น ไม่ใช้เรตวันนี้ย้อนหลังทั้งกราฟ                                         |

แยกข้อมูล 3 ความหมายใน Contract/UI: มูลค่าแปลงด้วย reference FX, ยอด THB ที่เอกสารรายงาน, และ cash/FX ที่เกิดจริงซึ่งเป็นงาน M6 หากไม่มีหลักฐานชนิดสุดท้ายห้ามอนุมานจากอัตราส่วน THB/USD ใน Confirmation Note

สูตรอ้างอิง: `THB = USD × rate` โดย `rate` หมายถึงบาทต่อ 1 USD เก็บ Decimal String คำนวณเต็มความแม่นยำ ปัดเฉพาะแสดงผล เงินรวม 2 ตำแหน่งแบบ HALF_UP; ราคาต่อหน่วยให้ดูทศนิยมเพิ่มได้ จำนวนหุ้นไม่ถูกตัดเหลือ 2 ตำแหน่ง ยอดรวมคำนวณจากค่าก่อนปัด ไม่รวมตัวเลขที่ปัดแล้ว

เปอร์เซ็นต์ P/L ที่แปลงต้นทุนและมูลค่าด้วยเรตเดียวกันต้องเท่ากันทั้งสองสกุล; ไม่สื่อว่าเป็นผลตอบแทนบาทรวม FX ส่วนต้นทุน unavailable ต้องคง unavailable แม้มีราคา/FX ครบ

กรณี FX ขาด: USD ยังใช้ได้ THB แสดง “ไม่มีอัตราแลกเปลี่ยน” ไม่แทนด้วย 0 หรือ 1 กรณี FX/Quote เก่า: แสดงค่าล่าสุดพร้อมสถานะเก่าและเวลาของแต่ละแหล่ง ไม่เลื่อน asOf เป็นเวลา fetch หรือเวลา refresh หน้าจอ

ยอดรวมพอร์ตที่บางหุ้นไม่มีราคาให้ระบุว่าไม่ครบ พร้อมจำนวนรายการที่คำนวณได้ ห้ามแสดง subtotal เป็นยอดรวมครบ หากมี MOCK ปนต้องแสดงสถานะจำลองชัดทั้งยอดรวม ไม่ให้กลายเป็น LIVE

ตัวอย่างเกณฑ์ทดสอบ (ข้อมูลจำลอง): 2 หุ้น ต้นทุน USD 180 ราคา USD 100, FX 35 → มูลค่า USD 200/THB 7,000 ต้นทุนเทียบ THB 6,300 และกำไร USD 20/THB 700 เมื่อ FX เป็น 36 โดยราคาเดิม → THB 7,200/6,480/720; จำนวนหุ้น ต้นทุน USD และ Ledger ไม่เปลี่ยน

สำหรับกราฟมี snapshot USD 200 ที่ FX 35 แล้ว USD 200 ที่ FX 36 ต้องเห็น THB 7,000 และ 7,200; หากจุดแรกไม่มี FX ให้เว้นช่องพร้อมเหตุผล ไม่เติมเรตจุดหลังกลับไป

## 4. ลำดับและการพึ่งพา

`M3-A สิทธิ์ → M3-B Contracts/Provider → M3-C Cache/Secrets → M3-D Settings/FX → M4-A Import transport → M4-B หลักฐานบาท → M4-C พอร์ตสองสกุล → M4-D ปิดงานนำเข้า → M4-E Watchlist/กราฟ → M5 ใช้งานจริง → M6 ส่วนต่อยอด`

งานออฟไลน์และ Contract tests ทำได้ก่อนมีบัญชีจริง แต่ M3 จะยังไม่ถือว่าผ่านครบจนมี US Provider อย่างน้อยหนึ่งรายและ FX ที่เจ้าของใช้งานได้จริง การเลือก/สมัครบัญชีและการพิสูจน์สิทธิ์เป็น dependency ภายนอก ไม่ใช้การเปิด paid plan แก้อัตโนมัติ

## 5. M3 — ระบบสิทธิ์ ราคา FX และ Settings

### M3-A: ป้องกัน API ก่อนข้อมูลส่วนตัว

- เพิ่ม auth middleware และ owner authorization ใน `apps/api/src/middleware/` เชื่อมที่ `apps/api/src/app.ts`; server เป็นผู้กำหนด owner/account ที่อนุญาต ไม่เชื่อ accountId จาก browser
- ข้อเสนอเริ่มต้นคือประเมิน Cloudflare Access สำหรับเจ้าของคนเดียวก่อน หาก Free Plan/วิธีเข้าถึงของเจ้าของใช้ไม่ได้ ให้เสนอทางเลือกและบันทึก ADR ก่อนเลือกจริง ห้ามถือว่ามีบัญชีหรือโดเมนพร้อมแล้ว
- ตรวจ token signature/issuer/audience/expiry และตัวตนเจ้าของ ป้องกันทางเข้าตรงของ Worker ที่ข้าม gateway; local test identity ต้องใช้ได้เฉพาะ local/test และปิดตายเมื่อ config production ไม่ครบ
- คำขอเปลี่ยนข้อมูลต้องป้องกัน CSRF/origin ตามวิธี session ที่เลือก; private responses ไม่ถูก shared cache; logs ไม่เก็บ token หรือ payload ส่วนตัว
- ผ่านเมื่อ tests ปฏิเสธ anonymous, ผู้ใช้อื่น, token ปลอม/หมดอายุ, เปลี่ยน accountId, เข้า alternate host และ cross-origin mutation; เจ้าของที่ถูกต้องใช้งานได้

### M3-B: Contracts และ US/FX Adapters

- ขยาย `packages/contracts/src/market-quote.ts`, `packages/market-data/src/provider.ts`; เพิ่ม FX schema และ adapter contract โดยยึด `ReferenceFx` ใน Domain และแปลงผ่าน Use Case
- Registry ระบุ provider ID, ตลาด, feed, capability และ credential fields ที่รองรับ; ชุดข้อมูล LIVE/MOCK แยกชัด ไม่มี arbitrary endpoint
- เลือก US Adapter หนึ่งรายตามสิทธิ์จริงของเจ้าของ; Alpaca เป็น candidate ไม่ใช่ข้อสรุป บันทึก coverage/feed/delay/license/quotas วันที่ตรวจ และเลือกแหล่ง USD/THB ที่ใช้ฟรีได้จริง ไม่ผูกว่า Provider หุ้นต้องมี FX ด้วย
- HTTP client อยู่ฝั่ง server มี timeout, error mapping และ retry จำกัด ไม่ retry AUTH_FAILED แบบวน; validate response และจับคู่ security identity ห้ามเดาราคาเมื่อไม่พบ symbol
- ผ่านเมื่อ deterministic contract tests ครอบคลุม success, 401/403, 429/Retry-After, timeout, malformed/partial response, currency mismatch และ stale/future timestamp; live smoke แยกจาก CI และไม่พิมพ์ secrets

### M3-C: Credentials และ D1 Cache

- เพิ่ม migration, repository และ use cases แยกตามหน้าที่ใน `packages/database/` และ `apps/api/src/modules/market-data/`
- Credentials เข้ารหัส AES-GCM ตาม ADR 0003 ใช้ nonce ใหม่, key version และ Master Key ใน Worker Secret; response คืนเฉพาะสถานะ masked ห้ามคืน plaintext; บันทึกแนวทางเปลี่ยน key/recovery
- Cache quote/FX พร้อม source/feed/asOf/fetchedAt และ provider config version; เปลี่ยน provider ต้องไม่หยิบ cache เก่ามาติดป้ายใหม่
- กำหนด freshness/refresh budget ตามสิทธิ์จริงและรอบข้อมูลของแต่ละแหล่ง ใช้ batch/coalesce และ cache เพื่อลดคำขอ; 429 ให้ backoff และแสดงข้อมูลเก่าอย่างตรงไปตรงมา ไม่ fallback ไป MOCK ในโหมดจริง
- ผ่านเมื่อ D1 integration tests ตรวจ encrypted-at-rest, decrypt failure ไม่รั่ว, concurrent refresh ไม่ยิงซ้ำเกินนโยบาย, provider switch ไม่ปะปน feed และเปลี่ยน Provider ไม่เปลี่ยน Ledger

### M3-D: Settings และเตรียม valuation สองสกุล

- สร้าง `apps/web/src/features/settings/` และ routes/use cases ฝั่ง API: save credentials → Test Connection → Activate; activate เฉพาะ config version ที่ทดสอบผ่านล่าสุด เก็บตัวเก่าไว้เมื่อ candidate ล้มเหลว
- Settings แสดง US Provider และ FX Provider ที่รองรับ สถานะ/เวลา sync/error โดยไม่เปิดตัวเลือก Database หรือหุ้นไทย
- ต่อ Quote/FX ที่ validate แล้วเข้า Domain; เพิ่ม DTO ที่ส่งค่า USD/THB และสถานะจากการประเมินครั้งเดียวให้ UI ใช้ เลี่ยงการคำนวณคนละเรตในแต่ละ card
- ผ่านเมื่อ E2E จำลองเปลี่ยน config/test/activate/reload ได้, failed test ไม่ activate, key ไม่อยู่ใน response/storage/logs และค่า THB ตัวอย่างตรงข้อ 3

**จบ M3:** เจ้าของเข้า Settings ได้อย่างปลอดภัย มี US Quote และ FX จริงตามสิทธิ์ที่ตรวจ มี cache/สถานะข้อมูลครบ ผลรายงานแยก offline tests กับ live verification ชัด หากบัญชีบริการยังไม่พร้อมให้รายงานว่างาน live acceptance ยังไม่ผ่าน

## 6. M4 — นำเข้าใช้งานจริงและพอร์ต USD/THB

### M4-A: เปิดเส้นทาง Review → Confirm → Ledger

- ต่อ `ImportPage`, `TransactionPreview` และ `useLocalDocument` เข้ากับ authenticated preview/confirm API โดยใช้ `previewImport` และ `confirmImport` เดิม
- เพิ่มขั้นตอนสร้างบัญชี DIME US ของเจ้าของและ resolve security จากข้อมูลอ้างอิงที่ยืนยันได้; ไม่ให้ client สร้าง owner, currency หรือ exchange mapping ตามอำเภอใจ
- PDF/รหัสผ่านอยู่ใน browser; ก่อนส่ง extracted text ไป server ให้ตัดส่วนระบุตัวตนและส่วนไม่จำเป็นด้วยกฎที่มี fixtures รองรับ คง table/metadata ที่จำเป็นต่อ reparse; หากลดข้อมูลอย่างปลอดภัยไม่ได้ให้ block พร้อมเหตุผล ไม่ส่ง raw document ทั้งชุดเป็น fallback
- แจ้งผู้ใช้ชัดว่าข้อมูลซื้อขายที่จำเป็นจะส่งไปตรวจ/บันทึกหลัง login; body/error/logs ต้องไม่เก็บข้อความดิบ ชื่อ เลขบัญชี หรือรหัสผ่าน
- Server ตรวจใหม่, ผูก account กับ owner, กำหนด confirmedAt ฝั่ง server และรักษา revision guard/dedup/atomic write; network timeout หลัง commit ต้อง retry แล้วไม่เพิ่มหุ้นซ้ำ
- ผ่านเมื่อ import → review → confirm → reload เห็น Ledger เดิมครบ, forged context ถูกปฏิเสธ, รายการซ้ำ/สองแท็บ/preview เปลี่ยนให้ผลปลอดภัย และไม่มีเอกสารส่วนตัวใน fixtures/screenshots

### M4-B: เก็บหลักฐาน THB จากเอกสาร

- เพิ่ม optional evidence record ผูกกับ ledger entry/source row: reported THB gross/fee/tax/net, document hash, parser version, page/line และสถานะตรวจยืนยัน เก็บ Decimal String โดยไม่แก้เศรษฐศาสตร์ USD
- ทำ additive migration และรวม write กับ confirm แบบ atomic; ข้อมูลเก่าไม่มี THB ให้แสดง unavailable ไม่ backfill ด้วย current FX
- หลักฐาน THB เพิ่มจากไฟล์ซ้ำไม่สร้างธุรกรรมอีกชุด ไม่เปลี่ยน fingerprint ของ fill/order เก่า; หลักฐานขัดกันต้อง review และมี audit ไม่ overwrite เงียบ ๆ
- ผ่านเมื่อยอดเอกสารยังอยู่หลัง reload/export/restore, USD FIFO เท่าเดิมทุก regression และ reported THB ไม่ถูกนำไปอ้าง execution FX

### M4-C: Dashboard, Holdings, Transactions สองสกุล

- ต่อ `packages/domain/src/valuation.ts` ด้วย conversion ของต้นทุน/realized reference และ aggregate portfolio ที่รู้ partial coverage; UI ใช้ผล DTO ไม่เขียน FIFO/สูตรเงินซ้ำ
- เพิ่ม display preference THB/USD และ formatter ร่วม ไม่มี round-trip แปลงกลับไปเขียน Ledger; ใส่สกุลให้ชัดใน table, card, tooltip และรายละเอียดธุรกรรม
- Dashboard แสดง Holdings Value, cost/P&L ที่คำนวณได้และปัญหาข้อมูล; Transactions แยกยอดเอกสารกับยอดแปลงอ้างอิงให้ดูย้อนหลังได้
- ผ่านเมื่อกรณีตัวอย่างข้อ 3 ตรง, toggle ทุกหน้าสอดคล้อง/reload จำค่าได้, FX หายยังดู USD ได้, missing basis ไม่กลายเป็น 0, partial quote ไม่กลายเป็น total และรองรับมือถือ/keyboard

### M4-D: ปิดช่องว่างงานนำเข้าของ MVP

- ทำ correction เฉพาะฟิลด์ที่ต้องตรวจ พร้อม original evidence, ค่าแก้, เหตุผล และ audit; server validate ใหม่และ review digest ต้องเปลี่ยนตามการแก้ ห้ามแก้เวลา/ลำดับที่ไม่มีหลักฐานเพื่อบังคับให้คำนวณได้
- เพิ่ม OCR ภายใน browser สำหรับชนิดภาพ/หน้า scan ที่ประกาศรองรับ พร้อม confidence, resource limits, cancel/cleanup และ Review; ไม่ส่งภาพไปบริการเสียเงิน ไม่อ้างรองรับทุก layout
- แก้รายการที่ confirm แล้วด้วย audited correction/reversal ตามนโยบายที่ออก ADR ไม่แก้ทับประวัติเงียบ ๆ; replay และ dedup ต้องคงความถูกต้อง
- ผ่านเมื่อ synthetic unreadable field → correction → confirm ได้, low confidence ถูกบังคับ review, unsupported layout ไม่เดาตัวเลข และ correction replay ไม่ทำให้หุ้นซ้ำ
- หากจะเลื่อน OCR/correction ออกจาก MVP ต้องให้เจ้าของเปลี่ยนขอบเขตอย่างชัดเจน ไม่ถือว่ารายงานว่า “ยังค้าง” เท่ากับอนุมัติเลื่อน

### M4-E: Watchlist และกราฟที่ตรวจย้อนกลับได้

- Watchlist CRUD แยกจาก Ledger และ owner-scoped ใช้ Quote/FX cache เดียวกับ Holdings; เพิ่ม ticker ไม่สร้างการถือหุ้น
- เพิ่ม snapshot schema/use case ตั้งแต่ M4 เก็บ valuation time, ledger revision, source/feed/FX provenance และ status; เริ่มเก็บเมื่อมีข้อมูลจริง ไม่รอ M5 แล้วค่อยมี schema
- กราฟเริ่มจาก snapshot ที่มีจริง พื้นที่ก่อนเริ่มเก็บเป็นไม่มีข้อมูล; ณ M4 snapshot ทำตาม refresh แบบจำกัดความถี่และ idempotent, M5 เพิ่ม Cron
- แยกกราฟ “มูลค่าหุ้นที่ถือ” ออกจาก “ผลตอบแทน”; การซื้อเพิ่มไม่ใช่กำไร Daily P/L จะคง unavailable จนมี baseline และวิธีหักผลธุรกรรมที่พิสูจน์ได้ ไม่ใช้ส่วนต่างมูลค่าสองวันเรียกกำไรทันที
- ผ่านเมื่อ snapshot THB ใช้ FX ณ จุดนั้นตามข้อ 3, ไม่มีการเติมกราฟสมมติ, reimport ย้อนหลังทำเครื่องหมาย snapshot revision เก่าและ rebuild เฉพาะเมื่อมีราคา/FX ย้อนหลังครบ ไม่แก้ประวัติราคาด้วยค่าปัจจุบัน

**จบ M4:** เส้นทางเข้าใช้ → นำเข้า → ตรวจ/แก้ → ยืนยัน → Reload → ดูพอร์ต USD/THB ใช้งานได้จริง มี Watchlist/กราฟตามหลักฐาน และงานค้าง M2 ที่อยู่ใน MVP ถูกปิดหรือได้รับการปรับขอบเขตจากเจ้าของแล้ว

## 7. M5 — ความพร้อมใช้งานจริง

| งาน                       | สิ่งที่ต้องส่งมอบและเกณฑ์ผ่าน                                                                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M5-A Export/Restore       | JSON versioned + checksum ไม่รวม secrets; export Ledger/evidence/audit/watchlist/preferences และข้อมูล snapshot ที่ต้องรักษา; restore ใน D1 ทดสอบใหม่ได้ยอด USD/THB เดิม ไม่รับไฟล์เสีย/รุ่นไม่รองรับ และ rollback เมื่อ restore ไม่ครบ   |
| M5-B Cron/Monitoring      | Quote/FX refresh และ snapshot แบบ idempotent มี lock/lease ตามความจำเป็น, bounded retries, quota budget, last-success/error และ log ที่ไม่มีข้อมูลส่วนตัว; cron ซ้อน/429/บริการล่มไม่สร้างซ้ำหรือเปิดค่าใช้จ่าย                           |
| M5-C Security/Performance | ทดสอบ auth ทุก private route, CSRF, expired/revoked session ตามกลไกจริง, direct-host bypass, secret leakage, dependency/build outputs; วัด Workers/D1 CPU และ rows ด้วยประวัติจำลองตามขนาดที่ตั้งใจใช้ ไม่อ้าง Node benchmark แทน runtime |
| M5-D Deploy/Recovery      | ตรวจ Free Plan/license/quota ของบัญชีจริง, runbook ตั้ง Worker Secrets/D1/migrations/owner, rollback และ restore drill; staging ใช้ข้อมูลจำลองก่อน เปิด production เฉพาะเมื่อเกณฑ์ความปลอดภัยผ่านและเจ้าของอนุญาต                         |

**นิยามการตรวจ Restore:** เปรียบเทียบ Ledger/จำนวนหุ้น/ต้นทุนเดิมโดยตรง และเทียบ USD/THB ณ เวลาสำรองด้วย valuation inputs ชุดเดิมที่ export ไปด้วย (ราคา, FX, source/feed, asOf, valuedAt, ledger revision และสถานะ) หรือ snapshot ที่บันทึกข้อมูลเหล่านี้ครบ ไม่ดึงราคาปัจจุบันมาทดสอบความเท่ากัน หลัง restore ค่าที่นำกลับมาต้องคงเวลาเดิมและติด stale ตามอายุ เมื่อ refresh ราคา/FX ใหม่ มูลค่าปัจจุบันเปลี่ยนได้ตามข้อมูลตลาด โดยไม่ถือเป็น restore failure

MVP เสร็จเมื่อผู้ไม่มีสิทธิ์เข้าไม่ได้ เจ้าของเปิดเว็บขณะปิดคอมได้ นำเข้าและดู USD/THB ได้ สถานะข้อมูลตรงจริง backup กู้คืนได้ และมีหลักฐานว่า workload อยู่ในงบฟรีที่ตรวจ ณ วันเปิดใช้งาน หากเกินงบให้ลด refresh/workload หรือแก้จุดคอขวดก่อน ห้ามเปิด paid plan เอง

## 8. M6 — งานหลัง MVP แบ่งเลือกทำ

ลำดับข้างล่างเป็นข้อเสนอ ไม่ใช่ requirement ว่าต้องทำทุกอย่างก่อนใช้งาน M6 แต่ละส่วนจบได้แยกกัน ต้องกำหนด scope/สิทธิ์บริการและรับคำสั่งก่อนเริ่ม

| ช่วง | งาน                                                | Dependency และเกณฑ์ตรวจรับ                                                                                                                                                                                                          |
| ---- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M6-A | Cash/Dividend/Corporate Actions และ FX ที่เกิดจริง | ต้องมีเอกสารและนโยบายชัด สร้างรายการ cash/FX/dividend/split แบบตรวจสอบได้; cash reconcile และ split ไม่สร้างกำไรเทียม; THB realized จริงเปิดเฉพาะกรณีหลักฐานครบ ไม่มีข้อมูลให้ unavailable                                          |
| M6-B | Portfolio Analytics                                | หลัง cash flow/baseline ครบ นิยาม TWR/MWR และช่วงเวลาตามที่เลือกในแผนย่อย; tests พิสูจน์ว่าเงินฝาก/ถอนและซื้อหุ้นเพิ่มไม่ถูกนับเป็นกำไร และแยกผลหุ้นกับ FX ได้เท่าที่ข้อมูลรองรับ                                                   |
| M6-C | Price Alerts ผ่าน Telegram                         | หลัง quote freshness และ credential security พร้อม; เจ้าของตั้ง rule/ปลายทางเอง, stale quote ไม่กระตุ้น, dedup/cooldown/retry ไม่ส่งซ้ำ; token เข้ารหัสและข้อความไม่เผยพอร์ตเกินที่เลือก                                            |
| M6-D | Gmail Auto Import                                  | ตรวจ OAuth scopes/เงื่อนไขใช้ฟรีและวิธีเปิด PDF เข้ารหัสก่อน; email ที่อนุญาต → draft → review → confirm เท่านั้น ไม่ auto-confirm, ไม่เก็บรหัสผ่าน PDF, email/attachment ซ้ำไม่สร้าง Ledger ซ้ำ; disconnect/revoke/delete data ได้ |
| M6-E | Provider หุ้นสหรัฐฯ/FX เพิ่มเติม                   | ใช้ Contract/registry เดิม มี deterministic tests และ live smoke ตามสิทธิ์; การสลับแหล่งไม่เปลี่ยน Ledger ไม่มีหุ้นไทยโดยอัตโนมัติ                                                                                                  |
| M6-F | Custom REST Mapper ที่ปลอดภัย (ทางเลือก)           | ทำเฉพาะมี use case จำเป็นและเจ้าของอนุมัติแบบย่อย; ต้องออกแบบ allowlist, redirect/DNS/private-network protections, schema/response limits และ secret handling ก่อน ไม่เปิด arbitrary URL ภายใต้ชื่อ Custom Provider                 |

ถือว่าปิด M6 เมื่อรายการที่เจ้าของเลือกมีผลตรวจรับและคู่มือ ส่วนรายการที่ไม่เลือกแสดง “เลื่อน/ไม่อยู่ในขอบเขต” ไม่กล่าวว่าพัฒนาเสร็จ

## 9. แนวทางลงมือและตรวจรับรายช่วง

ทุกช่วงย่อยเริ่มจากตรวจสเปก/ADR และ baseline ปัจจุบัน แล้วเพิ่ม failing behavior test → implement → ผ่าน targeted test → ตรวจ regression ที่กระทบ → ทบทวน diff และบันทึกผล ค่อย commit ตามขอบเขตงาน ไม่รวม secrets หรือเอกสารจริง

เมื่อจบ Milestone ให้รัน `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` และ `pnpm test:smoke` สำหรับเส้นทางเว็บที่เกี่ยวข้อง Migration/restore ต้องตรวจบน D1 emulator และ Worker tests ใช้ `@cloudflare/vitest-plugin` ตามสเปก

Domain/Provider tests ใช้ fixtures และนาฬิกาที่ควบคุมได้ ไม่มีบัญชีจริงใน CI; live smoke เป็นรายการแยก ระบุ provider/feed และสถานะที่ตรวจโดยไม่เปิด secrets ไม่ใช้คำว่า “ผ่าน M3” เมื่อผ่านเพียง Mock

รายงานแต่ละ Milestone ระบุไฟล์และเหตุผล คำสั่ง/ผลที่รันจริง ข้อจำกัด วิธีรัน และงานถัดไปตาม AGENTS.md ก่อน implementation ให้แตกช่วงที่กำลังเริ่มเป็นแผนงานระดับไฟล์/Interface/Test โดยยึดร่างนี้หลังเจ้าของตรวจขอบเขตแล้ว ไม่ล็อก API ของทุก M6 ล่วงหน้า

## 10. Dependency ที่ต้องปิดก่อนเริ่มส่วนที่เกี่ยวข้อง

- M3-A: ตรวจวิธีเข้าใช้ของเจ้าของและ Cloudflare Access/Free Plan จริง เลือกกลไก auth และออก ADR โดยไม่สร้างบัญชีหรือเปิดค่าใช้จ่ายเอง
- M3-B: เจ้าของมีสิทธิ์ US Provider ใด และแหล่ง USD/THB ใดให้ใช้ได้จริง เลือกอย่างละหนึ่งหลังตรวจเอกสาร/เงื่อนไข ไม่ถือว่า Alpaca สมัครผ่านแล้ว
- ก่อน M4-C: ยืนยันรายละเอียด UX เมื่อทำหน้าจอ เช่น THB เริ่มต้นและรูปแบบแสดงสกุลรอง; เป็นข้อเสนอในร่าง ไม่ได้อ้างว่าเจ้าของเลือกแล้ว
- ก่อน M5-D: หลักฐาน security/restore/quota และอนุญาต deploy; ก่อน M6 เลือกเฉพาะรายการที่ต้องการ

## 11. แหล่งข้อมูลและข้อจำกัดของการตรวจ

ตรวจโค้ด/เอกสารใน workspace ณ วันที่ร่าง ไม่ได้รัน test suite ใหม่หรือเชื่อมบัญชีจริง ไม่มีภาพหน้าจอ Dime จึงตีความ “แบบ Dime” เฉพาะการดูสองสกุล ไม่รับรองหน้าตา สูตร FX หรือยอดตรงกับแอป Dime ทุกกรณี

- [Alpaca Market Data](https://docs.alpaca.markets/us/v1.1/docs/about-market-data-api): Basic ให้ข้อมูลหุ้นแบบ real-time จำกัด IEX จึงต้องระบุ feed และไม่อ้างครอบคลุมทั้งตลาดจากคำว่า real-time เพียงอย่างเดียว; ต้องตรวจสิทธิ์บัญชีจริงอีกครั้ง
- [Cloudflare Access token](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/): ต้อง validate token/signature ของทางเข้าที่ต้องป้องกัน ไม่เชื่อเพียง identity header
- [Cloudflare Access บน Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/): ใช้ตรวจแนวทาง integration ปัจจุบันก่อน implementation; ร่างนี้ยังไม่ได้ยืนยัน Free Plan หรือวิธี deployment ของบัญชีเจ้าของ

ข้อสรุปการตรวจ: ปรับแผนก่อนเริ่ม โดยให้ auth เป็นงานแรก จัดเจ้าของงาน Import/OCR ที่ค้าง และกำหนดความหมาย THB ให้ชัด จะต่อระบบเดิมจนจบ MVP ได้โดยไม่ต้องเปลี่ยนสถาปัตยกรรมหลัก
