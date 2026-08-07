import { db, Trade, defaultPostTradeReview } from '../db/database';
import { isWin, isClosed } from '../lib/tradeHelpers';
import { strategyService } from './strategyService';
import { analysisService } from './analysisService';
import { tradeVersionService, tradeEventService } from './tradeEventService';
import { detectTradingSession } from '../lib/tradeClassification';

const defaultReview = JSON.stringify({ didWell: '', didWrong: '', learned: '', wouldTakeAgain: null, validSetup: null });
const defaultPostTradeReviewStr = JSON.stringify(defaultPostTradeReview);

export const tradeService = {
  async getAllTrades() {
    return db.trades.orderBy('openedAt').reverse().toArray();
  },

  async getTradeById(id: string) {
    return db.trades.get(id);
  },

  /**
   * PART 1-1: ایجاد معامله در یک transaction واحد (Atomic)
   * trade + tradeEvent اولیه + tradeVersion اولیه همزمان ثبت می‌شوند
   */
  async createTrade(data: Partial<Trade> = {}): Promise<Trade> {
    const id = crypto.randomUUID();
    const now = Date.now();
    // تنظیمات پیش‌فرض از localStorage خوانده می‌شوند تا سرویس دیتابیس
    // به React وابسته نباشد و در Electron/Capacitor هم یکسان کار کند.
    let defaults: Partial<Trade> = {};
    try {
      const stored = JSON.parse(localStorage.getItem('tradermind-app-storage') ?? '{}')?.state;
      defaults = {
        accountId: stored?.defaultAccountId ?? null,
        boxId: stored?.defaultTradingBoxId ?? null,
        symbol: stored?.defaultSymbol ?? '',
        market: stored?.defaultMarket ?? null,
      };
    } catch { /* تنظیمات خراب نباید ثبت معامله را متوقف کند */ }

    // تنظیمات ممکن است به حساب یا باکسی اشاره کنند که بعداً حذف شده است.
    // در این حالت معامله جدید باید بدون شناسه‌ی نامعتبر ساخته شود.
    const [defaultAccount, defaultBox] = await Promise.all([
      defaults.accountId ? db.accounts.get(defaults.accountId) : Promise.resolve(undefined),
      defaults.boxId ? db.tradingBoxes.get(defaults.boxId) : Promise.resolve(undefined),
    ]);
    defaults.accountId = defaultAccount?.id ?? null;
    defaults.boxId = defaultBox?.id ?? null;

    const trade: Trade = {
      sessionId: null, strategyId: null, symbol: '', market: null,
      direction: 'long', entryPrice: 0, exitPrice: null, stopLoss: 0,
      takeProfit: null, positionSize: null, riskPercentage: null, riskAmount: null,
      rMultiple: null, result: 'open', profitLoss: null, fees: null, status: 'open',
      openedAt: now, closedAt: null, reasonForExit: null,
      emotions: '[]', emotionNotes: null, notes: null,
      screenshots: '[]', adherenceScore: null, adherenceRating: null,
      adherenceNotes: null, review: defaultReview, postTradeReview: defaultPostTradeReviewStr,
      tags: '[]', liveMonitoring: null, createdAt: now,
      plannedEntry: null, plannedSL: null, plannedTP: null, plannedRR: null,
      plannedRisk: null, plannedPositionSize: null,
      setupType: null, timezone: null,
      entryReason: null, lesson: null,
      slMoved: null, tpMoved: null, partialClose: null, addedToPosition: null,
      reducedPosition: null, manualExit: null, managementReason: null,
      mtfAnalysis: null,
      ...defaults,
      ...data,
      id,
      accountId: data.accountId ?? defaults.accountId ?? null,
      boxId: data.boxId ?? defaults.boxId ?? null,
      tradingSession: data.tradingSession ?? detectTradingSession(data.openedAt ?? now),
    };

    await db.transaction('rw', [db.trades, db.tradeEvents, db.tradeVersions], async () => {
      // 1. ثبت معامله
      await db.trades.add(trade);

      // 2. ثبت رویداد اولیه (entry event)
      await db.tradeEvents.add({
        id: crypto.randomUUID(),
        tradeId: id,
        eventType: 'entry',
        timestamp: trade.openedAt,
        description: `ورود به ${trade.symbol || '—'} (${trade.direction === 'long' ? 'خرید' : 'فروش'}) @ ${trade.entryPrice}`,
        price: trade.entryPrice,
        data: null,
        createdAt: now,
      });

      // 3. ثبت نسخه اولیه
      await db.tradeVersions.add({
        id: crypto.randomUUID(),
        tradeId: id,
        changedAt: now,
        changes: JSON.stringify([{ field: 'status', label: 'وضعیت', oldValue: null, newValue: 'open' }]),
        snapshot: JSON.stringify(trade),
      });
    });

    return trade;
  },

  /**
   * PART 1-2: بروزرسانی معامله + ثبت نسخه در یک transaction واحد (Atomic)
   */
  async updateTrade(id: string, data: Partial<Trade>) {
    const existing = await db.trades.get(id);
    if (!existing) {
      await db.trades.update(id, data);
      return db.trades.get(id);
    }

    await db.transaction('rw', [db.trades, db.tradeVersions, db.tradeEvents], async () => {
      // بروزرسانی معامله
      await db.trades.update(id, data);

      // ثبت نسخه در صورت تغییر فیلدهای مهم
      await tradeVersionService.recordVersion(existing, data);

      // اگر معامله بسته شد، رویداد exit اضافه کن
      if (data.status === 'closed' && data.exitPrice != null && data.closedAt != null) {
        const hasExitEvent = await db.tradeEvents
          .where('tradeId').equals(id)
          .filter(e => e.eventType === 'exit')
          .count();
        if (hasExitEvent === 0) {
          await db.tradeEvents.add({
            id: crypto.randomUUID(),
            tradeId: id,
            eventType: 'exit',
            timestamp: data.closedAt,
            description: `خروج از ${existing.symbol} @ ${data.exitPrice}${data.result ? ` — ${data.result}` : ''}`,
            price: data.exitPrice,
            data: null,
            createdAt: Date.now(),
          });
        }
      }
    });

    return db.trades.get(id);
  },

  /**
   * PART 1-3: حذف cascade معامله در یک transaction واحد (Atomic)
   * trades + tradeEvents + tradeVersions + riskViolations + chartScreenshots + learningAuditTrail
   * همچنین marketContextSessions که linkedTradeId آن معامله است unlink می‌شوند
   */
  async deleteTrade(id: string) {
    await db.transaction(
      'rw',
      [
        db.trades,
        db.tradeEvents,
        db.tradeVersions,
        db.riskViolations,
        db.chartScreenshots,
        db.learningAuditTrail,
        db.marketContextSessions,
      ],
      async () => {
        // حذف رکوردهای وابسته
        await db.tradeEvents.where('tradeId').equals(id).delete();
        await db.tradeVersions.where('tradeId').equals(id).delete();
        await db.riskViolations.where('tradeId').equals(id).delete();
        await db.chartScreenshots.where('tradeId').equals(id).delete();
        await db.learningAuditTrail.where('tradeId').equals(id).delete();

        // unlink کردن marketContextSessions بدون حذف آن‌ها
        const linkedSessions = await db.marketContextSessions
          .where('linkedTradeId').equals(id).toArray();
        for (const session of linkedSessions) {
          await db.marketContextSessions.update(session.id, { linkedTradeId: null });
        }

        // حذف خود معامله
        await db.trades.delete(id);
      }
    );
  },

  async computeAdherenceScore(sessionId: string): Promise<number | null> {
    try {
      const session = await analysisService.getSessionById(sessionId);
      if (!session) return null;
      const stepResults = JSON.parse(session.stepResults || '{}');
      const phases = await strategyService.getPhasesByStrategyId(session.strategyId);
      let required = 0, answered = 0;
      for (const phase of phases) {
        const steps = await strategyService.getStepsByPhaseId(phase.id);
        for (const step of steps) {
          if (step.required) {
            required++;
            const res = stepResults[step.id];
            if (res && res.value !== null && res.value !== undefined && res.value !== '' && res.value !== false) answered++;
          }
        }
      }
      return required === 0 ? 100 : Math.round((answered / required) * 100);
    } catch { return null; }
  },

  async getStats() {
    const trades = await db.trades.toArray();
    const closed = trades.filter(isClosed);
    const wins = closed.filter(isWin);
    const withR = closed.filter(t => t.rMultiple != null);
    return {
      total: trades.length,
      winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
      totalPnl: trades.reduce((acc, t) => acc + (t.profitLoss || 0) - (t.fees || 0), 0),
      avgRMultiple: withR.length > 0 ? withR.reduce((acc, t) => acc + (t.rMultiple || 0), 0) / withR.length : 0,
      closedCount: closed.length,
      openCount: trades.filter(t => t.status === 'open').length,
    };
  },

  async getTradesWithFilters(filters: {
    search?: string; result?: string; direction?: string; strategyId?: string;
    emotion?: string; adherenceRating?: string; dateFrom?: number; dateTo?: number;
    accountId?: string; boxId?: string;
  } = {}) {
    let trades = await db.trades.orderBy('openedAt').reverse().toArray();
    if (filters.search) { const s = filters.search.toLowerCase(); trades = trades.filter(t => t.symbol.toLowerCase().includes(s)); }
    if (filters.result && filters.result !== 'all') trades = trades.filter(t => t.result === filters.result);
    if (filters.direction && filters.direction !== 'all') trades = trades.filter(t => t.direction === filters.direction);
    if (filters.strategyId && filters.strategyId !== 'all') trades = trades.filter(t => t.strategyId === filters.strategyId);
    if (filters.emotion && filters.emotion !== 'all') {
      trades = trades.filter(t => { try { return (JSON.parse(t.emotions) as string[]).includes(filters.emotion!); } catch { return false; } });
    }
    if (filters.adherenceRating && filters.adherenceRating !== 'all') trades = trades.filter(t => t.adherenceRating === filters.adherenceRating);
    if (filters.dateFrom) trades = trades.filter(t => t.openedAt >= filters.dateFrom!);
    if (filters.dateTo) trades = trades.filter(t => t.openedAt <= filters.dateTo!);
    if (filters.accountId && filters.accountId !== 'all') {
      if (filters.accountId === 'none_set') trades = trades.filter(t => !(t as unknown as Record<string, unknown>)['accountId']);
      else trades = trades.filter(t => (t as unknown as Record<string, unknown>)['accountId'] === filters.accountId);
    }
    if (filters.boxId && filters.boxId !== 'all') {
      if (filters.boxId === 'none_set') trades = trades.filter(t => !(t as unknown as Record<string, unknown>)['boxId']);
      else trades = trades.filter(t => (t as unknown as Record<string, unknown>)['boxId'] === filters.boxId);
    }
    return trades;
  },

  async getTradesByDate(dateStr: string): Promise<Trade[]> {
    const start = new Date(dateStr + 'T00:00:00').getTime();
    const end = new Date(dateStr + 'T23:59:59').getTime();
    return db.trades
      .where('openedAt')
      .between(start, end, true, true)
      .toArray();
  },
};

// re-export for backward compat
export { tradeEventService };
