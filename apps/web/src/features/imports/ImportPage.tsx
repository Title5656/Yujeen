import { TransactionPreview } from './TransactionPreview.js';
import { useLocalDocument } from './useLocalDocument.js';
import './imports.css';

const errors: Record<string, string> = {
  PASSWORD_REQUIRED: 'PDF นี้ต้องใช้รหัสผ่าน กรุณาใส่รหัสในช่องด้านบนแล้วลองใหม่',
  INCORRECT_PASSWORD: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่',
  FILE_SIZE_LIMIT: 'เลือกไฟล์ที่มีข้อมูลและขนาดไม่เกิน 10 MiB',
  UNSUPPORTED_TYPE: 'ขณะนี้รองรับเฉพาะไฟล์ PDF',
  INVALID_SIGNATURE: 'เนื้อหาไฟล์ไม่ใช่ PDF ที่รองรับ',
  INVALID_PDF: 'อ่าน PDF ไม่สำเร็จ กรุณาตรวจว่าไฟล์ไม่เสียหาย',
  PAGE_LIMIT: 'PDF ต้องมีไม่เกิน 20 หน้า',
  TEXT_LIMIT: 'ข้อความใน PDF เกินขอบเขตที่รองรับ กรุณาแบ่งเอกสาร',
  TIMEOUT: 'การอ่านใช้เวลานานเกินกำหนด กรุณาลองไฟล์ที่เล็กลง',
};

export function ImportPage() {
  const local = useLocalDocument();
  return (
    <div className="import-page panel">
      <h2>ตรวจเอกสาร Dime ในเครื่อง</h2>
      <p>ไฟล์ ข้อความ และรหัสผ่านประมวลผลใน browser ไม่อัปโหลดหรือบันทึกลงระบบ</p>
      <p>อ่าน PDF ได้สูงสุด 10 MiB / 20 หน้า ภาพสแกนและเอกสารที่อ่านไม่ครบจะส่งให้ตรวจสอบ</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void local.read();
        }}
      >
        <label htmlFor="import-file">ไฟล์ PDF</label>
        <input
          id="import-file"
          key={local.inputKey}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => local.selectFile(event.target.files?.[0] ?? null)}
        />
        <label htmlFor="import-password">รหัสผ่าน PDF (ถ้ามี)</label>
        <input
          id="import-password"
          type="password"
          autoComplete="off"
          value={local.password}
          onChange={(event) => local.setPassword(event.target.value)}
          aria-describedby="password-note"
        />
        <small id="password-note">
          ใช้เฉพาะการเปิดไฟล์ในเครื่อง และล้างช่องรหัสหลังอ่านทุกครั้ง
        </small>
        <div className="import-actions">
          <button type="submit" disabled={!local.file || local.reading}>
            อ่านเอกสารในเครื่อง
          </button>
          <button type="button" onClick={local.clear}>
            ล้างเอกสาร
          </button>
        </div>
      </form>
      {local.reading && <p role="status">กำลังอ่านข้อความ PDF…</p>}
      {local.error && <p role="alert">{errors[local.error] ?? errors['INVALID_PDF']}</p>}
      {local.result && (
        <>
          <TransactionPreview parsed={local.result.parsed} />
          <dl className="import-metadata">
            <div>
              <dt>Document SHA-256</dt>
              <dd>{local.result.document.documentSha256}</dd>
            </div>
            <div>
              <dt>Parser</dt>
              <dd>{local.result.parsed.parserVersion}</dd>
            </div>
            <div>
              <dt>ที่มา</dt>
              <dd>ข้อความจากไฟล์ในเครื่อง · ยังไม่ยืนยันเป็นธุรกรรม</dd>
            </div>
          </dl>
          <details>
            <summary>ข้อความที่อ่านได้ในเครื่อง</summary>
            <p>อาจมีข้อมูลส่วนตัว แสดงเฉพาะในหน้านี้และล้างได้ด้วยปุ่มล้างเอกสาร</p>
            {local.result.document.pages.map((page) => (
              <section key={page.page} aria-label={`หน้า ${page.page}`}>
                <h3>หน้า {page.page}</h3>
                {page.lines.map((line) => (
                  <p className="import-source-line" key={line.line}>
                    {line.text}
                  </p>
                ))}
              </section>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
