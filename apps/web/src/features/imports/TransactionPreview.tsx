import type { ParsedDocumentImport } from '@portfolio/contracts';

export function TransactionPreview({ parsed }: { parsed: ParsedDocumentImport }) {
  return (
    <section className="import-review" aria-labelledby="import-review-title">
      <h2 id="import-review-title">
        {parsed.formatVerified ? 'อ่านรายการซื้อขายได้แล้ว' : 'NEEDS_REVIEW'}
      </h2>
      {parsed.formatVerified ? (
        <>
          <p>รายการต่อไปนี้อ่านจากใบยืนยันซื้อขาย กรุณาเทียบกับต้นฉบับ ไม่ต้องพิมพ์รายการใหม่</p>
          {parsed.issues.length > 0 && (
            <p role="alert">มีส่วนของเอกสารที่ยังอ่านไม่ครบ ต้องตรวจต้นฉบับก่อนนำเข้าทั้งชุด</p>
          )}
          <div className="import-table-scroll">
            <table aria-label="รายการซื้อขายจากเอกสาร">
              <thead>
                <tr>
                  <th>หุ้น</th>
                  <th>ซื้อ/ขาย</th>
                  <th>วันที่ตามใบ</th>
                  <th>จำนวนหุ้น</th>
                  <th>ราคาต่อหน่วย</th>
                  <th>ยอดซื้อขาย</th>
                  <th>ค่าธรรมเนียมรวม VAT</th>
                  <th>ภาษีหัก ณ ที่จ่าย</th>
                  <th>ยอดสุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {parsed.drafts.map((draft) => (
                  <tr key={draft.sourceRow}>
                    <td>
                      {draft.fields.symbol ?? 'อ่านไม่ได้'}{' '}
                      <small>{draft.documentOrder?.exchange}</small>
                    </td>
                    <td>
                      {draft.fields.side === 'BUY'
                        ? 'ซื้อ'
                        : draft.fields.side === 'SELL'
                          ? 'ขาย'
                          : 'อ่านไม่ได้'}
                    </td>
                    <td>{draft.documentOrder?.effectiveDate ?? 'อ่านไม่ได้'}</td>
                    <td>{draft.fields.quantity ?? 'อ่านไม่ได้'}</td>
                    <td>
                      {draft.documentOrder?.unitPrice ?? 'อ่านไม่ได้'} {draft.fields.currency}
                    </td>
                    <td>
                      {draft.documentOrder?.grossAmount ?? 'อ่านไม่ได้'} {draft.fields.currency}
                    </td>
                    <td>
                      {draft.fields.fee ?? 'อ่านไม่ได้'} {draft.fields.feeCurrency}
                    </td>
                    <td>
                      {draft.fields.tax ?? 'อ่านไม่ได้'} {draft.fields.currency}
                    </td>
                    <td>
                      {draft.documentOrder?.netAmount ?? 'อ่านไม่ได้'} {draft.fields.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            เวลาซื้อขายแบบละเอียดและลำดับการซื้อขายย่อย: <strong>ไม่ทราบจากเอกสาร</strong>{' '}
            ระบบเก็บวันที่ตามใบและไม่เติมเวลาให้เอง
          </p>
          <p>
            ยอดเงินบาทในใบอ่านเพื่ออ้างอิงเฉพาะในหน้านี้ แยกจากยอดสกุลหลัก
            ไม่ใช้แทนอัตราแลกเปลี่ยนที่คุณซื้อขายจริง
          </p>
          {parsed.drafts.some(
            (d) =>
              ['symbol', 'side', 'quantity', 'fee', 'tax', 'currency'].some(
                (f) => d.fields[f as keyof typeof d.fields] === null,
              ) ||
              !d.documentOrder?.grossAmount ||
              !d.documentOrder.netAmount ||
              !d.documentOrder.effectiveDate,
          ) && (
            <p role="alert">มีช่องที่อ่านไม่ได้ กรุณาตรวจต้นฉบับก่อนนำเข้า ระบบไม่เติมเป็นศูนย์</p>
          )}
        </>
      ) : (
        <>
          <p>
            ยังอ่านเอกสารรูปแบบนี้เป็นรายการซื้อขายไม่ได้ กรุณาตรวจว่าเป็นใบยืนยันซื้อขาย Dime
            รูปแบบที่รองรับและมีข้อความให้อ่าน
          </p>
          <p>
            ต้องตรวจราคา จำนวน เวลา Execution พร้อม timezone ลำดับ fill ค่าธรรมเนียม ภาษี สกุลเงิน
            และสถานะก่อนนำเข้า
          </p>
          <ul>
            {parsed.issues.map((issue) => (
              <li key={issue}>
                <code>{issue}</code>
                {issue === 'OCR_REQUIRED'
                  ? ' · หน้านี้ไม่มีข้อความ ต้องใช้ OCR และตรวจผลก่อนนำเข้า'
                  : ''}
              </li>
            ))}
          </ul>
          <p>ไม่ได้เติมราคา เวลา หรือค่าธรรมเนียมที่เอกสารยังยืนยันไม่ได้</p>
        </>
      )}
      <button type="button" disabled aria-describedby="import-auth-note">
        ยืนยันเข้า Ledger
      </button>
      <p id="import-auth-note">
        การบันทึกผ่านเว็บยังไม่เปิดใช้งานจนกว่าระบบเข้าใช้งานเฉพาะเจ้าของพร้อม
        ขณะนี้ตรวจเอกสารในเครื่องได้
      </p>
    </section>
  );
}
