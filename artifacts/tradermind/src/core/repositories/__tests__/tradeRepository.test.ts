/**
 * تست‌های tradeRepository — Prompt 4 (Part 10)
 * از fake-indexeddb برای تست واقعی IndexedDB استفاده می‌کند
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../db/database';
import {
  getTrades,
  getTradeById,
  getTradesBySymbol,
  getClosedTrades,
} from '../tradeRepository';

// ─── داده‌های تستی ────────────────────────────────────────────────────────────

let tradeCounter = 0;

function makeTrade(overrides: Record<string, unknown> = {}) {
  tradeCounter++;
  return {
    id: `trade_${tradeCounter}_${Math.random().toString(36).slice(2)}`,
    sessionId: null,
    strategyId: null,
    accountId: null,
    boxId: null,
    symbol: 'EURUSD',
    market: null,
    direction: 'long' as const,
    entryPrice: 1.08,
    exitPrice: 1.09,
    stopLoss: 1.075,
    takeProfit: null,
    positionSize: 1,
    riskPercentage: 1,
    riskAmount: 50,
    rMultiple: 2,
    result: 'win' as const,
    profitLoss: 100,
    fees: null,
    status: 'closed' as const,
    openedAt: Date.now() - 3600000 + tradeCounter * 1000,
    closedAt: Date.now() + tradeCounter * 1000,
    reasonForExit: null,
    emotions: '[]',
    emotionNotes: null,
    notes: null,
    screenshots: '[]',
    adherenceScore: null,
    adherenceRating: null as null,
    adherenceNotes: null,
    review: '{}',
    postTradeReview: '{}',
    tags: '[]',
    createdAt: Date.now(),
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

beforeEach(async () => {
  await db.trades.clear();
});

// ─── تست‌ها ──────────────────────────────────────────────────────────────────

describe('getTrades', () => {
  it('باید تمام معاملات را بازگرداند', async () => {
    await db.trades.bulkAdd([makeTrade(), makeTrade(), makeTrade()]);
    const trades = await getTrades();
    expect(trades.length).toBe(3);
  });

  it('باید با فیلتر status کار کند', async () => {
    await db.trades.bulkAdd([
      makeTrade({ status: 'closed' }),
      makeTrade({ status: 'open' }),
      makeTrade({ status: 'closed' }),
    ]);
    const closed = await getTrades({ status: 'closed' });
    expect(closed.length).toBe(2);
    expect(closed.every(t => t.status === 'closed')).toBe(true);
  });

  it('باید با فیلتر symbol کار کند', async () => {
    await db.trades.bulkAdd([
      makeTrade({ symbol: 'EURUSD' }),
      makeTrade({ symbol: 'GBPUSD' }),
      makeTrade({ symbol: 'EURUSD' }),
    ]);
    const eurTrades = await getTrades({ symbol: 'EURUSD' });
    expect(eurTrades.length).toBe(2);
  });

  // این تست‌ها مربوط به باگی هستند که پیش‌تر وجود داشت: وقتی چند فیلتر با هم
  // ترکیب می‌شدند (مثلاً بازهٔ تاریخ + استراتژی)، فقط یکی از آن‌ها واقعاً اعمال
  // می‌شد و بقیه بی‌صدا نادیده گرفته می‌شدند.
  it('باید با ترکیب status و accountId هر دو فیلتر را اعمال کند', async () => {
    await db.trades.bulkAdd([
      makeTrade({ status: 'closed', accountId: 'acc-1' }),
      makeTrade({ status: 'closed', accountId: 'acc-2' }),
      makeTrade({ status: 'open', accountId: 'acc-1' }),
    ]);
    const result = await getTrades({ status: 'closed', accountId: 'acc-1' });
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('closed');
    expect(result[0].accountId).toBe('acc-1');
  });

  it('باید با ترکیب بازهٔ تاریخ و strategyId هر دو فیلتر را اعمال کند', async () => {
    const now = Date.now();
    await db.trades.bulkAdd([
      makeTrade({ strategyId: 'strat-a', openedAt: now - 1000 }),
      makeTrade({ strategyId: 'strat-b', openedAt: now - 1000 }),
      makeTrade({ strategyId: 'strat-a', openedAt: now - 10_000_000 }), // خارج از بازه
    ]);
    const result = await getTrades({
      strategyId: 'strat-a',
      fromDate: now - 5000,
      toDate: now + 5000,
    });
    expect(result.length).toBe(1);
    expect(result[0].strategyId).toBe('strat-a');
  });

  it('باید با ترکیب بازهٔ تاریخ و symbol هر دو فیلتر را اعمال کند', async () => {
    const now = Date.now();
    await db.trades.bulkAdd([
      makeTrade({ symbol: 'XAUUSD', openedAt: now - 1000 }),
      makeTrade({ symbol: 'EURUSD', openedAt: now - 1000 }),
      makeTrade({ symbol: 'XAUUSD', openedAt: now - 10_000_000 }), // خارج از بازه
    ]);
    const result = await getTrades({
      symbol: 'XAUUSD',
      fromDate: now - 5000,
      toDate: now + 5000,
    });
    expect(result.length).toBe(1);
    expect(result[0].symbol).toBe('XAUUSD');
  });
});

describe('getTradeById', () => {
  it('باید معامله را با id پیدا کند', async () => {
    const trade = makeTrade({ id: 'test-id-xyz' });
    await db.trades.add(trade);
    const found = await getTradeById('test-id-xyz');
    expect(found?.id).toBe('test-id-xyz');
  });

  it('باید undefined برای id ناموجود برگرداند', async () => {
    const found = await getTradeById('does-not-exist');
    expect(found).toBeUndefined();
  });
});

describe('getTradesBySymbol', () => {
  it('باید معاملات را بر اساس نماد فیلتر کند', async () => {
    await db.trades.bulkAdd([
      makeTrade({ symbol: 'EURUSD' }),
      makeTrade({ symbol: 'XAUUSD' }),
      makeTrade({ symbol: 'EURUSD' }),
    ]);
    const eurTrades = await getTradesBySymbol('EURUSD');
    expect(eurTrades.length).toBe(2);
    expect(eurTrades.every(t => t.symbol === 'EURUSD')).toBe(true);
  });
});

describe('getClosedTrades', () => {
  it('باید فقط معاملات بسته را برگرداند', async () => {
    await db.trades.bulkAdd([
      makeTrade({ status: 'closed' }),
      makeTrade({ status: 'open' }),
      makeTrade({ status: 'cancelled' }),
      makeTrade({ status: 'closed' }),
    ]);
    const closed = await getClosedTrades();
    expect(closed.length).toBe(2);
    expect(closed.every(t => t.status === 'closed')).toBe(true);
  });
});

describe('Delete Trade (cascade test)', () => {
  it('باید معامله حذف شده دیگر پیدا نشود', async () => {
    const trade = makeTrade({ id: 'delete-me-123' });
    await db.trades.add(trade);
    await db.trades.delete('delete-me-123');
    const found = await getTradeById('delete-me-123');
    expect(found).toBeUndefined();
  });
});
