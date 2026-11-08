import { expect, test } from '@playwright/test';
import { confirmationPdf } from '../fixtures/dime-confirmation.js';

test('shows structured documentary orders instead of only extracted text', async ({
  page,
}, testInfo) => {
  await page.goto('/import');
  await page.getByLabel('ไฟล์ PDF').setInputFiles({
    name: 'MOCK-confirmation.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(confirmationPdf()),
  });
  await page.getByRole('button', { name: 'อ่านเอกสารในเครื่อง', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'อ่านรายการซื้อขายได้แล้ว', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('table', { name: 'รายการซื้อขายจากเอกสาร' })).toContainText('MOCK');
  await expect(page.getByRole('table')).toContainText('0.1234567');
  await expect(page.getByRole('table')).toContainText('250.50');
  await expect(page.getByRole('table')).toContainText('30.93');
  await expect(page.getByRole('table')).toContainText('0.50');
  await expect(page.getByText('ไม่ทราบจากเอกสาร', { exact: true })).toBeVisible();
  await expect(page.getByText('ยังไม่มีตัวอย่าง Dime', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ยืนยันเข้า Ledger' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('structured-orders.png'), fullPage: true });
});
