import { ApiErrorSchema } from '@portfolio/contracts';

export async function api(path: string, method = 'GET', input?: unknown, signal?: AbortSignal) {
  const response = await fetch('/api/' + path, {
    method,
    cache: 'no-store',
    ...(signal ? { signal } : {}),
    ...(input === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(result);
    const error = parsed.success ? parsed.data.error : undefined;
    if (response.status === 503 && error?.code === 'NOT_CONFIGURED' && method === 'GET')
      return null;
    throw new Error(error?.message ?? 'กรุณาเข้าสู่ระบบผ่าน Cloudflare Access แล้วลองอีกครั้ง');
  }
  return result as unknown;
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}
