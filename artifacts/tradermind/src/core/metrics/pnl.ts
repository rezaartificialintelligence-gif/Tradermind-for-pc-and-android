/**
 * pnl.ts — محاسبات PnL (Profit & Loss)
 * PART 5 / Prompt 3 — Core Metrics Service
 *
 * قانون: هیچ سرویس دیگری نباید این فرمول‌ها را مجدداً پیاده کند.
 */

import { Trade } from '../../db/database';
import { isClosed } from '../../lib/tradeHelpers';

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
  const closed = trades
    .filter(isClosed)
    .filter(t => t.profitLoss !== null)
    .sort((a, b) => a.openedAt - b.openedAt);

  let cumulative = 0;
  return closed.map((t, i) => {
    const pnl = t.profitLoss!;
    cumulative += pnl;
    return {
      index: i + 1,
      tradeId: t.id,
      symbol: t.symbol,
      pnl,
      cumulative,
      date: t.closedAt ?? t.openedAt,
    };
  });
}

/** مجموع PnL */
export function computeTotalPnl(trades: Trade[]): number {
  return trades
    .filter(isClosed)
    .reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
}

/** بیشترین سود در یک معامله */
export function computeMaxWin(trades: Trade[]): number | null {
  const vals = trades
    .filter(isClosed)
    .map(t => t.profitLoss ?? 0)
    .filter(v => v > 0);
  return vals.length ? Math.max(...vals) : null;
}

/** بیشترین ضرر در یک معامله */
export function computeMaxLoss(trades: Trade[]): number | null {
  const vals = trades
    .filter(isClosed)
    .map(t => t.profitLoss ?? 0)
    .filter(v => v < 0);
  return vals.length ? Math.min(...vals) : null;
}

/** حداکثر drawdown — از peak تا bottom */
export function computeMaxDrawdown(trades: Trade[]): { absolute: number; percentage: number | null } {
  const closed = trades
    .filter(isClosed)
    .filter(t => t.profitLoss !== null)
    .sort((a, b) => a.openedAt - b.openedAt);

  let peak = 0;
  let equity = 0;
  let maxDD = 0;

  for (const t of closed) {
    equity += t.profitLoss!;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    absolute: maxDD,
    percentage: peak > 0 ? (maxDD / peak) * 100 : null,
  };
}

/** میانگین سود به ضرر (Avg Win / Avg Loss) */
export function computeRiskRewardRatio(trades: Trade[]): number | null {
  const closed = trades.filter(isClosed);
  const wins = closed.filter(t => (t.profitLoss ?? 0) > 0);
  const losses = closed.filter(t => (t.profitLoss ?? 0) < 0);

  if (!wins.length || !losses.length) return null;

  const avgWin = wins.reduce((s, t) => s + t.profitLoss!, 0) / wins.length;
  const avgLoss = Math.abs(losses.reduce((s, t) => s + t.profitLoss!, 0) / losses.length);

  return avgLoss > 0 ? avgWin / avgLoss : null;
}
