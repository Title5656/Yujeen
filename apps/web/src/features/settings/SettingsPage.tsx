import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { IntegrationsSchema, MarketDataSchema, SymbolsInputSchema } from '@portfolio/contracts';
import type { Integrations, MarketData, MarketStatus } from '@portfolio/contracts';

const labels: Record<MarketStatus, string> = {
  OK: 'เชื่อมต่อแล้ว',
  DISABLED: 'ปิดอยู่',
  NOT_CONFIGURED: 'ยังไม่มีคีย์ที่ใช้งาน',
  UNAVAILABLE: 'ยังไม่มีข้อมูลหรือผู้ให้บริการไม่พร้อม',
  RATE_LIMITED: 'จำกัดการเรียก API',
  AUTH_FAILED: 'ผู้ให้บริการปฏิเสธคีย์หรือสิทธิ์',
};

const waitLabels: Record<NonNullable<MarketData['quoteWait']>['reason'], string> = {
  COOLDOWN: 'รอรอบเรียกข้อมูลถัดไป',
  IN_PROGRESS: 'มีคำขอราคากำลังทำงาน',
  UPSTREAM_RATE_LIMIT: 'Alpaca จำกัดการเรียก API',
  DAILY_QUOTA: 'ครบโควตารายวันของ Yujeen',
  MONTHLY_QUOTA: 'ครบโควตารายเดือนของ Yujeen',
};

function waitForQuoteRetry(
  delayMs: number,
  signal: AbortSignal,
  onTick: (seconds: number) => void,
) {
  return new Promise<boolean>((resolve) => {
    const deadline = Date.now() + delayMs;
    const tick = () => onTick(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    const interval = window.setInterval(tick, 1000);
    const timeout = window.setTimeout(() => finish(true), delayMs);
    function cancel() {
      finish(false);
    }
    function finish(ready: boolean) {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      resolve(ready);
    }
    signal.addEventListener('abort', cancel, { once: true });
    tick();
  });
}

async function api(path: string, method = 'GET', input?: unknown, signal?: AbortSignal) {
  const response = await fetch('/api/' + path, {
    method,
    cache: 'no-store',
    ...(signal ? { signal } : {}),
    ...(input === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 503 && result?.error?.code === 'NOT_CONFIGURED' && method === 'GET')
      return null;
    throw new Error(
      typeof result?.error?.message === 'string'
        ? result.error.message
        : 'กรุณาเข้าสู่ระบบผ่าน Cloudflare Access แล้วลองอีกครั้ง',
    );
  }
  return result as unknown;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

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

function MarketPreview({ enabled }: { enabled: boolean }) {
  const [symbol, setSymbol] = useState('AAPL');
  const [data, setData] = useState<MarketData>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const current = useRef<AbortController | null>(null);

  useEffect(() => () => current.current?.abort(), []);

  async function refresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = SymbolsInputSchema.safeParse({ symbols: [symbol.trim().toUpperCase()] });
    current.current?.abort();
    setRemaining(null);
    if (!input.success) {
      setError('กรุณาใส่ ticker หุ้นหรือ ETF สหรัฐฯ เช่น AAPL');
      return;
    }
    const controller = new AbortController();
    current.current = controller;
    const { signal } = controller;
    const request = async () =>
      MarketDataSchema.parse(await api('market-data/refresh', 'POST', input.data, signal));
    setBusy(true);
    setError('');
    try {
      const result = await request();
      if (signal.aborted) return;
      setData(result);
      const wait = result.quoteWait;
      if (wait?.reason === 'COOLDOWN' || wait?.reason === 'IN_PROGRESS') {
        setBusy(false);
        if (!(await waitForQuoteRetry(wait.delayMs, signal, setRemaining)) || signal.aborted)
          return;
        setRemaining(null);
        setBusy(true);
        const retried = await request();
        if (!signal.aborted) setData(retried);
      }
    } catch (error) {
      if (!signal.aborted) setError(message(error));
    } finally {
      if (!signal.aborted) {
        current.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <section className="panel">
      <h2>ราคาและอัตราอ้างอิง</h2>
      <form onSubmit={(event) => void refresh(event)}>
        <label htmlFor="m3-symbol">Ticker สหรัฐฯ</label>{' '}
        <input
          id="m3-symbol"
          value={symbol}
          onChange={(event) => {
            current.current?.abort();
            setSymbol(event.target.value);
            setData(undefined);
            setError('');
            setRemaining(null);
            setBusy(false);
          }}
          maxLength={15}
        />
        <button type="submit" disabled={!enabled || busy || remaining !== null}>
          ตรวจราคาและ FX
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {data && (
        <div aria-live="polite">
          <p>ราคา Alpaca IEX · {labels[data.quoteStatus]}</p>
          {data.quoteWait && (
            <p>
              {waitLabels[data.quoteWait.reason]} · ขอได้อีกครั้ง{' '}
              <time dateTime={data.quoteWait.retryAt}>
                {new Date(data.quoteWait.retryAt).toLocaleString('th-TH')}
              </time>
            </p>
          )}
          {remaining !== null && (
            <p aria-live="off">จะตรวจราคาอีกครั้งอัตโนมัติใน {remaining} วินาที</p>
          )}
          {data.quoteResults?.map((result) => {
            if (result.status === 'NO_TRADE')
              return <p key={result.symbol}>{result.symbol} · ตรวจแล้วไม่พบราคาที่ใช้ได้</p>;
            if (result.status === 'REQUEST_FAILED' && !data.quoteWait)
              return <p key={result.symbol}>{result.symbol} · การขอราคาล้มเหลว</p>;
            return null;
          })}
          {data.quotes.map((quote) => (
            <p key={quote.symbol}>
              {quote.symbol} {quote.price} {quote.currency} · {quote.feed} ·{' '}
              <time dateTime={quote.asOf}>{new Date(quote.asOf).toLocaleString('th-TH')}</time>
              {quote.stale ? ' · ข้อมูลเก่า' : ''}
            </p>
          ))}
          <p>USD/THB · {labels[data.fxStatus]}</p>
          {data.fx && (
            <p>
              1 USD ≈ {data.fx.rate} THB · Frankfurter blended · {data.fx.date}
              {data.fx.stale ? ' · ข้อมูลเก่า' : ''}
            </p>
          )}
        </div>
      )}
      <p>ราคา IEX ใช้ข้อมูลที่เก็บไว้ 15 นาทีต่อ ticker และเว้นอย่างน้อย 1 นาทีระหว่างคำขอใหม่</p>
      <p>อัตราอ้างอิง FX ดึงได้วันละครั้ง</p>
    </section>
  );
}

export function SettingsPage() {
  const [state, setState] = useState<Integrations | null>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void api('integrations', 'GET', undefined, controller.signal)
      .then((result) => {
        setState(result === null ? null : IntegrationsSchema.parse(result));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(message(error));
      });
    return () => controller.abort();
  }, []);

  async function update(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      setState(IntegrationsSchema.parse(await action()));
    } catch (error) {
      setError(message(error));
      // Reconcile after a failed or concurrent test (the previous candidate proof can be revoked).
      try {
        const latest = await api('integrations');
        setState(latest === null ? null : IntegrationsSchema.parse(latest));
      } catch {
        /* The error above remains visible. */
      }
    } finally {
      setBusy(false);
    }
  }

  function change(path: string, method: string, body: unknown) {
    return update(() => api('integrations/' + path, method, body));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    form.reset();
    void update(async () => {
      const { candidate } = IntegrationsSchema.parse(
        await api('integrations/candidate', 'PUT', {
          provider: 'alpaca',
          keyId: fields.get('keyId'),
          secret: fields.get('secret'),
        }),
      );
      if (!candidate) throw new Error('บันทึกคีย์ไม่สำเร็จ กรุณาลองใหม่');
      return api('integrations/test', 'POST', { version: candidate.version });
    });
  }

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
