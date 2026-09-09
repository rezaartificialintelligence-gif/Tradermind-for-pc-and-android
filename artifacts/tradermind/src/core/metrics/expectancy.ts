/**
 * expectancy.ts — محاسبه Expectancy
 * PART 5 / Prompt 3 — Core Metrics Service
 *
 * Expectancy = (WinRate × AvgWin) + (LossRate × AvgLoss)
 * نتیجه مثبت یعنی سیستم سودده است.
 */

import { Trade } from '../../db/database';
import { computeExpectancy as computeCanonicalExpectancy } from './canonical';

export interface ExpectancyResult {
  expectancy: number | null;        // بر حسب R
  expectancyPnl: number | null;     // بر حسب مقدار مالی
  avgWinR: number | null;
  avgLossR: number | null;
  avgWinPnl: number | null;
  avgLossPnl: number | null;
  winRate: number | null;
  lossRate: number | null;
  sampleSize: number;
}

/** محاسبه Expectancy بر اساس R-Multiple */
export function computeExpectancy(trades: Trade[]): ExpectancyResult {
  const canonical = computeCanonicalExpectancy(trades);
  const { sampleSize } = canonical;
  const wins = trades.filter(t => t.status === 'closed' && (t.result === 'win' || t.result === 'partial-win'));
  const losses = trades.filter(t => t.status === 'closed' && (t.result === 'loss' || t.result === 'partial-loss'));

  return {
    expectancy: canonical.expectancyR,
    expectancyPnl: canonical.expectancyPnl,
    avgWinR: canonical.avgWinR,
    avgLossR: canonical.avgLossR,
    avgWinPnl: canonical.avgWinPnl,
    avgLossPnl: canonical.avgLossPnl,
    winRate: sampleSize ? wins.length / sampleSize : null,
    lossRate: sampleSize ? losses.length / sampleSize : null,
    sampleSize,
  };
}
