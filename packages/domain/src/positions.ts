import type Decimal from 'decimal.js';
import { FinancialDecimal as D, roundCost } from './decimal.js';
import { mergeLedger } from './ledger.js';
import type { Trade } from './trade.js';

export interface CostLot {
  readonly tradeDate: string;
  readonly quantity: string;
  readonly costBasis: string;
}

export interface RealizedSale {
  readonly tradeId: string;
  readonly quantity: string;
  readonly grossProceeds: string;
  readonly fee: string;
  readonly tax: string;
  readonly netProceeds: string;
  readonly allocatedCostBasis: string;
  readonly realizedPL: string;
  readonly allocations: readonly CostLot[];
}

export interface Position {
  readonly accountId: string;
  readonly securityId: string;
  readonly currency: 'USD';
  readonly quantity: string;
  readonly costBasis: string;
  readonly averageCost: string | null;
  readonly realizedPL: string;
  readonly lots: readonly CostLot[];
  readonly sales: readonly RealizedSale[];
}

interface MutableLot {
  tradeDate: string;
  quantity: Decimal;
  costBasis: Decimal;
}
interface Accumulator {
  accountId: string;
  securityId: string;
  quantity: Decimal;
  realizedPL: Decimal;
  lots: MutableLot[];
  sales: RealizedSale[];
  lastOrder: string | null;
}

function sell(position: Accumulator, trade: Trade): void {
  const quantity = new D(trade.quantity);
  if (quantity.gt(position.quantity)) throw new RangeError(`Oversell: ${trade.id}`);
  let unallocated = quantity;
  let cost = new D(0);
  const allocations: CostLot[] = [];
  while (unallocated.gt(0)) {
    const lot = position.lots[0];
    if (!lot) throw new RangeError('Oversell: insufficient cost lots');
    const consumed = D.min(unallocated, lot.quantity);
    // Multiplication before division avoids using a rounded average unit cost.
    const allocated = consumed.eq(lot.quantity)
      ? lot.costBasis
      : D.min(lot.costBasis, roundCost(lot.costBasis.times(consumed).div(lot.quantity)));
    allocations.push({
      tradeDate: lot.tradeDate,
      quantity: consumed.toFixed(),
      costBasis: allocated.toFixed(),
    });
    lot.quantity = lot.quantity.minus(consumed);
    lot.costBasis = lot.costBasis.minus(allocated);
    cost = cost.plus(allocated);
    unallocated = unallocated.minus(consumed);
    if (lot.quantity.isZero()) position.lots.shift();
  }
  const gross = quantity.times(trade.executionPrice);
  const net = gross.minus(trade.fee).minus(trade.tax);
  const realized = net.minus(cost);
  position.quantity = position.quantity.minus(quantity);
  position.realizedPL = position.realizedPL.plus(realized);
  position.sales.push({
    tradeId: trade.id,
    quantity: quantity.toFixed(),
    grossProceeds: gross.toFixed(),
    fee: trade.fee,
    tax: trade.tax,
    netProceeds: net.toFixed(),
    allocatedCostBasis: cost.toFixed(),
    realizedPL: realized.toFixed(),
    allocations,
  });
}

/** Replay only confirmed fills. Intraday compression uses purchases available at execution time. */
export function rebuildPositions(trades: readonly Trade[]): readonly Position[] {
  const checked = mergeLedger([], trades);
  if (checked.duplicates) throw new RangeError('Ledger contains duplicate transactions');
  const sorted = [...checked.added].sort(
    (a, b) =>
      a.executedAt.localeCompare(b.executedAt) ||
      a.sequence - b.sequence ||
      a.id.localeCompare(b.id),
  );
  const positions = new Map<string, Accumulator>();
  for (const trade of sorted) {
    const key = JSON.stringify([trade.accountId, trade.securityId]);
    let position = positions.get(key);
    if (!position) {
      position = {
        accountId: trade.accountId,
        securityId: trade.securityId,
        quantity: new D(0),
        realizedPL: new D(0),
        lots: [],
        sales: [],
        lastOrder: null,
      };
      positions.set(key, position);
    }
    const order = JSON.stringify([trade.executedAt, trade.sequence]);
    if (position.lastOrder === order)
      throw new RangeError('Ambiguous execution order: provide a distinct sequence');
    position.lastOrder = order;
    if (trade.side === 'SELL') {
      sell(position, trade);
      continue;
    }
    const quantity = new D(trade.quantity);
    const basis = quantity.times(trade.executionPrice).plus(trade.fee).plus(trade.tax);
    const lastLot = position.lots.at(-1);
    if (lastLot?.tradeDate === trade.tradeDate) {
      lastLot.quantity = lastLot.quantity.plus(quantity);
      lastLot.costBasis = lastLot.costBasis.plus(basis);
    } else {
      position.lots.push({ tradeDate: trade.tradeDate, quantity, costBasis: basis });
    }
    position.quantity = position.quantity.plus(quantity);
  }
  return [...positions.values()]
    .sort(
      (a, b) => a.accountId.localeCompare(b.accountId) || a.securityId.localeCompare(b.securityId),
    )
    .map((position) => {
      const basis = position.lots.reduce((sum, lot) => sum.plus(lot.costBasis), new D(0));
      return {
        accountId: position.accountId,
        securityId: position.securityId,
        currency: 'USD',
        quantity: position.quantity.toFixed(),
        costBasis: basis.toFixed(),
        averageCost: position.quantity.isZero()
          ? null
          : roundCost(basis.div(position.quantity)).toFixed(),
        realizedPL: position.realizedPL.toFixed(),
        lots: position.lots.map((lot) => ({
          tradeDate: lot.tradeDate,
          quantity: lot.quantity.toFixed(),
          costBasis: lot.costBasis.toFixed(),
        })),
        sales: position.sales,
      };
    });
}
