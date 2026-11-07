import { expect, test } from '@playwright/test';

test('built web reads the actual API and all placeholder deep links work', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('API พร้อมใช้งาน');
  await expect(page.getByText('MOCK · ข้อมูลจำลอง', { exact: true })).toBeVisible();
  for (const title of [
    'Holdings',
    'Transactions',
    'Import',
    'Watchlist',
    'Settings',
    'Dashboard',
  ]) {
    await page
      .getByRole('navigation', { name: 'เมนูหลัก' })
      .getByRole('link', { name: title, exact: true })
      .click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('foundation.png'), fullPage: true });
});

test('API navigation returns JSON 404 instead of the SPA fallback', async ({ request }) => {
  const response = await request.get('/api/missing', { headers: { 'Sec-Fetch-Mode': 'navigate' } });
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: 'NOT_FOUND', message: 'ไม่พบเส้นทางที่ร้องขอ' },
  });
});

test('health failure is visible and retry recovers', async ({ page }) => {
  await page.route('**/api/health', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('ยังเชื่อมต่อ API ไม่ได้');
  await page.unroute('**/api/health');
  await page.getByRole('button', { name: 'ลองใหม่' }).click();
  await expect(page.getByRole('status')).toContainText('API พร้อมใช้งาน');
});

test('rejects an invalid health payload and supports keyboard entry', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'unknown' } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'ข้ามไปเนื้อหาหลัก' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});
