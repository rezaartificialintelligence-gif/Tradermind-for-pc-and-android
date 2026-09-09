/**
 * Canonical financial metrics.
 *
 * Internal ratios (win rate, loss rate, review rate) are always 0..1.
 * Display layers may convert them to percentages. Monetary calculations use
 * net PnL, including all recorded trading costs.
 */
import type { Trade } from '../../db/database';
import { isClosed, isWin, isLoss } from '../../lib/tradeHelpers';
import { getTradeNetPnl } from '../../lib/tradeClassification';

export interface CanonicalWinRate {
  sampleSize: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  lossRate: number | null;
}

export interface CanonicalDrawdown {
  maxDrawdown: number;
  maxDrawdownPct: number | null;
  peakEquity: number;
  endingEquity: number;
  curve: Array<{ index: number; tradeId: string; symbol: string; pnl: number; equity: number; date: number }>;
}

export interface CanonicalExpectancy {
  expectancyR: number | null;
  expectancyPnl: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  avgWinPnl: number | null;
  avgLossPnl: number | null;
  sampleSize: number;
}

export function finiteValues(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function canonicalClosedTrades(trades: Trade[]): Trade[] {
  return trades.filter(isClosed);
}

export function netPnl(trade: Trade): number | null {
  return getTradeNetPnl(trade);
}

export function computeWinRate(trades: Trade[]): CanonicalWinRate {
  const closed = canonicalClosedTrades(trades);
  const wins = closed.filter(isWin).length;
  const losses = closed.filter(isLoss).length;
  const breakeven = closed.filter(t => t.result === 'breakeven').length;
  return {
    sampleSize: closed.length,
    wins,
    losses,
    breakeven,
    winRate: closed.length ? wins / closed.length : null,
    lossRate: closed.length ? losses / closed.length : null,
  };
}

export function computeTotalNetPnl(trades: Trade[]): number {
  return canonicalClosedTrades(trades).reduce((sum, trade) => sum + (netPnl(trade) ?? 0), 0);
}

export function computeNetPnlCurve(trades: Trade[]): CanonicalDrawdown['curve'] {
  const closed = canonicalClosedTrades(trades)
    .filter(trade => netPnl(trade) !== null)
    .sort((a, b) => (a.closedAt ?? a.openedAt) - (b.closedAt ?? b.openedAt));
  let equity = 0;
  return closed.map((trade, index) => {
    const pnl = netPnl(trade)!;
    equity += pnl;
    return {
      index: index + 1,
      tradeId: trade.id,
      symbol: trade.symbol,
      pnl,
      equity,
      date: trade.closedAt ?? trade.openedAt,
    };
  });
}

export function computeDrawdown(trades: Trade[], initialEquity = 0): CanonicalDrawdown {
  const curve = computeNetPnlCurve(trades);
  let peakEquity = initialEquity;
  let maxDrawdown = 0;
  for (const point of curve) {
    const equity = initialEquity + point.equity;
    if (equity > peakEquity) peakEquity = equity;
    maxDrawdown = Math.max(maxDrawdown, peakEquity - equity);
  }
  const endingEquity = initialEquity + (curve.at(-1)?.equity ?? 0);
  return {
    maxDrawdown,
    maxDrawdownPct: peakEquity > 0 ? (maxDrawdown / peakEquity) * 100 : null,
    peakEquity,
    endingEquity,
    curve,
  };
}

export function computeExpectancy(trades: Trade[]): CanonicalExpectancy {
  const closed = canonicalClosedTrades(trades);
  const wins = closed.filter(isWin);
  const losses = closed.filter(isLoss);
  const winRs = finiteValues(wins.map(t => t.rMultiple));
  const lossRs = finiteValues(losses.map(t => t.rMultiple));
  const winPnls = wins.map(netPnl).filter((v): v is number => v !== null);
  const lossPnls = losses.map(netPnl).filter((v): v is number => v !== null);
  const allRs = finiteValues(closed.map(t => t.rMultiple));
  const allPnls = closed.map(netPnl).filter((v): v is number => v !== null);
  return {
    // The denominator is all closed trades, so breakeven trades contribute zero.
    expectancyR: allRs.length === closed.length && closed.length ? average(allRs) : null,
    expectancyPnl: allPnls.length === closed.length && closed.length ? average(allPnls) : null,
    avgWinR: average(winRs),
    avgLossR: average(lossRs),
    avgWinPnl: average(winPnls),
    avgLossPnl: average(lossPnls),
    sampleSize: closed.length,
  };
}

export function computeProfitFactor(trades: Trade[]): {
  profitFactor: number | null;
  totalWinPnl: number;
  totalLossPnl: number;
} {
  const pnls = canonicalClosedTrades(trades).map(netPnl).filter((v): v is number => v !== null);
  const totalWinPnl = pnls.filter(value => value > 0).reduce((sum, value) => sum + value, 0);
  const totalLossPnl = Math.abs(pnls.filter(value => value < 0).reduce((sum, value) => sum + value, 0));
  return {
    profitFactor: totalLossPnl > 0 ? totalWinPnl / totalLossPnl : null,
    totalWinPnl,
    totalLossPnl,
  };
}