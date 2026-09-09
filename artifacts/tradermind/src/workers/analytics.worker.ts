/**
 * analytics.worker.ts — PART 6 / Prompt 3
 *
 * Web Worker برای محاسبات سنگین analytics روی thread جداگانه.
 * جلوگیری از freeze شدن UI هنگام محاسبه.
 *
 * ارتباط: postMessage → Worker → Result → React State
 */

import { Trade } from '../db/database';
import { isWin, isLoss, isClosed } from '../lib/tradeHelpers';
import { getTradingDateParts } from '../lib/tradingTime';
import type { TradingTimeConfig } from '../lib/tradingTime';

// ── Message Types ─────────────────────────────────────────────────────────────

export type WorkerRequest =
  | { type: 'COMPUTE_EDGE'; trades: Trade[]; timeConfig?: TradingTimeConfig }
  | { type: 'COMPUTE_PERFORMANCE'; trades: Trade[]; timeConfig?: TradingTimeConfig }
  | { type: 'COMPUTE_RISK'; trades: Trade[]; timeConfig?: TradingTimeConfig }
  | { type: 'COMPUTE_STATISTICS'; trades: Trade[]; timeConfig?: TradingTimeConfig }
  | { type: 'COMPUTE_ALL'; trades: Trade[]; timeConfig?: TradingTimeConfig };

export type WorkerResponse =
  | { type: 'EDGE_RESULT'; data: EdgeAnalyticsResult }
  | { type: 'PERFORMANCE_RESULT'; data: PerformanceResult }
  | { type: 'RISK_RESULT'; data: RiskResult }
  | { type: 'STATISTICS_RESULT'; data: StatisticsResult }
  | { type: 'ALL_RESULT'; data: { edge: EdgeAnalyticsResult; performance: PerformanceResult; risk: RiskResult; statistics: StatisticsResult } }
  | { type: 'ERROR'; message: string };

// ── Result Types ──────────────────────────────────────────────────────────────

export interface EdgeAnalyticsResult {
  winRate: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  avgR: number | null;
  bestSymbol: string | null;
  bestSession: string | null;
  bestDayOfWeek: string | null;
  bySymbol: { symbol: string; winRate: number | null; count: number }[];
  bySession: { session: string; winRate: number | null; count: number }[];
}

export interface PerformanceResult {
  totalPnl: number;
  maxDrawdown: number;
  maxDrawdownPct: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  largestWin: number | null;
  largestLoss: number | null;
  consecutiveWins: number;
  consecutiveLosses: number;
  pnlCurve: { index: number; cumulative: number }[];
}

export interface RiskResult {
  avgRisk: number | null;
  maxRisk: number | null;
  riskConsistency: number | null;
  kellyPct: number | null;
  sharpeRatio: number | null;
  rMultipleDistribution: { r: string; count: number }[];
}

export interface StatisticsResult {
  medianR: number | null;
  stdDevR: number | null;
  skewness: number | null;
  kurtosis: number | null;
  sampleSize: number;
  confidenceInterval: { lower: number; upper: number } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function avg(arr: number[]): number | null {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
}

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdDev(arr: number[]): number | null {
  const m = avg(arr);
  if (m === null || arr.length < 2) return null;
  const variance = arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// ── Computation Functions ─────────────────────────────────────────────────────

function computeEdge(trades: Trade[], timeConfig?: TradingTimeConfig): EdgeAnalyticsResult {
  const closed = trades.filter(isClosed);
  const wins = closed.filter(isWin);
  const losses = closed.filter(isLoss);
  const n = closed.length;
  const winRate = n > 0 ? wins.length / n : null;

  const Rs = closed.filter(t => t.rMultiple !== null).map(t => t.rMultiple!);
  const winRs = wins.filter(t => t.rMultiple !== null).map(t => t.rMultiple!);
  const lossRs = losses.filter(t => t.rMultiple !== null).map(t => t.rMultiple!);
  const avgR = avg(Rs);
  const lossRate = n > 0 ? losses.length / n : null;
  const avgWinR = avg(winRs);
  const avgLossR = avg(lossRs);
  const expectancy = winRate !== null && lossRate !== null && avgWinR !== null && avgLossR !== null
    ? winRate * avgWinR + lossRate * avgLossR : null;

  const totalWin = wins.reduce((s, t) => s + Math.max(0, t.profitLoss ?? 0), 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + Math.min(0, t.profitLoss ?? 0), 0));
  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : null;

  // By symbol
  const symbolMap = new Map<string, Trade[]>();
  for (const t of closed) {
    if (!symbolMap.has(t.symbol)) symbolMap.set(t.symbol, []);
    symbolMap.get(t.symbol)!.push(t);
  }
  const bySymbol = [...symbolMap.entries()]
    .map(([symbol, ts]) => ({
      symbol,
      winRate: ts.length > 0 ? ts.filter(isWin).length / ts.length : null,
      count: ts.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const bestSymbol = bySymbol.find(s => (s.winRate ?? 0) > 0)?.symbol ?? null;

  // By session
  const sessionMap = new Map<string, Trade[]>();
  for (const t of closed) {
    const s = t.tradingSession ?? 'unknown';
    if (!sessionMap.has(s)) sessionMap.set(s, []);
    sessionMap.get(s)!.push(t);
  }
  const bySession = [...sessionMap.entries()]
    .map(([session, ts]) => ({
      session,
      winRate: ts.length > 0 ? ts.filter(isWin).length / ts.length : null,
      count: ts.length,
    }));

  const bestSession = bySession.sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0]?.session ?? null;

  // Best day of week
  const DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  const dayWins = DAYS.map((d, i) => {
    const dt = closed.filter(t => getTradingDateParts(t.openedAt, timeConfig).dayOfWeek === i);
    return { day: d, winRate: dt.length > 0 ? dt.filter(isWin).length / dt.length : null };
  });
  const bestDayOfWeek = dayWins.sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0]?.day ?? null;

  return { winRate, expectancy, profitFactor, avgR, bestSymbol, bestSession, bestDayOfWeek, bySymbol, bySession };
}

function computePerformance(trades: Trade[]): PerformanceResult {
  const closed = trades.filter(isClosed).filter(t => t.profitLoss !== null).sort((a, b) => a.openedAt - b.openedAt);
  const wins = closed.filter(isWin);
  const losses = closed.filter(isLoss);

  let peak = 0, equity = 0, maxDD = 0;
  const pnlCurve: { index: number; cumulative: number }[] = [];
  for (let i = 0; i < closed.length; i++) {
    equity += closed[i].profitLoss!;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
    pnlCurve.push({ index: i + 1, cumulative: equity });
  }

  // Consecutive wins/losses
  let maxCW = 0, maxCL = 0, cw = 0, cl = 0;
  for (const t of closed) {
    if (isWin(t)) { cw++; cl = 0; maxCW = Math.max(maxCW, cw); }
    else if (isLoss(t)) { cl++; cw = 0; maxCL = Math.max(maxCL, cl); }
    else { cw = 0; cl = 0; }
  }

  const winPnls = wins.map(t => t.profitLoss!);
  const lossPnls = losses.map(t => t.profitLoss!);

  return {
    totalPnl: equity,
    maxDrawdown: maxDD,
    maxDrawdownPct: peak > 0 ? (maxDD / peak) * 100 : null,
    avgWin: avg(winPnls),
    avgLoss: avg(lossPnls),
    largestWin: winPnls.length ? Math.max(...winPnls) : null,
    largestLoss: lossPnls.length ? Math.min(...lossPnls) : null,
    consecutiveWins: maxCW,
    consecutiveLosses: maxCL,
    pnlCurve,
  };
}

function computeRisk(trades: Trade[]): RiskResult {
  const closed = trades.filter(isClosed);
  const risks = closed.filter(t => t.riskPercentage !== null).map(t => t.riskPercentage!);
  const Rs = closed.filter(t => t.rMultiple !== null).map(t => t.rMultiple!);

  const avgR = avg(Rs);
  const avgRisk = avg(risks);
  const sdR = stdDev(Rs);
  const sharpeRatio = avgR !== null && sdR !== null && sdR > 0 ? avgR / sdR : null;

  const wins = closed.filter(isWin);
  const losses = closed.filter(isLoss);
  const winRate = closed.length > 0 ? wins.length / closed.length : null;
  const avgWinR = avg(wins.filter(t => t.rMultiple !== null).map(t => t.rMultiple!));
  const avgLossR = avg(losses.filter(t => t.rMultiple !== null).map(t => Math.abs(t.rMultiple!)));
  const kellyPct = winRate !== null && avgWinR !== null && avgLossR !== null && avgLossR > 0
    ? (winRate / avgLossR - (1 - winRate) / avgWinR) * 100 : null;

  const riskConsistency = avgRisk && stdDev(risks) ? (stdDev(risks)! / avgRisk) * 100 : null;

  const buckets = new Map<string, number>();
  for (const r of Rs) {
    const bucket = (Math.round(r * 2) / 2).toFixed(1);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const rMultipleDistribution = [...buckets.entries()]
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([r, count]) => ({ r, count }));

  return {
    avgRisk,
    maxRisk: risks.length ? Math.max(...risks) : null,
    riskConsistency,
    kellyPct,
    sharpeRatio,
    rMultipleDistribution,
  };
}

function computeStatistics(trades: Trade[]): StatisticsResult {
  const closed = trades.filter(isClosed);
  const Rs = closed.filter(t => t.rMultiple !== null).map(t => t.rMultiple!);
  const n = Rs.length;
  const m = avg(Rs);
  const sd = stdDev(Rs);
  const med = median(Rs);

  let skewness: number | null = null;
  let kurtosis: number | null = null;
  if (m !== null && sd !== null && sd > 0 && n >= 3) {
    skewness = Rs.reduce((s, v) => s + Math.pow((v - m) / sd, 3), 0) / n;
  }
  if (m !== null && sd !== null && sd > 0 && n >= 4) {
    kurtosis = Rs.reduce((s, v) => s + Math.pow((v - m) / sd, 4), 0) / n - 3;
  }

  // 95% CI
  let confidenceInterval: { lower: number; upper: number } | null = null;
  if (m !== null && sd !== null && n >= 5) {
    const se = sd / Math.sqrt(n);
    confidenceInterval = { lower: m - 1.96 * se, upper: m + 1.96 * se };
  }

  return { medianR: med, stdDevR: sd, skewness, kurtosis, sampleSize: n, confidenceInterval };
}

// ── Worker Message Handler ─────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const { type, trades } = event.data;
    switch (type) {
      case 'COMPUTE_EDGE':
        self.postMessage({ type: 'EDGE_RESULT', data: computeEdge(trades, event.data.timeConfig) } as WorkerResponse);
        break;
      case 'COMPUTE_PERFORMANCE':
        self.postMessage({ type: 'PERFORMANCE_RESULT', data: computePerformance(trades) } as WorkerResponse);
        break;
      case 'COMPUTE_RISK':
        self.postMessage({ type: 'RISK_RESULT', data: computeRisk(trades) } as WorkerResponse);
        break;
      case 'COMPUTE_STATISTICS':
        self.postMessage({ type: 'STATISTICS_RESULT', data: computeStatistics(trades) } as WorkerResponse);
        break;
      case 'COMPUTE_ALL':
        self.postMessage({
          type: 'ALL_RESULT',
          data: {
          edge: computeEdge(trades, event.data.timeConfig),
            performance: computePerformance(trades),
            risk: computeRisk(trades),
            statistics: computeStatistics(trades),
          },
        } as WorkerResponse);
        break;
      default:
        self.postMessage({ type: 'ERROR', message: `Unknown type: ${(event.data as any).type}` } as WorkerResponse);
    }
  } catch (err) {
    self.postMessage({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) } as WorkerResponse);
  }
};
