/**
 * riskMetrics.ts — محاسبات ریسک
 * PART 5 / Prompt 3 — Core Metrics Service
 */

import { Trade } from '../../db/database';
import { isClosed } from '../../lib/tradeHelpers';

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

function avg(arr: number[]): number | null {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
}

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(arr: number[]): number | null {
  const m = avg(arr);
  if (m === null || arr.length < 2) return null;
  const variance = arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function computeRiskMetrics(trades: Trade[]): RiskMetricsResult {
  const closed = trades.filter(isClosed);
  const Rs = closed.filter(t => t.rMultiple !== null).map(t => t.rMultiple!);
  const risks = closed.filter(t => t.riskPercentage !== null).map(t => t.riskPercentage!);

  const avgRVal = avg(Rs);
  const stdDevR = stdDev(Rs);
  const avgRiskPct = avg(risks);

  // Risk Consistency (CV)
  const riskConsistency = avgRiskPct && stdDev(risks)
    ? (stdDev(risks)! / avgRiskPct) * 100
    : null;

  // Sharpe Ratio (simplified — R/stdDev)
  const sharpeRatio = avgRVal !== null && stdDevR !== null && stdDevR > 0
    ? avgRVal / stdDevR
    : null;

  // Sortino Ratio (downside deviation)
  const downside = Rs.filter(r => r < 0);
  const downsideStd = stdDev(downside);
  const sortinoRatio = avgRVal !== null && downsideStd !== null && downsideStd > 0
    ? avgRVal / downsideStd
    : null;

  // Kelly Criterion
  const wins = closed.filter(t => (t.rMultiple ?? 0) > 0);
  const losses = closed.filter(t => (t.rMultiple ?? 0) < 0);
  const winRate = closed.length > 0 ? wins.length / closed.length : null;
  const avgWinR = avg(wins.map(t => t.rMultiple!));
  const avgLossR = avg(losses.map(t => Math.abs(t.rMultiple!)));
  const kellyPct = winRate !== null && avgWinR !== null && avgLossR !== null && avgLossR > 0
    ? (winRate / avgLossR - (1 - winRate) / avgWinR) * 100
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
    medianR: median(Rs),
    stdDevR,
    avgRiskPct,
    riskConsistency,
    sharpeRatio,
    sortinoRatio,
    kellyPct,
    rMultipleDistribution,
  };
}
