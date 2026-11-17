import type { ApiError } from '@portfolio/contracts';

const messages = {
  INVALID_INPUT: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
  UNAUTHENTICATED: 'กรุณาเข้าสู่ระบบผ่าน Cloudflare Access',
  FORBIDDEN: 'ไม่อนุญาตให้เข้าถึงจากบัญชีหรือเว็บไซต์นี้',
  NOT_CONFIGURED: 'ยังไม่ได้ตั้งค่าชุดติดตั้งหรือยังไม่เปิดบริการนี้',
  CONFLICT: 'การตั้งค่าเปลี่ยนไปหรือยังไม่ได้ผ่านการทดสอบ',
  RATE_LIMITED: 'ครบโควตาหรือกำลังรอรอบถัดไป',
  AUTH_FAILED: 'ผู้ให้บริการปฏิเสธ API Key หรือสิทธิ์เข้าถึง feed',
  UNAVAILABLE: 'ยังเชื่อมต่อผู้ให้บริการไม่ได้',
} as const satisfies Partial<Record<ApiError['error']['code'], string>>;
export const failure = (code: keyof typeof messages): ApiError => ({
  error: { code, message: messages[code] },
});
