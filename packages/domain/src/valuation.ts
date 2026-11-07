import { FinancialDecimal as D, parseAmount } from './decimal.js';
import type { Position } from './positions.js';
import { normalizeExecutedAt } from './trade.js';

type DataMode = 'MOCK' | 'LIVE';
export interface PriceQuote {
  readonly securityId: string;
  readonly currency: 'USD';
  readonly price: string;
  readonly source: string;
  readonly asOf: string;
  readonly quality: 'REALTIME' | 'DELAYED' | 'EOD' | 'UNKNOWN';
  readonly dataMode: DataMode;
}
export interface ReferenceFx {
  readonly base: 'USD';
  readonly quote: 'THB';
  readonly rate: string;
  readonly source: string;
  readonly asOf: string;
  readonly dataMode: DataMode;
}
export interface ValuationContext {
  readonly valuedAt: string;
  readonly maxAgeMs: number;
  readonly fx?: ReferenceFx | null;
}
export interface PositionValuation {
  readonly currency: 'USD';
  readonly marketValue: string | null;
  readonly unrealizedPL: string | null;
  readonly realizedPL: string;
  readonly dailyPL: null;
  readonly quote: PriceQuote | null;
  readonly quoteStatus: 'MISSING' | 'STALE' | 'UNKNOWN' | 'AVAILABLE';
  readonly referenceFxStatus: 'MISSING' | 'STALE' | 'AVAILABLE';
  readonly referenceTHB: {
    readonly marketValue: string;
    readonly unrealizedPL: string;
    readonly source: string;
    readonly asOf: string;
    readonly dataMode: DataMode;
    readonly purpose: 'REFERENCE_ONLY';
  } | null;
  readonly historicalRealizedPLTHB: null;
  readonly historicalFxStatus: 'UNAVAILABLE';
}

function validateProvenance(source: string, dataMode: DataMode): void {
  if (typeof source !== 'string' || !source.trim() || !['MOCK', 'LIVE'].includes(dataMode)) {
    throw new RangeError('Invalid quote/FX provenance');
  }
}

function ageStatus(asOf: string, now: number, maxAgeMs: number): 'STALE' | 'AVAILABLE' {
  const time = Date.parse(normalizeExecutedAt(asOf));
  if (time > now) throw new RangeError('Quote/FX cannot be from the future');
  return now - time > maxAgeMs ? 'STALE' : 'AVAILABLE';
}

/** Reference valuation only. Historical execution-FX cash flows are not inferred. */
export function valuePosition(
  position: Position,
  quote: PriceQuote | null,
  context: ValuationContext,
): PositionValuation {
  if (!Number.isSafeInteger(context.maxAgeMs) || context.maxAgeMs < 0)
    throw new RangeError('Invalid quote age threshold');
  const now = Date.parse(normalizeExecutedAt(context.valuedAt));
  const result: PositionValuation = {
    currency: 'USD',
    marketValue: null,
    unrealizedPL: null,
    realizedPL: position.realizedPL,
    dailyPL: null,
    quote: null,
    quoteStatus: 'MISSING',
    referenceFxStatus: 'MISSING',
    referenceTHB: null,
    historicalRealizedPLTHB: null,
    historicalFxStatus: 'UNAVAILABLE',
  };
  const fx = context.fx;
  let fxStatus: 'MISSING' | 'STALE' | 'AVAILABLE' = 'MISSING';
  if (fx) {
    if (fx.base !== 'USD' || fx.quote !== 'THB')
      throw new RangeError('Expected USD/THB reference FX');
    parseAmount(fx.rate, 'FX rate', false);
    validateProvenance(fx.source, fx.dataMode);
    fxStatus = ageStatus(fx.asOf, now, context.maxAgeMs);
  }
  if (!quote) return { ...result, referenceFxStatus: fxStatus };
  if (
    quote.securityId !== position.securityId ||
    quote.currency !== position.currency ||
    position.currency !== 'USD'
  ) {
    throw new RangeError('Quote identity/currency does not match position');
  }
  const price = parseAmount(quote.price, 'quote price', false);
  validateProvenance(quote.source, quote.dataMode);
  if (!['REALTIME', 'DELAYED', 'EOD', 'UNKNOWN'].includes(quote.quality))
    throw new RangeError('Invalid quote quality');
  const freshness = ageStatus(quote.asOf, now, context.maxAgeMs);
  // Position is engine output and can exceed per-trade input limits after aggregation.
  const quantity = new D(position.quantity);
  const basis = new D(position.costBasis);
  if (!quantity.isFinite() || quantity.isNegative() || !basis.isFinite() || basis.isNegative())
    throw new RangeError('Invalid position');
  const marketValue = quantity.times(price);
  const unrealized = marketValue.minus(basis);
  return {
    ...result,
    marketValue: marketValue.toFixed(),
    unrealizedPL: unrealized.toFixed(),
    quote: { ...quote, asOf: normalizeExecutedAt(quote.asOf) },
    quoteStatus:
      freshness === 'STALE' ? 'STALE' : quote.quality === 'UNKNOWN' ? 'UNKNOWN' : 'AVAILABLE',
    referenceFxStatus: fxStatus,
    referenceTHB: fx
      ? {
          marketValue: marketValue.times(fx.rate).toFixed(),
          unrealizedPL: unrealized.times(fx.rate).toFixed(),
          source: fx.source,
          asOf: normalizeExecutedAt(fx.asOf),
          dataMode: fx.dataMode,
          purpose: 'REFERENCE_ONLY',
        }
      : null,
  };
}
