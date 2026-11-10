# งบ 0 บาทและการตรวจโควตาก่อนเปิดบริการ

วันที่ตรวจเอกสาร: 10 พฤศจิกายน 2026 สถานะ: ข้อกำหนดและแบบจำลอง ยังไม่ใช่ผลวัดหรือการตรวจบัญชีจริง

## เงื่อนไขที่ต้องผ่าน

- ค่าเริ่มต้น/ประจำ/ต่ออายุ/ส่วนเกินต้อง 0 บาท ไม่ใช้ trial หรือเครดิตโปรโมชั่น แม้ใช้ฟรีได้ช่วงหนึ่ง
- ใช้ Free Plan ที่เกินแล้วปฏิเสธงาน หรือมีการปิด paid usage แบบบังคับที่พิสูจน์ได้ การแจ้งเตือนค่าใช้จ่ายไม่เพียงพอ
- ไม่ผูกบัตรหรือเปิดบริการคิดเงินเอง ไม่ถือว่าการไม่มีบัตรอย่างเดียวพิสูจน์ว่าไม่มีหนี้ ต้องตรวจสัญญาบริการและ billing settings จริง
- ไม่ซื้อโดเมน ใช้ hostname ฟรีของผู้ให้บริการเมื่อระบบสิทธิ์ป้องกันได้ครบ หากวิธี auth ต้องใช้บริการเสียเงินให้เลือกวิธีอื่นก่อนเปิด private API
- รวมต้นทุน CI/build/cache/artifacts, logs, backup, auth/email, market data/FX และ M6 ไม่ใช่เฉพาะ hosting
- หากผู้ให้บริการเปลี่ยนเงื่อนไข ให้หยุดบริการก่อนคิดเงิน ไม่อ้างว่าฟรีตลอดกาล ไม่เปิด paid plan หรือเปลี่ยนฐานข้อมูลเอง

## ข้อจำกัดที่ตรวจจากเอกสารทางการ

| รายการ         | Free limit ที่ตรวจพบ                                                   | การรับมือ                                                                                                                            |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Workers        | 100,000 requests/วันต่อบัญชี; reset เที่ยงคืน UTC; เกินเป็น Error 1027 | คง Free Plan ปิด fail-open ที่อาจข้าม auth; เมื่อเต็มอาจเปิดข้อมูลออนไลน์ไม่ได้                                                      |
| Workers CPU    | 10 ms ต่อ HTTP request และ Cron invocation                             | วัด parse/auth/replay จริงใน M3 ก่อนผูกเส้นทางใช้งาน ไม่รอ M5; ไม่ผ่านต้องลด/แบ่งงานโดยรักษา atomicity และ security                  |
| D1 rows        | อ่าน 5 ล้าน/วัน เขียน 100,000/วัน                                      | Free เมื่อเกินคืน error; รวม indexes, retries, migrations, restore และงานอื่นในบัญชี                                                 |
| D1 storage     | 500 MB ต่อ DB, รวมบัญชี 5 GB                                           | โปรเจกต์ใช้ DB เดียวจึงติด 500 MB ก่อน; ไม่สร้าง DB เพิ่มเพื่อหลบขอบเขต                                                              |
| GitHub Actions | private repo ใช้ included compute/storage และส่วนเกินอาจคิดเงิน        | ตรวจค่า allowance/budget ของบัญชีจริง ปิด paid usage ให้ครบ หากทำไม่ได้ให้รัน CI ในเครื่อง; ไม่รับรองว่าตั้ง private แล้วทุกอย่างฟรี |

แหล่งข้อมูล: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

## แบบคำนวณตั้งต้น — สมมติฐานเพื่อออกแบบ ไม่ใช่ผลวัด

ใช้ตัวอย่าง 20 symbols รวม Holdings/Watchlist, refresh ทุก 15 นาทีตลอด 24 ชั่วโมงแบบ conservative, ใช้หลายหน้าจอร่วม cache เดียว:

- รอบราคา: 24 × 60 ÷ 15 = 96 รอบ/วัน
- ถ้า Provider รองรับ batch ทั้ง 20 symbols = 96 calls/วัน; ถ้าคิดราย symbol = 1,920 หน่วย/วัน ต้องตรวจวิธีคิดหน่วยจริง
- จำกัดรวม initial + retry ไม่เกิน 3 attempts → สูงสุด 288 batch calls หรือ 5,760 symbol units/วัน; FX สมมติ 1 ครั้ง/วันรวม retry สูงสุด 3 calls ยังไม่รวม manual refresh/Test Connection จึงต้องแชร์ hard quota counter เดียวกัน
- หากเก็บ latest quote อย่างเดียวมี 20 แถว ไม่ใช่สะสม 1,920 แถวทุกวัน แต่เกิด upsert 1,920 ครั้ง/วัน สูงสุด 5,760 หาก retry เขียนซ้ำ; actual rows_written อาจมากกว่าเพราะ indexes ต้องวัด
- API ของหน้าเว็บสมมติ 200 requests/วัน + เผื่องานอื่นและ scheduler 300 = 500/วัน หรือ 0.5% ของ 100,000 ไม่รวมทราฟฟิกที่ไม่คาดหมาย และการประเมินนี้ไม่แทน platform hard stop
- หากทุก 200 คำขอ scan Ledger 10,000 แถว จะอ่าน 2,000,000 แถว/วัน (40% ของ D1 free reads) ก่อนนับงานอื่น จึงห้าม replay/read ทั้ง Ledger ทุก card/poll ใช้ revision/cache และ pagination ตามที่พิสูจน์ว่าถูกต้อง
- ตัวอย่าง storage ที่ต้องแทนด้วยค่าที่วัด: Ledger พร้อม indexes/evidence 2 KB × 10,000 = 20 MB; snapshot ทั้งพอร์ต 10 KB × 365 = 3.65 MB/ปี และประมาณ 18.25 MB/5 ปี (วันละหนึ่ง snapshot) รวมประมาณ 38.25 MB ก่อนข้อมูลอื่น ถ้า snapshot ทุก 15 นาทีจะเป็น 350.4 MB/ปี จึงไม่เก็บ intraday ไม่จำกัด
- นโยบายเสนอ: snapshot ระหว่างวันเก็บแบบจำกัด retention แล้วเก็บรายวันระยะยาว; cache/log ลบตามอายุ Ledger/evidence ห้ามลบเองเพื่อเคลียร์พื้นที่

ตัวเลขนี้ไม่พิสูจน์ว่า Provider ใดฟรีเพียงพอ หาก daily/monthly/rate quota ต่ำกว่าต้องลดความถี่/จำนวน symbols/batch ไม่ซื้อโควตา การคำนวณรายเดือนใช้จำนวนวันสูงสุด 31 และเผื่อ usage ของทั้งบัญชี

## เกณฑ์ควบคุมและตรวจรับ

1. ก่อนเปิดแต่ละบริการทำตารางชื่อแผน, allowance, หน่วยวัด, reset window/timezone, พฤติกรรมเมื่อเต็ม, hard stop, trial/renewal, แหล่งอ้างอิง/วันที่ และหลักฐาน account setting แบบไม่มี secrets หากข้อมูลไม่ครบยังไม่ผ่าน
2. เป้าหมาย workload ปกติไม่เกิน 50% ของโควตาที่เหลือในบัญชี; แจ้งเตือน 70%, หยุด background/manual refresh ที่ 80%, สำรอง 20% ให้งานจำเป็น ไม่ใช่รับประกันว่า counter ของแอปบล็อก traffic ทุกชนิดได้ Platform Free/hard stop เป็นตัวป้องกันค่าใช้จ่ายสุดท้าย
3. Provider quota counter ต้อง atomic รวม cron/manual/Test Connection/retry; restart/สองแท็บไม่รีเซ็ตงบ ไม่ fallback ไป paid provider หรือ MOCK ที่แสดงเป็นจริง
4. ที่ quota stop แสดงข้อมูลเก่าพร้อมเวลาเมื่ออ่านได้ ถ้า D1/Worker ปฏิเสธทั้งระบบให้แสดง unavailable เมื่อทำได้ ห้ามรับปากว่าอ่าน cache ได้เสมอขณะ infrastructure เต็ม
5. วัด Workers CPU รวม auth, contract validation, parse/replay ด้วย fixtures หลายขนาด; วัด D1 meta.rows_read/rows_written และขนาด DB จริง รวม migration/restore/indexes ในรายงานก่อนผ่าน M3 และตรวจซ้ำ M5
6. Storage แจ้งเตือนก่อนเต็ม จำกัด cache/log/snapshot retention อัตโนมัติแบบมี tests; ถ้า Ledger จำเป็นกินพื้นที่เกินงบ ให้หยุดรับเพิ่มพร้อม export/recovery plan ไม่ลบประวัติเอง
7. ทดสอบ simulated quota exhaustion, 429, timeout, retries, concurrent refresh, storage full และบริการเปลี่ยนเป็น paid/unavailable: ไม่มี auto-upgrade ไม่มีข้าม auth ไม่มีข้อมูลเก่าแสดงเป็นสด
8. ทุก milestone อัปเดตแบบจำลองด้วยค่าที่วัดจริงและขนาดใช้งานที่เจ้าของต้องการ รวมประมาณการ 1/3/5 ปี; ถ้ายังไม่ผ่านงบให้รายงาน blocked เฉพาะส่วนบริการ ไม่กล่าวว่า deploy พร้อมแล้ว

## สิ่งที่ยังไม่ยืนยัน

ยังไม่ได้ตรวจ billing settings ของบัญชี Cloudflare/GitHub, Auth ที่ใช้งานจริง, US Quote/FX Provider, จำนวนหุ้น/ประวัติจริง หรือวัด CPU บน Cloudflare ไม่มีการสมัครบริการ เปลี่ยน billing ตั้ง spending cap หรือ deploy ในรอบนี้ ดังนั้นยืนยันได้ว่ากำหนดกฎงบไว้แล้ว แต่ยังยืนยันระบบทั้งชุดใช้ฟรีภายใต้ workload จริงไม่ได้
