/**
 * instrumentSpecs.ts
 * جدول مرجع اندازه قرارداد (Contract Size) برای نمادهای مختلف.
 *
 * pointValue یعنی: به ازای هر ۱ واحد حرکت قیمت (Price)، روی ۱ لات استاندارد
 * چند دلار سود/زیان ایجاد می‌شود. مثال‌ها:
 *  - فارکس (EURUSD, GBPUSD, ...): ۱ لات = ۱۰۰٬۰۰۰ واحد؛ حرکت ۱ واحد قیمت (مثلاً از
 *    1.1000 به 2.1000) روی ۱ لات = ۱۰۰٬۰۰۰ دلار. اما چون قیمت‌ها را با پیپ می‌سنجیم
 *    (۰.۰۰۰۱)، معمول‌تر است pointValue را بر حسب «هر پیپ» تعریف کنیم: هر پیپ ≈ ۱۰ دلار.
 *    چون این ابزار فاصله حد ضرر را از تفاضل قیمت خام (price - price) می‌گیرد نه پیپ،
 *    اینجا pointValue را بر حسب «هر ۱ واحد قیمت خام» تعریف کرده‌ایم: ۱۰۰٬۰۰۰.
 *  - طلا (XAUUSD): ۱ لات = ۱۰۰ اونس؛ حرکت ۱ دلار قیمت روی ۱ لات = ۱۰۰ دلار.
 *  - نقره (XAGUSD): ۱ لات = ۵۰۰۰ اونس؛ حرکت ۱ دلار قیمت روی ۱ لات = ۵۰۰۰ دلار.
 *  - شاخص‌ها و کریپتو: بسته به بروکر متفاوت است؛ پیش‌فرض ۱ گذاشته شده (هر بروکر را
 *    باید در تنظیمات نماد بررسی کرد).
 *
 * این اعداد میانگین/استاندارد بازار هستند و ممکن است بین بروکرها کمی فرق کنند؛
 * برای دقت کامل، همیشه با مشخصات نماد در بروکر خودتان مقایسه کنید.
 */

export interface InstrumentSpec {
  /** واحد پول به ازای هر ۱ واحد حرکت قیمت خام روی ۱ لات استاندارد */
  pointValue: number;
  /** اندازه یک پیپ/تیک به واحد قیمت خام (برای نمایش راهنما) */
  pipSize: number;
  label: string;
}

const FOREX_MAJOR_SPEC: InstrumentSpec = { pointValue: 100000, pipSize: 0.0001, label: 'فارکس (۱ لات = ۱۰۰٬۰۰۰ واحد)' };
const FOREX_JPY_SPEC: InstrumentSpec = { pointValue: 100000, pipSize: 0.01, label: 'فارکس/ین (۱ لات = ۱۰۰٬۰۰۰ واحد)' };

export const INSTRUMENT_SPECS: Record<string, InstrumentSpec> = {
  // فارکس — جفت‌ارزهای اصلی و متقاطع (پیپ = ۰.۰۰۰۱)
  EURUSD: FOREX_MAJOR_SPEC, GBPUSD: FOREX_MAJOR_SPEC, USDCHF: FOREX_MAJOR_SPEC,
  AUDUSD: FOREX_MAJOR_SPEC, NZDUSD: FOREX_MAJOR_SPEC, USDCAD: FOREX_MAJOR_SPEC,
  EURGBP: FOREX_MAJOR_SPEC, EURCHF: FOREX_MAJOR_SPEC, GBPCHF: FOREX_MAJOR_SPEC,
  AUDNZD: FOREX_MAJOR_SPEC, EURAUD: FOREX_MAJOR_SPEC, EURCAD: FOREX_MAJOR_SPEC,
  EURNZD: FOREX_MAJOR_SPEC, GBPAUD: FOREX_MAJOR_SPEC, GBPCAD: FOREX_MAJOR_SPEC,
  GBPNZD: FOREX_MAJOR_SPEC,
  // فارکس — جفت‌های ین (پیپ = ۰.۰۱)
  USDJPY: FOREX_JPY_SPEC, EURJPY: FOREX_JPY_SPEC, GBPJPY: FOREX_JPY_SPEC,
  AUDJPY: FOREX_JPY_SPEC, CADJPY: FOREX_JPY_SPEC, CHFJPY: FOREX_JPY_SPEC,
  NZDJPY: FOREX_JPY_SPEC,
  // فلزات
  XAUUSD: { pointValue: 100, pipSize: 0.1, label: 'طلا (۱ لات = ۱۰۰ اونس)' },
  XAGUSD: { pointValue: 5000, pipSize: 0.01, label: 'نقره (۱ لات = ۵۰۰۰ اونس)' },
  XPTUSD: { pointValue: 100, pipSize: 0.1, label: 'پلاتین (۱ لات = ۱۰۰ اونس)' },
  // انرژی
  USOIL: { pointValue: 1000, pipSize: 0.01, label: 'نفت WTI (۱ لات = ۱۰۰۰ بشکه)' },
  UKOIL: { pointValue: 1000, pipSize: 0.01, label: 'نفت برنت (۱ لات = ۱۰۰۰ بشکه)' },
  NATGAS: { pointValue: 10000, pipSize: 0.001, label: 'گاز طبیعی (۱ لات = ۱۰٬۰۰۰ MMBtu)' },
  // شاخص‌ها — pointValue بسته به بروکر معمولاً بین ۱ تا ۱۰ دلار به ازای هر پوینت است؛
  // مقدار ۱ به‌عنوان پیش‌فرض محافظه‌کارانه گذاشته شده — پیش از استفاده با بروکر چک شود.
  US30: { pointValue: 1, pipSize: 1, label: 'داو جونز (بسته به بروکر متفاوت است)' },
  NAS100: { pointValue: 1, pipSize: 1, label: 'نزدک (بسته به بروکر متفاوت است)' },
  SPX500: { pointValue: 1, pipSize: 1, label: 'اس‌اند‌پی ۵۰۰ (بسته به بروکر متفاوت است)' },
  GER40: { pointValue: 1, pipSize: 1, label: 'داکس (بسته به بروکر متفاوت است)' },
  UK100: { pointValue: 1, pipSize: 1, label: 'فوتسی ۱۰۰ (بسته به بروکر متفاوت است)' },
  JPN225: { pointValue: 1, pipSize: 1, label: 'نیکی (بسته به بروکر متفاوت است)' },
  FRA40: { pointValue: 1, pipSize: 1, label: 'کک (بسته به بروکر متفاوت است)' },
  AUS200: { pointValue: 1, pipSize: 1, label: 'ASX200 (بسته به بروکر متفاوت است)' },
  VIX: { pointValue: 1, pipSize: 0.01, label: 'شاخص نوسان (بسته به بروکر متفاوت است)' },
};

/** پیش‌فرض عمومی وقتی نماد در جدول نیست (مثل کریپتو که معمولاً ۱ واحد = ۱ لات/کوین است) */
export const DEFAULT_INSTRUMENT_SPEC: InstrumentSpec = { pointValue: 1, pipSize: 1, label: 'عمومی (۱ واحد قیمت = ۱ دلار به ازای هر لات/واحد)' };

export function getInstrumentSpec(symbol: string): InstrumentSpec {
  const key = symbol.trim().toUpperCase();
  return INSTRUMENT_SPECS[key] ?? DEFAULT_INSTRUMENT_SPEC;
}
