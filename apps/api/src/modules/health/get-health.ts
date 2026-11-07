import { HealthResponseSchema } from '@portfolio/contracts';
import type { HealthResponse } from '@portfolio/contracts';

export function getHealth(): HealthResponse {
  return HealthResponseSchema.parse({ status: 'ok' });
}
