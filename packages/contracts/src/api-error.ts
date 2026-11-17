import { z } from 'zod';

export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum([
      'NOT_FOUND',
      'INTERNAL_ERROR',
      'INVALID_INPUT',
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_CONFIGURED',
      'CONFLICT',
      'RATE_LIMITED',
      'AUTH_FAILED',
      'UNAVAILABLE',
    ]),
    message: z.string().min(1),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
