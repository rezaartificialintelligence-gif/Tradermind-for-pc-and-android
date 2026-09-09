/**
 * riskMetrics.ts — محاسبات ریسک
 * PART 5 / Prompt 3 — Core Metrics Service
 */

import { Trade } from '../../db/database';
import { isClosed, coefficientOfVariation, avg as helperAvg, median as helperMedian, stdDev as helperStdDev } from '../../lib/tradeHelpers';

export interface RiskMetricsResult {
  avgR: number | null;
  medianR: number | null;
  stdDevR: number | null;
  avgRiskPct: number | null;
  riskConsistency: number | null;   // CV = stdDev/mean (کمتر = بهتر)
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  kellyPct: number | null;          // Kelly Criterion
  rMultipleDistribution: { r: string; count: number }[];
}

export function computeRiskMetrics(trades: Trade[]): RiskMetricsResult {
  const closed = trades.filter(isClosed);
  const Rs = closed.filter(t => t.rMultiple !== null).map(t => t.rMultiple!);
  const risks = closed.filter(t => t.riskPercentage !== null).map(t => t.riskPercentage!);

  const avgRVal = helperAvg(Rs);
  const stdDevR = helperStdDev(Rs);
  const avgRiskPct = helperAvg(risks);

  // Risk Consistency (CV)
  const riskConsistency = coefficientOfVariation(risks);

  // Sharpe Ratio (simplified — R/stdDev)
  const sharpeRatio = avgRVal !== null && stdDevR !== null && stdDevR > 0
    ? avgRVal / stdDevR
    : null;

  // Sortino Ratio (downside deviation)
  const downsideSquares = Rs.map(r => Math.min(0, r) ** 2);
  const downsideDeviation = downsideSquares.length
    ? Math.sqrt(downsideSquares.reduce((sum, value) => sum + value, 0) / downsideSquares.length)
    : null;
  const sortinoRatio = avgRVal !== null && downsideDeviation !== null && downsideDeviation > 0
    ? avgRVal / downsideDeviation
    : null;

  // Kelly Criterion
  const wins = closed.filter(t => (t.rMultiple ?? 0) > 0);
  const losses = closed.filter(t => (t.rMultiple ?? 0) < 0);
  const winRate = closed.length > 0 ? wins.length / closed.length : null;
  const avgWinR = helperAvg(wins.map(t => t.rMultiple!));
  const avgLossR = helperAvg(losses.map(t => Math.abs(t.rMultiple!)));
  // Kelly Criterion: f* = W - (1-W)/R, where W = win rate and R = avgWin/avgLoss (win/loss ratio).
  // (The previous formula divided by avgLossR/avgWinR directly instead of using their ratio,
  // which produced values with the wrong scale/sign.)
  const winLossRatio = avgWinR !== null && avgLossR !== null && avgLossR > 0 ? avgWinR / avgLossR : null;
  const kellyPct = winRate !== null && winLossRatio !== null && winLossRatio > 0
    ? (winRate - (1 - winRate) / winLossRatio) * 100
    : null;

  // توزیع R-Multiple در bucket‌های ۰.۵
  const buckets = new Map<string, number>();
  for (const r of Rs) {
    const bucket = (Math.round(r * 2) / 2).toFixed(1);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const rMultipleDistribution = [...buckets.entries()]
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([r, count]) => ({ r, count }));

  return {
    avgR: avgRVal,
    medianR: helperMedian(Rs),
    stdDevR,
    avgRiskPct,
    riskConsistency,
    sharpeRatio,
    sortinoRatio,
    kellyPct,
    rMultipleDistribution,
  };
}
