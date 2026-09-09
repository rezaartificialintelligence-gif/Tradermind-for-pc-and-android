import { describe, expect, it } from 'vitest';
import type { Trade } from '../../db/database';
import {
  computeDrawdown,
  computeExpectancy,
  computeProfitFactor,
  computeTotalNetPnl,
  computeWinRate,
} from './canonical';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: crypto.randomUUID(),
    sessionId: null,
    strategyId: null,
    accountId: null,
    boxId: null,
    symbol: 'EURUSD',
    market: 'Forex',
    direction: 'long',
    entryPrice: 1,
    exitPrice: 1,
    stopLoss: 0.99,
    takeProfit: 1.02,
    positionSize: 1,
    riskPercentage: null,
    riskAmount: null,
    rMultiple: 1,
    result: 'win',
    profitLoss: 100,
    fees: 0,
    commission: 0,
    spread: 0,
    status: 'closed',
    openedAt: 1_000,
    closedAt: 2_000,
    reasonForExit: null,
    emotions: '[]',
    emotionNotes: null,
    notes: null,
    screenshots: '[]',
    adherenceScore: null,
    adherenceRating: null,
    adherenceNotes: null,
    review: '{}',
    postTradeReview: '{}',
    tags: '[]',
    createdAt: 1_000,
    liveMonitoring: null,
    plannedEntry: null,
    plannedSL: null,
    plannedTP: null,
    plannedRR: null,
    plannedRisk: null,
    plannedPositionSize: null,
    tradingSession: null,
    setupType: null,
    timezone: null,
    entryReason: null,
    lesson: null,
    slMoved: null,
    tpMoved: null,
    partialClose: null,
    addedToPosition: null,
    reducedPosition: null,
    manualExit: null,
    managementReason: null,
    mtfAnalysis: null,
    ...overrides,
  };
}

describe('canonical financial metrics', () => {
  it('uses net PnL and counts breakeven in the win-rate denominator', () => {
    const trades = [
      trade({ profitLoss: 100, fees: 10, result: 'win', rMultiple: 2 }),
      trade({ profitLoss: -50, fees: 5, result: 'loss', rMultiple: -1 }),
      trade({ profitLoss: 0, result: 'breakeven', rMultiple: 0 }),
    ];
    expect(computeTotalNetPnl(trades)).toBe(35);
    expect(computeWinRate(trades)).toMatchObject({
      sampleSize: 3,
      wins: 1,
      losses: 1,
      breakeven: 1,
      winRate: 1 / 3,
      lossRate: 1 / 3,
    });
  });

  it('computes expectancy from all closed trades, including zero-result trades', () => {
    const trades = [
      trade({ profitLoss: 100, rMultiple: 2, result: 'win' }),
      trade({ profitLoss: -50, rMultiple: -1, result: 'loss' }),
      trade({ profitLoss: 0, rMultiple: 0, result: 'breakeven' }),
    ];
    expect(computeExpectancy(trades).expectancyR).toBeCloseTo(1 / 3);
    expect(computeExpectancy(trades).expectancyPnl).toBeCloseTo(50 / 3);
  });

  it('returns net profit factor and equity drawdown', () => {
    const trades = [
      trade({ closedAt: 2_000, profitLoss: 100, fees: 10, result: 'win' }),
      trade({ closedAt: 3_000, profitLoss: -80, fees: 0, result: 'loss' }),
      trade({ closedAt: 4_000, profitLoss: 40, fees: 0, result: 'win' }),
    ];
    expect(computeProfitFactor(trades).profitFactor).toBeCloseTo(130 / 80);
    expect(computeDrawdown(trades).maxDrawdown).toBe(80);
  });
});