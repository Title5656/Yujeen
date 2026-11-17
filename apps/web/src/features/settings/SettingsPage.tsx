import { MarketPreview } from './MarketPreview.js';
import { useIntegrations } from './useIntegrations.js';

function DemoSettings() {
  return (
    <section className="panel">
      <h2>ยังไม่ได้ตั้งค่าชุดติดตั้ง</h2>
      <p>ตั้งค่า Cloudflare Access, D1 และ Worker Secret ตามคู่มือ README ก่อนเชื่อมบัญชี Alpaca</p>
      <p>
        <strong>MOCK · AAPL</strong> — 123.45 USD เป็นตัวอย่างจากข้อมูลจำลอง
      </p>
    </section>
  );
}

export function SettingsPage() {
  const { state, error, busy, change, save } = useIntegrations();
  if (!state) {
    if (error)
      return (
        <p role="alert">
          {error} <a href="/settings">ลองใหม่</a>
        </p>
      );
    return state === null ? <DemoSettings /> : <p role="status">กำลังโหลดการตั้งค่า</p>;
  }
  const { candidate, active } = state;
  return (
    <div className="settings-grid">
      <section className="panel">
        <h2>Alpaca Market Data</h2>
        <p>IEX · หุ้นสหรัฐฯ และ US ETF</p>
        {error && <p role="alert">{error}</p>}
        {active && <p>ตั้งค่าคีย์ที่ใช้งานแล้ว</p>}
        {!active && state.alpacaEnabled && <p>ยังไม่มีคีย์ที่ใช้งาน</p>}
        {state.alpacaEnabled ? (
          <form onSubmit={save} autoComplete="off">
            <p>ใช้ Key ID และ Secret Key คู่เดียวกันจากหน้า API Keys ของ Alpaca</p>
            <label htmlFor="alpaca-key">Alpaca Key ID</label>
            <input
              id="alpaca-key"
              name="keyId"
              type="password"
              autoComplete="off"
              required
              maxLength={256}
              disabled={busy}
            />
            <label htmlFor="alpaca-secret">Alpaca Secret Key</label>
            <input
              id="alpaca-secret"
              name="secret"
              type="password"
              autoComplete="off"
              required
              maxLength={256}
              disabled={busy}
            />
            <button type="submit" disabled={busy}>
              บันทึกและทดสอบ
            </button>
          </form>
        ) : (
          <p>เปิด Alpaca ในการตั้งค่า Worker หลังตรวจแผน Basic และสิทธิ์ใช้ข้อมูลของบัญชี</p>
        )}
        {candidate && (
          <div className="settings-actions">
            <p>
              {candidate.testedAt
                ? 'ทดสอบผ่าน ' + new Date(candidate.testedAt).toLocaleString('th-TH')
                : 'รอทดสอบคีย์ที่บันทึก'}
            </p>
            {!candidate.testedAt && (
              <button
                type="button"
                disabled={busy || !state.alpacaEnabled}
                onClick={() => void change('test', 'POST', { version: candidate.version })}
              >
                ทดสอบอีกครั้ง
              </button>
            )}
            <button
              type="button"
              disabled={busy || !candidate.testedAt || !state.alpacaEnabled}
              onClick={() => void change('activate', 'POST', { version: candidate.version })}
            >
              เปิดใช้คีย์นี้
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void change('candidate', 'DELETE', { version: candidate.version })}
            >
              ลบคีย์ที่รอทดสอบ
            </button>
          </div>
        )}
        {active && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void change('active', 'DELETE', { version: active.version })}
          >
            ลบคีย์ที่ใช้งาน
          </button>
        )}
      </section>
      <MarketPreview
        key={active?.version ?? 'unset'}
        enabled={Boolean(active && state.alpacaEnabled) || state.fxEnabled}
      />
    </div>
  );
}
