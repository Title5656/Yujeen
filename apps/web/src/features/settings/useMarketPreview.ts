import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { MarketDataSchema, SymbolsInputSchema } from '@portfolio/contracts';
import type { MarketData } from '@portfolio/contracts';
import { api, message } from './api.js';
import { waitForQuoteRetry } from './wait-for-quote-retry.js';

export function useMarketPreview() {
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

  function changeSymbol(value: string) {
    current.current?.abort();
    setSymbol(value);
    setData(undefined);
    setError('');
    setRemaining(null);
    setBusy(false);
  }
  return { symbol, data, error, busy, remaining, refresh, changeSymbol };
}
