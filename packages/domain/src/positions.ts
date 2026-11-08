import type Decimal from 'decimal.js';
import { FinancialDecimal as D, roundCost } from './decimal.js';
import { mergeLedger } from './ledger.js';
import type { ExecutionTrade, Trade } from './trade.js';

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
  readonly allocatedCostBasis: string | null;
  readonly realizedPL: string | null;
  readonly allocations: readonly CostLot[];
}

export type CalculationStatus = 'AVAILABLE' | 'AMBIGUOUS_DOCUMENT_ORDER' | 'INCOMPLETE_HISTORY';

export interface Position {
  readonly accountId: string;
  readonly securityId: string;
  readonly currency: 'USD';
  readonly quantity: string;
  readonly costBasis: string | null;
  readonly averageCost: string | null;
  readonly realizedPL: string | null;
  readonly calculationStatus: CalculationStatus;
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
  calculationStatus: CalculationStatus;
}

function allocate(
  position: Accumulator,
  quantity: Decimal,
): { cost: Decimal; allocations: CostLot[] } {
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
  return { cost, allocations };
}

function saleAmounts(trade: Trade): { gross: Decimal; net: Decimal } {
  const gross =
    trade.status === 'CONFIRMED'
      ? new D(trade.grossAmount)
      : new D(trade.quantity).times(trade.executionPrice);
  const net =
    trade.status === 'CONFIRMED' ? new D(trade.netAmount) : gross.minus(trade.fee).minus(trade.tax);
  return { gross, net };
}

function saleRecord(
  trade: Trade,
  cost: Decimal | null,
  allocations: readonly CostLot[],
): RealizedSale {
  const { gross, net } = saleAmounts(trade);
  return {
    tradeId: trade.id,
    quantity: trade.quantity,
    grossProceeds: gross.toFixed(),
    fee: trade.fee,
    tax: trade.tax,
    netProceeds: net.toFixed(),
    allocatedCostBasis: cost?.toFixed() ?? null,
    realizedPL: cost === null ? null : net.minus(cost).toFixed(),
    allocations,
  };
}

function sell(position: Accumulator, trade: Trade): void {
  const quantity = new D(trade.quantity);
  const { cost, allocations } = allocate(position, quantity);
  const { net } = saleAmounts(trade);
  const realized = net.minus(cost);
  position.quantity = position.quantity.minus(quantity);
  position.realizedPL = position.realizedPL.plus(realized);
  position.sales.push(saleRecord(trade, cost, allocations));
}

function buy(position: Accumulator, trade: Trade): void {
  const quantity = new D(trade.quantity);
  const basis =
    trade.status === 'CONFIRMED'
      ? new D(trade.netAmount)
      : quantity.times(trade.executionPrice).plus(trade.fee).plus(trade.tax);
  const lastLot = position.lots.at(-1);
  if (lastLot?.tradeDate === trade.tradeDate) {
    lastLot.quantity = lastLot.quantity.plus(quantity);
    lastLot.costBasis = lastLot.costBasis.plus(basis);
  } else position.lots.push({ tradeDate: trade.tradeDate, quantity, costBasis: basis });
  position.quantity = position.quantity.plus(quantity);
}

function executionOrder(a: ExecutionTrade, b: ExecutionTrade): number {
  return (
    a.executedAt.localeCompare(b.executedAt) || a.sequence - b.sequence || a.id.localeCompare(b.id)
  );
}

function unavailable(position: Accumulator, trades: readonly Trade[]): void {
  position.lots = [];
  for (const trade of trades) {
    position.quantity =
      trade.side === 'BUY'
        ? position.quantity.plus(trade.quantity)
        : position.quantity.minus(trade.quantity);
    if (trade.side === 'SELL') position.sales.push(saleRecord(trade, null, []));
  }
}

/** Fills retain execution ordering; documentary days never acquire invented instants. */
export function rebuildPositions(trades: readonly Trade[]): readonly Position[] {
  const checked = mergeLedger([], trades);
  if (checked.duplicates) throw new RangeError('Ledger contains duplicate transactions');
  const groups = new Map<string, Trade[]>();
  for (const trade of checked.added) {
    const key = JSON.stringify([trade.accountId, trade.securityId]);
    const group = groups.get(key) ?? [];
    group.push(trade);
    groups.set(key, group);
  }
  const positions: Accumulator[] = [];
  for (const group of groups.values()) {
    const first = group[0]!;
    const position: Accumulator = {
      accountId: first.accountId,
      securityId: first.securityId,
      quantity: new D(0),
      realizedPL: new D(0),
      lots: [],
      sales: [],
      calculationStatus: 'AVAILABLE',
    };
    positions.push(position);
    const days = new Map<string, Trade[]>();
    for (const trade of group) {
      const day = days.get(trade.tradeDate) ?? [];
      day.push(trade);
      days.set(trade.tradeDate, day);
    }
    for (const [, day] of [...days.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      day.sort((a, b) => a.id.localeCompare(b.id));
      const executions = day
        .filter((trade): trade is ExecutionTrade => trade.status === 'FILLED')
        .sort(executionOrder);
      for (let index = 1; index < executions.length; index += 1) {
        const a = executions[index - 1]!;
        const b = executions[index]!;
        if (a.executedAt === b.executedAt && a.sequence === b.sequence)
          throw new RangeError('Ambiguous execution order: provide a distinct sequence');
      }
      const dayHasDocument = day.some((trade) => trade.status === 'CONFIRMED');
      if (
        position.calculationStatus === 'AVAILABLE' &&
        dayHasDocument &&
        day.some((trade) => trade.side === 'BUY') &&
        day.some((trade) => trade.side === 'SELL')
      ) {
        position.calculationStatus = 'AMBIGUOUS_DOCUMENT_ORDER';
      }
      if (position.calculationStatus !== 'AVAILABLE') {
        unavailable(position, day);
        continue;
      }
      if (dayHasDocument && day.every((trade) => trade.side === 'SELL')) {
        const quantity = day.reduce((sum, trade) => sum.plus(trade.quantity), new D(0));
        if (quantity.gt(position.quantity)) {
          position.calculationStatus = 'INCOMPLETE_HISTORY';
          unavailable(position, day);
          continue;
        }
        // Only the day's aggregate FIFO allocation is knowable when sell instants are absent.
        const { cost, allocations } = allocate(position, quantity);
        const net = day.reduce((sum, trade) => sum.plus(saleAmounts(trade).net), new D(0));
        position.quantity = position.quantity.minus(quantity);
        position.realizedPL = position.realizedPL.plus(net.minus(cost));
        position.sales.push(
          ...day.map((trade) =>
            saleRecord(trade, day.length === 1 ? cost : null, day.length === 1 ? allocations : []),
          ),
        );
        continue;
      }
      const ordered = dayHasDocument ? day : executions;
      for (let index = 0; index < ordered.length; index += 1) {
        const trade = ordered[index]!;
        if (trade.side === 'BUY') buy(position, trade);
        else if (new D(trade.quantity).gt(position.quantity)) {
          // A known execution cannot consume future documentary purchases. Date-only
          // sells and already-unavailable history are handled at the day boundary.
          throw new RangeError(`Oversell: ${trade.id}`);
        } else sell(position, trade);
      }
    }
  }
  return positions
    .sort(
      (a, b) => a.accountId.localeCompare(b.accountId) || a.securityId.localeCompare(b.securityId),
    )
    .map((position) => {
      const basis = position.lots.reduce((sum, lot) => sum.plus(lot.costBasis), new D(0));
      const known = position.calculationStatus === 'AVAILABLE';
      return {
        accountId: position.accountId,
        securityId: position.securityId,
        currency: 'USD',
        quantity: position.quantity.toFixed(),
        costBasis: known ? basis.toFixed() : null,
        averageCost:
          !known || position.quantity.isZero()
            ? null
            : roundCost(basis.div(position.quantity)).toFixed(),
        realizedPL: known ? position.realizedPL.toFixed() : null,
        calculationStatus: position.calculationStatus,
        lots: position.lots.map((lot) => ({
          tradeDate: lot.tradeDate,
          quantity: lot.quantity.toFixed(),
          costBasis: lot.costBasis.toFixed(),
        })),
        sales: position.sales,
      };
    });
}
