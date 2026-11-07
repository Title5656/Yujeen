import { z } from 'zod';

export const HealthResponseSchema = z.strictObject({ status: z.literal('ok') });
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(['NOT_FOUND', 'INTERNAL_ERROR']),
    message: z.string().min(1),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
