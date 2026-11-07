import { describe, expect, it } from 'vitest';
import { MockParser } from './index.js';

const input = (patch = {}) => ({
  mediaType: 'application/x-portfolio-mock+json',
  text: JSON.stringify({
    format: 'portfolio-mock-v1',
    symbol: 'MOCK',
    quantity: '0.5',
    executionPrice: '10.25',
    tradeStatus: 'FILLED',
    ...patch,
  }),
});

describe('MockParser (synthetic documents only)', () => {
  it('returns deterministic review drafts and never confirmed trades', async () => {
    const parser = new MockParser();
    const result = await parser.parse(input());
    expect(result).toEqual(await parser.parse(input()));
    expect(result).toMatchObject({
      dataMode: 'MOCK',
      parserId: 'mock',
      parserVersion: '0.0.0',
      drafts: [
        {
          status: 'NEEDS_REVIEW',
          confirmable: false,
          symbol: 'MOCK',
          quantity: '0.5',
          executionPrice: '10.25',
        },
      ],
    });
  });

  it('leaves missing execution price unknown and flags it for review', async () => {
    const result = await new MockParser().parse(input({ executionPrice: null }));
    expect(result.drafts[0]).toMatchObject({
      executionPrice: null,
      missingFields: ['executionPrice'],
      confirmable: false,
    });
  });

  it.each(['PENDING', 'CANCELLED'])(
    'never promotes %s to a filled or confirmed transaction',
    async (tradeStatus) => {
      const result = await new MockParser().parse(input({ tradeStatus }));
      expect(result.drafts[0]).toMatchObject({
        tradeStatus,
        status: 'NEEDS_REVIEW',
        confirmable: false,
      });
    },
  );

  it('rejects real PDF input explicitly', async () => {
    await expect(
      new MockParser().parse({ mediaType: 'application/pdf', text: '%PDF' }),
    ).rejects.toThrow('MOCK');
  });

  it.each(['not json', '{}', JSON.stringify({ format: 'DIME' })])(
    'rejects text that is not the synthetic format',
    async (text) => {
      await expect(
        new MockParser().parse({ mediaType: 'application/x-portfolio-mock+json', text }),
      ).rejects.toThrow();
    },
  );

  it.each([{ quantity: '-1' }, { executionPrice: '0' }, { quantity: 0.5 }])(
    'rejects invalid financial fields %j',
    async (patch) => {
      await expect(new MockParser().parse(input(patch))).rejects.toThrow();
    },
  );
});
