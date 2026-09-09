/**
 * pnl.ts — محاسبات PnL (Profit & Loss)
 * PART 5 / Prompt 3 — Core Metrics Service
 *
 * قانون: هیچ سرویس دیگری نباید این فرمول‌ها را مجدداً پیاده کند.
 */

import { Trade } from '../../db/database';
import { computeDrawdown, computeNetPnlCurve, computeTotalNetPnl, netPnl } from './canonical';

/** نقطه منحنی PnL */
export interface PnlPoint {
  index: number;
  tradeId: string;
  symbol: string;
  pnl: number;
  cumulative: number;
  date: number; // timestamp
}

/** محاسبه PnL تجمعی */
export function computePnlCurve(trades: Trade[]): PnlPoint[] {
  return computeNetPnlCurve(trades).map(point => ({
    index: point.index,
    tradeId: point.tradeId,
    symbol: point.symbol,
    pnl: point.pnl,
    cumulative: point.equity,
    date: point.date,
  }));
}

/** مجموع PnL خالص پس از کسر هزینه‌ها */
export function computeTotalPnl(trades: Trade[]): number {
  return computeTotalNetPnl(trades);
}

/** بیشترین سود در یک معامله */
export function computeMaxWin(trades: Trade[]): number | null {
  const vals = trades.map(netPnl).filter((v): v is number => v !== null && v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** بیشترین ضرر در یک معامله */
export function computeMaxLoss(trades: Trade[]): number | null {
  const vals = trades.map(netPnl).filter((v): v is number => v !== null && v < 0);
  return vals.length ? Math.min(...vals) : null;
}

/** حداکثر افت منحنی equity خالص */
export function computeMaxDrawdown(trades: Trade[]): { absolute: number; percentage: number | null } {
  const result = computeDrawdown(trades);
  return { absolute: result.maxDrawdown, percentage: result.maxDrawdownPct };
}

/** میانگین سود خالص به ضرر خالص */
export function computeRiskRewardRatio(trades: Trade[]): number | null {
  const pnls = trades.map(netPnl).filter((v): v is number => v !== null);
  const wins = pnls.filter(value => value > 0);
  const losses = pnls.filter(value => value < 0);
  if (!wins.length || !losses.length) return null;
  const avgWin = wins.reduce((sum, value) => sum + value, 0) / wins.length;
  const avgLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0) / losses.length);
  return avgLoss > 0 ? avgWin / avgLoss : null;
}
