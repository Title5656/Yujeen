import { expect, test } from '@playwright/test';

test('shows setup instructions on a fresh local installation', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText('ยังไม่ได้ตั้งค่าชุดติดตั้ง', { exact: true })).toBeVisible();
  await expect(page.getByText('MOCK · AAPL', { exact: true })).toBeVisible();
});

test('lets the owner save, test and activate a candidate without retaining its secret', async ({
  page,
}) => {
  const version = '53d3e7d9-fba4-4876-aab8-f280aa8a4b37';
  const initial = {
    alpacaEnabled: true,
    fxEnabled: false,
    quoteStatus: 'NOT_CONFIGURED',
    fxStatus: 'DISABLED',
    active: null,
    candidate: null,
  };
  let state: Record<string, unknown> = initial;
  await page.route('**/api/integrations**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/candidate')) {
      expect(route.request().postDataJSON()).toMatchObject({
        provider: 'alpaca',
        secret: 'fixture-secret',
      });
      state = { ...initial, candidate: { version, testedAt: null } };
    }
    if (path.endsWith('/test'))
      state = { ...state, candidate: { version, testedAt: new Date(0).toISOString() } };
    if (path.endsWith('/activate'))
      state = {
        ...state,
        candidate: null,
        active: { version, testedAt: new Date(0).toISOString() },
      };
    await route.fulfill({ json: state });
  });
  await page.goto('/settings');
  await page.getByLabel('Alpaca Key ID').fill('fixture-key');
  await page.getByLabel('Alpaca Secret Key').fill('fixture-secret');
  await page.getByRole('button', { name: 'บันทึกและทดสอบ' }).click();
  await expect(page.getByLabel('Alpaca Secret Key')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'เปิดใช้คีย์นี้' })).toBeEnabled();
  await page.getByRole('button', { name: 'เปิดใช้คีย์นี้' }).click();
  await page.reload();
  await expect(page.getByText('ตั้งค่าคีย์ที่ใช้งานแล้ว', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);

  await page.clock.install();
  const requested: string[] = [];
  await page.route('**/api/market-data/refresh', (route) => {
    const { symbols } = route.request().postDataJSON() as { symbols: string[] };
    const symbol = symbols[0];
    if (typeof symbol !== 'string') throw new Error('Expected a ticker in the quote request');
    requested.push(symbol);
    const now = Date.now();
    const wait = (reason: 'COOLDOWN' | 'DAILY_QUOTA') => ({
      reason,
      retryAt: new Date(now + 6000).toISOString(),
      delayMs: 6000,
    });
    return route.fulfill({
      json: {
        quoteStatus: 'OK',
        ...(symbol === 'ASML' ? { quoteWait: wait('DAILY_QUOTA') } : {}),
        ...((symbol === 'V' && requested.filter((value) => value === 'V').length === 1) ||
        symbol === 'AAPL'
          ? { quoteWait: wait('COOLDOWN') }
          : {}),
        quoteResults: [
          {
            symbol,
            status:
              symbol === 'V' && requested.filter((value) => value === 'V').length === 2
                ? 'NO_TRADE'
                : 'NOT_REQUESTED',
          },
        ],
        fxStatus: 'DISABLED',
        quotes: [],
        fx: null,
      },
    });
  });
  const lookup = async (symbol: string) => {
    await page.getByLabel('Ticker สหรัฐฯ').fill(symbol);
    await page.getByRole('button', { name: 'ตรวจราคาและ FX' }).click();
  };
  await lookup('V');
  await expect(page.getByText(/รอรอบเรียกข้อมูลถัดไป/)).toBeVisible();
  await page.clock.fastForward(6500);
  await expect(page.getByText(/ตรวจแล้วไม่พบราคาที่ใช้ได้/)).toBeVisible();
  expect(requested).toEqual(['V', 'V']);

  await lookup('AAPL');
  await expect(page.getByText(/รอรอบเรียกข้อมูลถัดไป/)).toBeVisible();
  await lookup('ASML');
  await expect(page.getByText(/ครบโควตารายวัน/)).toBeVisible();
  await page.clock.fastForward(10_000);
  expect(requested).toEqual(['V', 'V', 'AAPL', 'ASML']);
});
