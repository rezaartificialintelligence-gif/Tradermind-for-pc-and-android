/**
 * core/metrics — barrel export
 * PART 5 / Prompt 3
 */

export * from './pnl';
export * from './winRate';
export * from './expectancy';
export * from './profitFactor';
export * from './riskMetrics';
export {
  average,
  canonicalClosedTrades,
  computeDrawdown,
  computeNetPnlCurve,
  computeTotalNetPnl,
  finiteValues,
  netPnl,
} from './canonical';
export type {
  CanonicalDrawdown,
  CanonicalExpectancy,
  CanonicalWinRate,
} from './canonical';
