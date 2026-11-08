import { expect, test } from '@playwright/test';
import { syntheticPdf } from '../fixtures/synthetic-dime.js';
import { encryptedMockPdfBase64, mockPdfPassword } from '../fixtures/encrypted-mock-pdf.js';

test('extracts a PDF locally, shows review and never uploads or persists the document', async ({
  page,
}, testInfo) => {
  const uploads: string[] = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET' || new URL(req.url()).origin !== 'http://127.0.0.1:8787')
      uploads.push(req.url());
  });
  await page.goto('/import');
  await page.getByLabel('ไฟล์ PDF').setInputFiles({
    name: 'synthetic.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(syntheticPdf(['MOCK local text'])),
  });
  await page.getByRole('button', { name: 'อ่านเอกสารในเครื่อง', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'NEEDS_REVIEW', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ยืนยันเข้า Ledger' })).toBeDisabled();
  await page.getByText('ข้อความที่อ่านได้ในเครื่อง', { exact: true }).click();
  await expect(page.getByText('MOCK local text', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
  expect(uploads).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('import-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'ล้างเอกสาร', exact: true }).click();
  await expect(page.getByText('MOCK local text', { exact: true })).toHaveCount(0);
});

test('supports local password retry and clears the password on every attempt', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('ไฟล์ PDF').setInputFiles({
    name: 'encrypted-synthetic.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(encryptedMockPdfBase64, 'base64'),
  });
  await page.getByRole('button', { name: 'อ่านเอกสารในเครื่อง', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ต้องใช้รหัสผ่าน');
  await page.getByLabel('รหัสผ่าน PDF (ถ้ามี)').fill('incorrect-synthetic-password');
  await page.getByRole('button', { name: 'อ่านเอกสารในเครื่อง', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('รหัสผ่านไม่ถูกต้อง');
  await expect(page.getByLabel('รหัสผ่าน PDF (ถ้ามี)')).toHaveValue('');
  await page.getByLabel('รหัสผ่าน PDF (ถ้ามี)').fill(mockPdfPassword);
  await page.getByRole('button', { name: 'อ่านเอกสารในเครื่อง', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'NEEDS_REVIEW', exact: true })).toBeVisible();
  await expect(page.getByLabel('รหัสผ่าน PDF (ถ้ามี)')).toHaveValue('');
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

test('reports corrupt/scanned documents safely without manufacturing trades', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('ไฟล์ PDF').setInputFiles({
    name: 'invalid.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nprivate-test-only'),
  });
  await page.getByRole('button', { name: 'อ่านเอกสารในเครื่อง', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('อ่าน PDF ไม่สำเร็จ');
  await expect(page.getByText('private-test-only', { exact: true })).toHaveCount(0);
  await page.getByLabel('ไฟล์ PDF').setInputFiles({
    name: 'scanned.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(syntheticPdf([])),
  });
  await page.getByRole('button', { name: 'อ่านเอกสารในเครื่อง', exact: true }).click();
  await expect(page.getByText('OCR_REQUIRED', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ยืนยันเข้า Ledger' })).toBeDisabled();
});
