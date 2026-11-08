import { tradeFingerprint, validateTrade, type Trade, type TradeAlias } from './trade.js';

export class LedgerConflictError extends Error {
  constructor(message = 'Trade identity conflicts with the confirmed ledger; review is required') {
    super(message);
    this.name = 'LedgerConflictError';
  }
}

/** Order summaries may describe the same executions. Without explicit linkage,
 * neither different references nor different date conventions prove disjointness.
 * This import guard is separate from replay so the engine can analyze mixed data.
 */
export function assertCompatibleTradeEvidence(
  existing: readonly Trade[],
  incoming: readonly Trade[],
): void {
  const precisionBySecurity = new Map<string, Set<Trade['status']>>();
  for (const trade of existing) {
    const key = JSON.stringify([trade.accountId, trade.securityId]);
    const precisions = precisionBySecurity.get(key) ?? new Set<Trade['status']>();
    precisions.add(trade.status);
    precisionBySecurity.set(key, precisions);
  }
  for (const trade of incoming) {
    const key = JSON.stringify([trade.accountId, trade.securityId]);
    const precisions = precisionBySecurity.get(key) ?? new Set<Trade['status']>();
    if ([...precisions].some((precision) => precision !== trade.status)) {
      throw new LedgerConflictError(
        'Execution fills and documentary orders for the same account/security require explicit linkage before import',
      );
    }
    precisions.add(trade.status);
    precisionBySecurity.set(key, precisions);
  }
}

function identities(trade: TradeAlias): string[] {
  const keys = [
    JSON.stringify(['id', trade.id]),
    JSON.stringify(['source', trade.importBatchId, trade.sourceRow]),
    trade.fingerprint,
  ];
  if (trade.externalRef !== null) {
    keys.push(JSON.stringify(['external', trade.accountId, trade.externalRef]));
  }
  return keys;
}

export function mergeLedger(
  existing: readonly Trade[],
  incoming: readonly Trade[],
  aliases: readonly TradeAlias[] = [],
): { added: Trade[]; duplicates: number } {
  const byIdentity = new Map<string, TradeAlias>();
  const added: Trade[] = [];
  let duplicates = 0;

  const registerIdentity = (trade: TradeAlias, existingRow: boolean): boolean => {
    const keys = identities(trade);
    let duplicate = false;
    for (const key of keys) {
      const found = byIdentity.get(key);
      if (!found) continue;
      if (
        existingRow ||
        found.fingerprint !== trade.fingerprint ||
        (found.externalRef !== null &&
          trade.externalRef !== null &&
          found.externalRef !== trade.externalRef)
      ) {
        throw new LedgerConflictError();
      }
      duplicate = true;
    }
    // Remember duplicate aliases too, so another row cannot reuse them with changed economics.
    for (const key of keys) {
      const found = byIdentity.get(key);
      if (!found || (found.externalRef === null && trade.externalRef !== null)) {
        byIdentity.set(key, trade);
      }
    }
    return duplicate;
  };

  const registerTrade = (input: Trade, existingRow: boolean): void => {
    const trade = validateTrade(input);
    const duplicate = registerIdentity(
      { ...trade, fingerprint: tradeFingerprint(trade) },
      existingRow,
    );
    if (!existingRow) {
      if (duplicate) duplicates += 1;
      else added.push(trade);
    }
  };

  const registerAlias = (alias: TradeAlias): void => {
    const validIdentifier = (value: unknown): boolean =>
      typeof value === 'string' && value.trim().length > 0 && value.trim() === value;
    if (
      !alias ||
      !validIdentifier(alias.id) ||
      !validIdentifier(alias.accountId) ||
      !validIdentifier(alias.importBatchId) ||
      (alias.externalRef !== null && !validIdentifier(alias.externalRef)) ||
      !Number.isSafeInteger(alias.sourceRow) ||
      alias.sourceRow < 1
    ) {
      throw new LedgerConflictError('Persisted trade alias has invalid identity');
    }
    const canonical = byIdentity.get(alias.fingerprint);
    if (!canonical || canonical.accountId !== alias.accountId) {
      throw new LedgerConflictError('Persisted trade alias does not reference a canonical trade');
    }
    registerIdentity(alias, false);
  };

  for (const trade of existing) registerTrade(trade, true);
  for (const alias of aliases) registerAlias(alias);
  for (const trade of incoming) registerTrade(trade, false);
  return { added, duplicates };
}
