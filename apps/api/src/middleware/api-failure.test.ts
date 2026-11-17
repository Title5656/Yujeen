import { describe, expect, it } from 'vitest';
import { ApiErrorSchema } from '@portfolio/contracts';
import { failure } from './api-failure.js';

describe('private API error contract', () => {
  it.each([
    'INVALID_INPUT',
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'NOT_CONFIGURED',
    'CONFLICT',
    'RATE_LIMITED',
    'AUTH_FAILED',
    'UNAVAILABLE',
  ] as const)('allows a shared-contract client to read %s', (code) => {
    const response = failure(code);
    expect(ApiErrorSchema.parse(response)).toEqual(response);
  });
});
