import { useMarketPreview } from './useMarketPreview.js';
import { labels, waitLabels } from './labels.js';

export function MarketPreview({ enabled }: { enabled: boolean }) {
  const { symbol, data, error, busy, remaining, refresh, changeSymbol } = useMarketPreview();
  return (
    <section className="panel">
      <h2>ราคาและอัตราอ้างอิง</h2>
      <form onSubmit={(event) => void refresh(event)}>
        <label htmlFor="m3-symbol">Ticker สหรัฐฯ</label>{' '}
        <input
          id="m3-symbol"
          value={symbol}
          onChange={(event) => changeSymbol(event.target.value)}
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
