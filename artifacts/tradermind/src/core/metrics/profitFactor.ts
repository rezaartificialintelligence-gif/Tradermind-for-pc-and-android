/**
 * profitFactor.ts — محاسبه Profit Factor
 * PART 5 / Prompt 3 — Core Metrics Service
 *
 * Profit Factor = مجموع سودها / قدرمطلق مجموع ضررها
 * بالای ۱ یعنی سودده، بالای ۱.۵ عالی.
 */

import { Trade } from '../../db/database';
import { computeProfitFactor as computeCanonicalProfitFactor } from './canonical';

export interface ProfitFactorResult {
  profitFactor: number | null;
  profitFactorR: number | null;   // بر اساس R
  totalWinPnl: number;
  totalLossPnl: number;
  totalWinR: number;
  totalLossR: number;
  grade: 'excellent' | 'good' | 'average' | 'poor' | 'insufficient';
}

export function computeProfitFactor(trades: Trade[]): ProfitFactorResult {
  const canonical = computeCanonicalProfitFactor(trades);
  const closed = trades.filter(t => t.status === 'closed');
  const totalWinR = closed.reduce((s, t) => s + Math.max(0, t.rMultiple ?? 0), 0);
  const totalLossR = Math.abs(closed.reduce((s, t) => s + Math.min(0, t.rMultiple ?? 0), 0));
  const profitFactor = canonical.profitFactor;
  const totalWinPnl = canonical.totalWinPnl;
  const totalLossPnl = canonical.totalLossPnl;
  const profitFactorR = totalLossR > 0 ? totalWinR / totalLossR : null;

  const grade = (() => {
    if (profitFactor === null) return 'insufficient';
    if (profitFactor >= 2.0) return 'excellent';
    if (profitFactor >= 1.5) return 'good';
    if (profitFactor >= 1.0) return 'average';
    return 'poor';
  })();

  return {
    profitFactor,
    profitFactorR,
    totalWinPnl,
    totalLossPnl,
    totalWinR,
    totalLossR,
    grade,
  };
}
