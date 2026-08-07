/**
 * tradeHelpers.ts
 * توابع کمکی مشترک برای تحلیل معاملات
 *
 * این فایل مرکز توابع pure است که قبلاً در چندین سرویس و صفحه تکرار می‌شدند.
 * تمام سرویس‌ها و صفحات باید از اینجا import کنند.
 *
 * قوانین:
 * - هیچ import از db یا سرویس دیگری نداشته باشد (فقط از database.ts برای types)
 * - فقط توابع pure (بدون side-effect)
 * - قابل استفاده در هر context (service, page, hook)
 */

import type { Trade, PostTradeReviewData, BehaviorFlag } from '../db/database';
import { getTradingDateKey, getTradingMonthKey } from './tradingTime';

// ── وضعیت معامله ──────────────────────────────────────────────────────────────

export const isClosed   = (t: Trade): boolean => t.status === 'closed';
export const isOpen     = (t: Trade): boolean => t.status === 'open';
export const isWin      = (t: Trade): boolean => t.result === 'win' || t.result === 'partial-win';
export const isLoss     = (t: Trade): boolean => t.result === 'loss' || t.result === 'partial-loss';
export const isBreakEven= (t: Trade): boolean => t.result === 'breakeven';

// ── تاریخ ─────────────────────────────────────────────────────────────────────

/** تبدیل timestamp به رشته YYYY-MM-DD */
export function toDateStr(ts: number): string {
  return getTradingDateKey(ts);
}

/** تبدیل timestamp به رشته YYYY-MM */
export function toMonthStr(ts: number): string {
  return getTradingMonthKey(ts);
}

// ── ریاضیات ───────────────────────────────────────────────────────────────────

/** میانگین آرایه اعداد — null اگر خالی باشد */
export function avg(arr: number[]): number | null {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
}

/** انحراف معیار — null اگر کمتر از ۲ عنصر باشد */
export function stdDev(arr: number[]): number | null {
  if (arr.length < 2) return null;
  const m = avg(arr)!;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

/** میانه آرایه اعداد — null اگر خالی باشد */
export function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

/** ضریب تغییرات (پراکندگی نسبی) — null اگر میانگین صفر یا داده کم باشد */
export function coefficientOfVariation(arr: number[]): number | null {
  if (arr.length < 2) return null;
  const m = avg(arr)!;
  if (!m) return null;
  return (stdDev(arr)! / Math.abs(m));
}

/** جمع آرایه */
export function sum(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0);
}

/** کلمپ عدد بین min و max */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ── Post Trade Review ─────────────────────────────────────────────────────────

/** پارس ایمن PostTradeReviewData از رشته JSON */
export function getPTR(t: Trade): PostTradeReviewData | null {
  if (!t.postTradeReview) return null;
  try {
    const parsed = JSON.parse(t.postTradeReview);
    return parsed && typeof parsed === 'object' ? parsed as PostTradeReviewData : null;
  } catch {
    return null;
  }
}

/** بررسی وجود یک BehaviorFlag در معامله */
export function hasFlag(t: Trade, flag: BehaviorFlag): boolean {
  try {
    return getPTR(t)?.behaviorFlags?.includes(flag) ?? false;
  } catch {
    return false;
  }
}

/** شمارش تعداد BehaviorFlag در مجموعه‌ای از معاملات */
export function flagCount(trades: Trade[], flag: BehaviorFlag): number {
  return trades.filter(t => hasFlag(t, flag)).length;
}

// ── احساسات ───────────────────────────────────────────────────────────────────

const NEGATIVE_EMOTIONS = new Set([
  'FOMO', 'Fearful', 'Anxious', 'Frustrated', 'Angry', 'Revenge Trading', 'Overconfident',
  'Impatient', 'Greedy', 'Stressed', 'Confused',
]);

const POSITIVE_EMOTIONS = new Set([
  'Calm', 'Confident', 'Focused', 'Neutral', 'Patient', 'Disciplined',
]);

/** آیا احساسات اولیه معامله منفی بوده‌اند */
export function hasNegativeEmotion(t: Trade): boolean {
  try {
    const emotions = JSON.parse(t.emotions) as string[];
    return emotions.some(e => NEGATIVE_EMOTIONS.has(e));
  } catch {
    return false;
  }
}

/** لیست احساسات parse‌شده یک معامله */
export function getEmotions(t: Trade): string[] {
  try {
    return JSON.parse(t.emotions) as string[];
  } catch {
    return [];
  }
}

// ── معیارهای ادهرنس ──────────────────────────────────────────────────────────

/** تبدیل adherenceRating به عدد ۰–۱۰۰ */
export function adherenceToScore(rating: string | null | undefined): number | null {
  switch (rating) {
    case 'fully':     return 100;
    case 'mostly':    return 75;
    case 'partially': return 40;
    case 'not':       return 0;
    default:          return null;
  }
}

// ── گروه‌بندی ─────────────────────────────────────────────────────────────────

/** گروه‌بندی معاملات بر اساس تاریخ (YYYY-MM-DD) */
export function groupByDate(trades: Trade[]): Map<string, Trade[]> {
  const map = new Map<string, Trade[]>();
  trades.forEach(t => {
    const d = toDateStr(t.openedAt);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(t);
  });
  return map;
}

/** گروه‌بندی معاملات بر اساس ماه (YYYY-MM) */
export function groupByMonth(trades: Trade[]): Map<string, Trade[]> {
  const map = new Map<string, Trade[]>();
  trades.forEach(t => {
    const m = toMonthStr(t.openedAt);
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(t);
  });
  return map;
}

// ── امتیاز عملکرد ─────────────────────────────────────────────────────────────

/** تبدیل امتیاز عددی (۰–۱۰۰) به حرف رتبه */
export function scoreToGrade(score: number): string {
  return score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
}

/** رنگ CSS برای امتیاز */
export function scoreColor(score: number): string {
  return score >= 75 ? '#22c55e' : score >= 55 ? '#eab308' : score >= 35 ? '#f97316' : '#ef4444';
}

/** درصد با فرمت فارسی */
export function faPct(n: number | null, decimals = 0): string {
  return n !== null ? `${n.toFixed(decimals)}٪` : '—';
}

/** عدد R با نشانه فارسی */
export function faR(n: number | null, decimals = 2): string {
  return n !== null ? `${n.toFixed(decimals)}R` : '—';
}
