/**
 * tradeRepository.ts — PART 2 / Prompt 3
 *
 * تمام دسترسی به db.trades از این Repository عبور می‌کند.
 * هدف: حذف full-table scan، استفاده از indexed queries، و pagination.
 */

import { db, Trade } from '../../db/database';

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface TradeFilters {
  status?: 'open' | 'closed' | 'cancelled';
  symbol?: string;
  strategyId?: string;
  accountId?: string;
  boxId?: string;
  fromDate?: number;   // timestamp ms
  toDate?: number;     // timestamp ms
}

const DEFAULT_PAGE_SIZE = 50;

// ── Query بهینه بر اساس فیلترها ──────────────────────────────────────────────

/**
 * دریافت معاملات با query بهینه — بدون full-table scan غیرضروری.
 *
 * استراتژی: یک ایندکس Dexie برای محدود کردن اولیهٔ نتایج انتخاب می‌شود (بر اساس
 * محدودکننده‌ترین فیلتر موجود)، سپس تمام فیلترهای دیگر — بدون استثنا — در حافظه
 * روی همان subset اعمال می‌شوند. برخلاف نسخهٔ قبلی، دیگر هیچ ترکیبی از فیلترها
 * (مثلاً بازهٔ تاریخ + استراتژی، یا بازهٔ تاریخ + نماد) نادیده گرفته نمی‌شود.
 */
export async function getTrades(filters?: TradeFilters): Promise<Trade[]> {
  if (!filters || Object.keys(filters).length === 0) {
    return db.trades.toArray();
  }

  // انتخاب یک ایندکس اولیه برای کوچک کردن subset — ترتیب بر اساس محدودکنندگی تخمینی.
  const collection = (() => {
    if (filters.fromDate !== undefined && filters.toDate !== undefined) {
      return db.trades.where('openedAt').between(filters.fromDate, filters.toDate, true, true);
    }
    if (filters.symbol) {
      return db.trades.where('symbol').equals(filters.symbol);
    }
    if (filters.strategyId) {
      return db.trades.where('strategyId').equals(filters.strategyId);
    }
    if (filters.accountId) {
      return db.trades.where('accountId').equals(filters.accountId);
    }
    if (filters.boxId) {
      return db.trades.where('boxId').equals(filters.boxId);
    }
    if (filters.status) {
      return db.trades.where('status').equals(filters.status);
    }
    return db.trades.toCollection();
  })();

  let results = await collection.toArray();

  // تمام فیلترهای باقی‌مانده — بدون قید و شرط — روی subset اعمال می‌شوند.
  // (ایندکسی که برای query اولیه استفاده شد اینجا دوباره چک می‌شود؛ این تکرار
  // بی‌خطر است چون همان نتیجه را می‌دهد، ولی تضمین می‌کند هیچ ترکیبی از فیلترها
  // نادیده گرفته نشود.)
  if (filters.status) {
    results = results.filter((t: Trade) => t.status === filters.status);
  }
  if (filters.symbol) {
    results = results.filter((t: Trade) => t.symbol === filters.symbol);
  }
  if (filters.strategyId) {
    results = results.filter((t: Trade) => t.strategyId === filters.strategyId);
  }
  if (filters.accountId) {
    results = results.filter((t: Trade) => t.accountId === filters.accountId);
  }
  if (filters.boxId) {
    results = results.filter((t: Trade) => t.boxId === filters.boxId);
  }
  if (filters.fromDate !== undefined) {
    results = results.filter((t: Trade) => t.openedAt >= filters.fromDate!);
  }
  if (filters.toDate !== undefined) {
    results = results.filter((t: Trade) => t.openedAt <= filters.toDate!);
  }

  return results;
}

/** معاملات بازه زمانی — با openedAt index */
export async function getTradesByDateRange(from: number, to: number): Promise<Trade[]> {
  return db.trades.where('openedAt').between(from, to, true, true).toArray();
}

/** معاملات یک نماد — با symbol index */
export async function getTradesBySymbol(symbol: string): Promise<Trade[]> {
  return db.trades.where('symbol').equals(symbol).toArray();
}

/** معاملات یک استراتژی — با strategyId index */
export async function getTradesByStrategy(strategyId: string): Promise<Trade[]> {
  return db.trades.where('strategyId').equals(strategyId).toArray();
}

/** معاملات بسته — با status index */
export async function getClosedTrades(): Promise<Trade[]> {
  return db.trades.where('status').equals('closed').toArray();
}

/** شمارش معاملات — بدون بارگذاری همه داده */
export async function countTrades(status?: string): Promise<number> {
  if (status) {
    return db.trades.where('status').equals(status).count();
  }
  return db.trades.count();
}

// ── Pagination با cursor ──────────────────────────────────────────────────────

/**
 * Paginated trades با cursor (بهترین گزینه برای Dexie).
 * از offset-based استفاده می‌کند اما با .offset().limit() که Dexie بهینه می‌کند.
 *
 * نکته: برخلاف نسخهٔ قبلی که فقط یکی از فیلترها را در query اصلی اعمال می‌کرد و
 * بقیه را نادیده می‌گرفت (و همین باعث offset/pagination نادرست هم می‌شد)، اینجا
 * یک ایندکس اولیه برای query انتخاب می‌شود و تمام فیلترهای دیگر با Collection.filter
 * (پیش از offset/limit) روی همان کوئری اعمال می‌شوند — تا هم فیلتر کامل درست باشد و
 * هم شمارش/صفحه‌بندی با هم هماهنگ بمانند.
 */
export async function getPaginatedTrades(
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  filters?: TradeFilters,
): Promise<PaginatedResult<Trade>> {
  const offset = (page - 1) * pageSize;

  const buildCollection = () => {
    let collection = (() => {
      if (filters?.fromDate !== undefined && filters?.toDate !== undefined) {
        return db.trades.where('openedAt').between(filters.fromDate, filters.toDate, true, true);
      }
      if (filters?.status) return db.trades.where('status').equals(filters.status);
      if (filters?.symbol) return db.trades.where('symbol').equals(filters.symbol);
      if (filters?.strategyId) return db.trades.where('strategyId').equals(filters.strategyId);
      if (filters?.accountId) return db.trades.where('accountId').equals(filters.accountId);
      if (filters?.boxId) return db.trades.where('boxId').equals(filters.boxId);
      return db.trades.toCollection();
    })();

    // هر فیلتری که در انتخاب ایندکس اصلی استفاده نشد، اینجا به‌صورت ترکیبی اعمال می‌شود.
    if (filters?.status) collection = collection.and((t: Trade) => t.status === filters.status);
    if (filters?.symbol) collection = collection.and((t: Trade) => t.symbol === filters.symbol);
    if (filters?.strategyId) collection = collection.and((t: Trade) => t.strategyId === filters.strategyId);
    if (filters?.accountId) collection = collection.and((t: Trade) => t.accountId === filters.accountId);
    if (filters?.boxId) collection = collection.and((t: Trade) => t.boxId === filters.boxId);
    if (filters?.fromDate !== undefined) collection = collection.and((t: Trade) => t.openedAt >= filters.fromDate!);
    if (filters?.toDate !== undefined) collection = collection.and((t: Trade) => t.openedAt <= filters.toDate!);

    return collection;
  };

  // شمارش کل (روی همان مجموعهٔ فیلترشده)
  const total = await buildCollection().count();

  // دریافت صفحه با orderBy + offset + limit — باید از ابتدا مرتب و سپس فیلتر شود
  // تا offset/limit روی نتیجهٔ نهایی درست عمل کند؛ Dexie این کار را با sortBy انجام
  // نمی‌دهد، پس مرتب‌سازی را به‌صورت دستی پس از فیلتر کامل انجام می‌دهیم.
  const filtered = await buildCollection().toArray();
  filtered.sort((a: Trade, b: Trade) => b.openedAt - a.openedAt); // جدیدترین ابتدا
  const items = filtered.slice(offset, offset + pageSize);

  return {
    items,
    page,
    pageSize,
    total,
    hasNext: offset + items.length < total,
  };
}

/**
 * Cursor-based pagination (کارایی بهتر برای صفحات بعدی)
 * cursor = آخرین openedAt از صفحه قبل
 */
export async function getTradesAfterCursor(
  cursor: number | null,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<{ items: Trade[]; nextCursor: number | null }> {
  let collection = cursor !== null
    ? db.trades.where('openedAt').below(cursor).reverse()
    : db.trades.orderBy('openedAt').reverse();

  const items = await collection.limit(pageSize).toArray();
  const nextCursor = items.length === pageSize ? items[items.length - 1].openedAt : null;

  return { items, nextCursor };
}

/** دریافت معاملات اخیر برای Dashboard — بهینه */
export async function getRecentTrades(limit = 10): Promise<Trade[]> {
  return db.trades.orderBy('openedAt').reverse().limit(limit).toArray();
}

/** یک معامله با ID */
export async function getTradeById(id: string): Promise<Trade | undefined> {
  return db.trades.get(id);
}

/** تمام معاملات برای analytics — با orderBy برای حذف sort بعدی */
export async function getAllTradesForAnalytics(): Promise<Trade[]> {
  return db.trades.orderBy('openedAt').toArray();
}
