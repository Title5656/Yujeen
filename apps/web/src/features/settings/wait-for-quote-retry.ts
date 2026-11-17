export function waitForQuoteRetry(
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
