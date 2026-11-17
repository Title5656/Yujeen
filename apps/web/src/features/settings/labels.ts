import type { MarketData, MarketStatus } from '@portfolio/contracts';

export const labels: Record<MarketStatus, string> = {
  OK: 'เชื่อมต่อแล้ว',
  DISABLED: 'ปิดอยู่',
  NOT_CONFIGURED: 'ยังไม่มีคีย์ที่ใช้งาน',
  UNAVAILABLE: 'ยังไม่มีข้อมูลหรือผู้ให้บริการไม่พร้อม',
  RATE_LIMITED: 'จำกัดการเรียก API',
  AUTH_FAILED: 'ผู้ให้บริการปฏิเสธคีย์หรือสิทธิ์',
};

export const waitLabels: Record<NonNullable<MarketData['quoteWait']>['reason'], string> = {
  COOLDOWN: 'รอรอบเรียกข้อมูลถัดไป',
  IN_PROGRESS: 'มีคำขอราคากำลังทำงาน',
  UPSTREAM_RATE_LIMIT: 'Alpaca จำกัดการเรียก API',
  DAILY_QUOTA: 'ครบโควตารายวันของ Yujeen',
  MONTHLY_QUOTA: 'ครบโควตารายเดือนของ Yujeen',
};
