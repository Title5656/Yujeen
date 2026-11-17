import type { Env, Hono } from 'hono';
import { ApiErrorSchema } from '@portfolio/contracts';

export function installErrorHandlers<E extends Env>(app: Hono<E>): void {
  app.notFound((context) =>
    context.json(
      ApiErrorSchema.parse({
        error: { code: 'NOT_FOUND', message: 'ไม่พบเส้นทางที่ร้องขอ' },
      }),
      404,
    ),
  );

  app.onError((_error, context) =>
    context.json(
      ApiErrorSchema.parse({
        error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      }),
      500,
    ),
  );
}
