import { HealthResponseSchema } from '@portfolio/contracts';
import type { HealthResponse } from '@portfolio/contracts';

export async function fetchHealth(signal: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Health check failed (${response.status})`);
  return HealthResponseSchema.parse(await response.json());
}
