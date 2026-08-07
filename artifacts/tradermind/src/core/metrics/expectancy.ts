/**
 * expectancy.ts — محاسبه Expectancy
 * PART 5 / Prompt 3 — Core Metrics Service
 *
 * Expectancy = (WinRate × AvgWin) + (LossRate × AvgLoss)
 * نتیجه مثبت یعنی سیستم سودده است.
 */

import { Trade } from '../../db/database';
import { isClosed, isWin, isLoss } from '../../lib/tradeHelpers';

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
  const closed = trades.filter(isClosed);
  const wins = closed.filter(isWin);
  const losses = closed.filter(isLoss);
  const n = closed.length;

  const winRate = n > 0 ? wins.length / n : null;
  const lossRate = n > 0 ? losses.length / n : null;

  // R-based
  const winRs = wins.filter(t => t.rMultiple !== null).map(t => t.rMultiple!);
  const lossRs = losses.filter(t => t.rMultiple !== null).map(t => t.rMultiple!);
  const avgWinR = winRs.length ? winRs.reduce((s, v) => s + v, 0) / winRs.length : null;
  const avgLossR = lossRs.length ? lossRs.reduce((s, v) => s + v, 0) / lossRs.length : null;

  let expectancy: number | null = null;
  if (winRate !== null && lossRate !== null && avgWinR !== null && avgLossR !== null) {
    expectancy = winRate * avgWinR + lossRate * avgLossR;
  }

  // PnL-based
  const winPnls = wins.filter(t => t.profitLoss !== null).map(t => t.profitLoss!);
  const lossPnls = losses.filter(t => t.profitLoss !== null).map(t => t.profitLoss!);
  const avgWinPnl = winPnls.length ? winPnls.reduce((s, v) => s + v, 0) / winPnls.length : null;
  const avgLossPnl = lossPnls.length ? lossPnls.reduce((s, v) => s + v, 0) / lossPnls.length : null;

  let expectancyPnl: number | null = null;
  if (winRate !== null && lossRate !== null && avgWinPnl !== null && avgLossPnl !== null) {
    expectancyPnl = winRate * avgWinPnl + lossRate * avgLossPnl;
  }

  return {
    expectancy,
    expectancyPnl,
    avgWinR,
    avgLossR,
    avgWinPnl,
    avgLossPnl,
    winRate,
    lossRate,
    sampleSize: n,
  };
}
