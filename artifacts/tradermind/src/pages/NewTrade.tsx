import { useState, useEffect, useRef, useCallback, type ComponentProps } from "react";
import { Capacitor } from "@capacitor/core";
import { Link, useLocation } from "wouter";
import { tradeService } from "../services/tradeService";
import { analysisService } from "../services/analysisService";
import { strategyService } from "../services/strategyService";
import { accountService } from "../services/accountService";
import { tradingBoxService } from "../services/tradingBoxService";
import { db, Trade, Strategy, AnalysisSession, Account, TradingBox, StrategySetupDefinition } from "../db/database";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, Save, Eye, Plus, X, Image as ImageIcon, Zap, BookOpen, ChevronDown, ChevronUp, CheckSquare, Square, CreditCard, Box, Mic, MicOff, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "../components/ui/progress";
import { format } from "date-fns";
import PreTradeInsightPanel from "../components/PreTradeInsightPanel";
import ScreenshotManager from "../components/ScreenshotManager";
import { TradeScreenshot } from "../types/screenshot";
import { getTradingDateTimeInput, parseTradingDateTimeInput } from "../lib/tradingTime";
import { detectTradingSession } from "../lib/tradeClassification";
import { useNavigationGuard, useGuardedNavigation } from "../navigation/NavigationGuard";
import { getTradeNetPnl } from "../lib/tradeClassification";

const MARKETS = ['Forex', 'Crypto', 'Indices', 'Stocks', 'Commodities', 'Other'];

// ── لیست نمادهای معاملاتی رایج ──────────────────────────────────────────────
const TRADING_SYMBOLS: { label: string; value: string; market: string }[] = [
  // فارکس — جفت‌ارزهای اصلی
  { label: 'EURUSD', value: 'EURUSD', market: 'Forex' },
  { label: 'GBPUSD', value: 'GBPUSD', market: 'Forex' },
  { label: 'USDJPY', value: 'USDJPY', market: 'Forex' },
  { label: 'USDCHF', value: 'USDCHF', market: 'Forex' },
  { label: 'AUDUSD', value: 'AUDUSD', market: 'Forex' },
  { label: 'NZDUSD', value: 'NZDUSD', market: 'Forex' },
  { label: 'USDCAD', value: 'USDCAD', market: 'Forex' },
  // فارکس — جفت‌ارزهای متقاطع
  { label: 'EURGBP', value: 'EURGBP', market: 'Forex' },
  { label: 'EURJPY', value: 'EURJPY', market: 'Forex' },
  { label: 'EURCHF', value: 'EURCHF', market: 'Forex' },
  { label: 'GBPJPY', value: 'GBPJPY', market: 'Forex' },
  { label: 'GBPCHF', value: 'GBPCHF', market: 'Forex' },
  { label: 'AUDJPY', value: 'AUDJPY', market: 'Forex' },
  { label: 'AUDNZD', value: 'AUDNZD', market: 'Forex' },
  { label: 'CADJPY', value: 'CADJPY', market: 'Forex' },
  { label: 'CHFJPY', value: 'CHFJPY', market: 'Forex' },
  { label: 'EURAUD', value: 'EURAUD', market: 'Forex' },
  { label: 'EURCAD', value: 'EURCAD', market: 'Forex' },
  { label: 'EURNZD', value: 'EURNZD', market: 'Forex' },
  { label: 'GBPAUD', value: 'GBPAUD', market: 'Forex' },
  { label: 'GBPCAD', value: 'GBPCAD', market: 'Forex' },
  { label: 'GBPNZD', value: 'GBPNZD', market: 'Forex' },
  { label: 'NZDJPY', value: 'NZDJPY', market: 'Forex' },
  // کالاها
  { label: 'XAUUSD — طلا', value: 'XAUUSD', market: 'Commodities' },
  { label: 'XAGUSD — نقره', value: 'XAGUSD', market: 'Commodities' },
  { label: 'XPTUSD — پلاتین', value: 'XPTUSD', market: 'Commodities' },
  { label: 'USOIL — نفت خام WTI', value: 'USOIL', market: 'Commodities' },
  { label: 'UKOIL — نفت برنت', value: 'UKOIL', market: 'Commodities' },
  { label: 'NATGAS — گاز طبیعی', value: 'NATGAS', market: 'Commodities' },
  // شاخص‌ها
  { label: 'US30 — داو جونز', value: 'US30', market: 'Indices' },
  { label: 'NAS100 — نزدک', value: 'NAS100', market: 'Indices' },
  { label: 'SPX500 — اس‌اند‌پی ۵۰۰', value: 'SPX500', market: 'Indices' },
  { label: 'GER40 — داکس', value: 'GER40', market: 'Indices' },
  { label: 'UK100 — فوتسی ۱۰۰', value: 'UK100', market: 'Indices' },
  { label: 'JPN225 — نیکی', value: 'JPN225', market: 'Indices' },
  { label: 'FRA40 — کک', value: 'FRA40', market: 'Indices' },
  { label: 'AUS200 — ASX200', value: 'AUS200', market: 'Indices' },
  { label: 'VIX — شاخص نوسان', value: 'VIX', market: 'Indices' },
  // کریپتو
  { label: 'BTCUSDT — بیت‌کوین', value: 'BTCUSDT', market: 'Crypto' },
  { label: 'ETHUSDT — اتریوم', value: 'ETHUSDT', market: 'Crypto' },
  { label: 'BNBUSDT — بایننس', value: 'BNBUSDT', market: 'Crypto' },
  { label: 'SOLUSDT — سولانا', value: 'SOLUSDT', market: 'Crypto' },
  { label: 'XRPUSDT — ریپل', value: 'XRPUSDT', market: 'Crypto' },
  { label: 'ADAUSDT — کاردانو', value: 'ADAUSDT', market: 'Crypto' },
  { label: 'DOGEUSDT — دوج‌کوین', value: 'DOGEUSDT', market: 'Crypto' },
  { label: 'DOTUSDT — پولکادات', value: 'DOTUSDT', market: 'Crypto' },
  { label: 'LTCUSDT — لایت‌کوین', value: 'LTCUSDT', market: 'Crypto' },
  { label: 'AVAXUSDT — آوالانچ', value: 'AVAXUSDT', market: 'Crypto' },
  { label: 'MATICUSDT — پالیگان', value: 'MATICUSDT', market: 'Crypto' },
  { label: 'LINKUSDT — چین‌لینک', value: 'LINKUSDT', market: 'Crypto' },
  { label: 'ATOMUSDT — کازموس', value: 'ATOMUSDT', market: 'Crypto' },
  { label: 'NEARUSDT — نیر', value: 'NEARUSDT', market: 'Crypto' },
  { label: 'SUIUSDT — سوئی', value: 'SUIUSDT', market: 'Crypto' },
  { label: 'PEPEUSDT — پپه', value: 'PEPEUSDT', market: 'Crypto' },
  { label: 'TRUMPUSDT — ترامپ', value: 'TRUMPUSDT', market: 'Crypto' },
];

const QUICK_SYMBOLS = [
  { value: 'XAUUSD', label: 'طلا', market: 'Commodities' },
  { value: 'EURUSD', label: 'یورو به دلار', market: 'Forex' },
  { value: 'GBPUSD', label: 'پوند به دلار', market: 'Forex' },
  { value: 'USDJPY', label: 'دلار به ین', market: 'Forex' },
  { value: 'USDCHF', label: 'دلار به فرانک', market: 'Forex' },
  { value: 'AUDUSD', label: 'دلار استرالیا به دلار', market: 'Forex' },
  { value: 'USDCAD', label: 'دلار کانادا به دلار', market: 'Forex' },
  { value: 'NZDUSD', label: 'دلار نیوزیلند به دلار', market: 'Forex' },
];
const CUSTOM_SYMBOLS_KEY = 'tradermind-custom-symbols';
const CUSTOM_SETUPS_KEY = 'tradermind-custom-setups';

// تایم‌فریم‌های قابل انتخاب برای تحلیل چند تایم‌فریمی
const MTF_TIMEFRAMES = ['MN', 'W1', 'D1', '4H', '1H', '15M', '5M', '1M'] as const;
type MtfTimeframe = typeof MTF_TIMEFRAMES[number];

const QUICK_TEMPLATES = [
  { id: 'trend-long', label: 'روندی لانگ', direction: 'long' as const, setupType: 'trend-continuation', tradingSession: 'london' },
  { id: 'trend-short', label: 'روندی شورت', direction: 'short' as const, setupType: 'trend-continuation', tradingSession: 'new-york' },
  { id: 'liquidity-reversal', label: 'لو‌هانت و برگشت', direction: 'long' as const, setupType: 'liquidity-grab', tradingSession: 'london' },
];

function getCustomSymbols(): { label: string; value: string; market: string }[] {
  try {
    const values = JSON.parse(localStorage.getItem(CUSTOM_SYMBOLS_KEY) ?? '[]');
    if (!Array.isArray(values)) return [];
    return values.filter((item): item is { label: string; value: string; market: string } =>
      item && typeof item.value === 'string' && typeof item.label === 'string'
    );
  } catch {
    return [];
  }
}

function getCustomSetups(): string[] {
  try {
    const values = JSON.parse(localStorage.getItem(CUSTOM_SETUPS_KEY) ?? '[]');
    return Array.isArray(values)
      ? values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

// لیست حجم پوزیشن (لات) با گام ۰.۰۱ تا یک لات، سپس مقادیر بزرگ‌تر
const POSITION_SIZE_OPTIONS = [
  ...Array.from({ length: 100 }, (_, index) => Number(((index + 1) / 100).toFixed(2))),
  1.25, 1.50, 1.75, 2.00, 2.50, 3.00, 4.00, 5.00, 7.50, 10.00,
  15.00, 20.00, 25.00, 30.00, 50.00, 100.00,
];

// لیست درصد ریسک
const RISK_PERCENTAGE_OPTIONS = [
  0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00,
  2.50, 3.00, 4.00, 5.00, 7.50, 10.00,
];

function normalizeDecimalInput(value: string): string {
  const normalized = value
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[٫,]/g, '.')
    .replace(/[^\d.-]/g, '');
  const sign = normalized.startsWith('-') ? '-' : '';
  const unsigned = normalized.replace(/-/g, '');
  const [whole = '', ...fraction] = unsigned.split('.');
  return `${sign}${whole}${fraction.length > 0 ? `.${fraction.join('')}` : ''}`;
}

function customDecimalValue(value: string): number | null {
  if (!value || value === '.') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function decimalValue(value: string): number | null {
  if (!value || value === '.' || value === '-') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function NumericInput({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const lastSyncedValue = useRef<number | null>(value ?? null);

  useEffect(() => {
    const externalValue = value ?? null;
    if (externalValue !== lastSyncedValue.current) {
      setText(externalValue == null ? '' : String(externalValue));
      lastSyncedValue.current = externalValue;
    }
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      step="any"
      value={text}
      onChange={event => {
        const nextText = normalizeDecimalInput(event.target.value);
        const nextValue = decimalValue(nextText);
        setText(nextText);
        lastSyncedValue.current = nextValue;
        onValueChange(nextValue);
      }}
      dir="ltr"
    />
  );
}

function StableTextarea({
  value,
  onChange,
  voice = false,
  ...props
}: ComponentProps<typeof Textarea> & { voice?: boolean }) {
  const externalValue = typeof value === 'string' ? value : '';
  const [text, setText] = useState(externalValue);

  useEffect(() => {
    // فقط وقتی مقدار واقعاً از بیرون تغییر کرده است همگام‌سازی کن.
    // این کار از بازنشانی caret هنگام هر رندر فرم جلوگیری می‌کند.
    if (externalValue !== text) setText(externalValue);
  }, [externalValue, text]);

  const appendVoiceText = (spoken: string) => {
    const next = `${text}${text.trim() ? ' ' : ''}${spoken}`.trim();
    setText(next);
    onChange?.({ target: { value: next } } as any);
  };

  return (
    <div className="relative">
      <Textarea
        {...props}
        value={text}
        className={`${props.className ?? ''}${voice ? ' pb-10' : ''}`}
        onChange={event => {
          setText(event.target.value);
          onChange?.(event);
        }}
      />
      {voice && (
        <div className="absolute bottom-1 left-1">
          <VoiceInputButton onText={appendVoiceText} />
        </div>
      )}
    </div>
  );
}

function VoiceInputButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isWebRuntime =
    typeof window !== 'undefined' &&
    window.location.protocol !== 'file:' &&
    !window.electronAPI?.isElectron &&
    !Capacitor.isNativePlatform();

  if (!isWebRuntime) return null;

  const toggle = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('تبدیل گفتار به متن در این مرورگر پشتیبانی نمی‌شود.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fa-IR';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript;
      if (text) onText(text);
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error('دریافت صدا انجام نشد.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={toggle}>
      {listening ? <MicOff className="h-3.5 w-3.5 text-rose-500" /> : <Mic className="h-3.5 w-3.5" />}
      {listening ? 'در حال شنیدن…' : 'گفتار به متن'}
    </Button>
  );
}

// حالت‌های احساسی به فارسی
const EMOTIONS = [
  { id: 'Calm',            label: 'آرام',                 color: 'bg-sky-500' },
  { id: 'Confident',       label: 'مطمئن',                color: 'bg-emerald-500' },
  { id: 'Uncertain',       label: 'نامطمئن',              color: 'bg-amber-500' },
  { id: 'Fearful',         label: 'ترسیده',               color: 'bg-orange-500' },
  { id: 'Anxious',         label: 'مضطرب',                color: 'bg-orange-500' },
  { id: 'Excited',         label: 'هیجان‌زده',            color: 'bg-violet-500' },
  { id: 'Frustrated',      label: 'ناکام',                color: 'bg-red-500' },
  { id: 'FOMO',            label: 'ترس از دست دادن',      color: 'bg-rose-500' },
  { id: 'Revenge Trading', label: 'معامله انتقامی',       color: 'bg-red-600' },
  { id: 'Overconfident',   label: 'بیش از حد مطمئن',      color: 'bg-yellow-500' },
  { id: 'Tired',           label: 'خسته',                 color: 'bg-slate-500' },
  { id: 'Distracted',      label: 'حواس‌پرت',             color: 'bg-slate-500' },
];

// ── کامپوننت انتخاب نماد با جستجو ──────────────────────────────────────────
function SymbolSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [customSymbols, setCustomSymbols] = useState(getCustomSymbols);
  const [customInput, setCustomInput] = useState('');
  const allSymbols = [...TRADING_SYMBOLS, ...customSymbols];

  const displayValue = value || '';

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          placeholder="وارد کردن نماد (مثلاً EURUSD، BTCUSDT، XAUUSD)"
          value={displayValue}
          onChange={e => {
            const v = e.target.value.toUpperCase();
            onChange(v);
          }}
          className="text-lg font-bold uppercase"
          autoComplete="off"
        />
      </div>
      {displayValue && (
        <p className="text-xs text-muted-foreground">
          {allSymbols.find(s => s.value === displayValue)?.market || 'نماد سفارشی'}
          {' • '}
          {allSymbols.find(s => s.value === displayValue)?.label.includes('—')
            ? allSymbols.find(s => s.value === displayValue)?.label.split('—')[1].trim()
            : displayValue}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {QUICK_SYMBOLS.map(sym => (
          <button
            key={sym.value}
            type="button"
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              displayValue === sym.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
            onClick={() => onChange(sym.value)}
          >
            {sym.value} <span className="opacity-70">({sym.label})</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Input
          value={customInput}
          onChange={e => setCustomInput(e.target.value.toUpperCase())}
          placeholder="نماد سفارشی، مثلاً US100"
          className="h-8 text-sm"
          dir="ltr"
          autoComplete="off"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          disabled={!customInput.trim()}
          onClick={() => {
            const symbol = customInput.trim().toUpperCase();
            if (!symbol) return;
            const next = [...customSymbols.filter(s => s.value !== symbol), { value: symbol, label: 'نماد سفارشی', market: tradeMarket(symbol) }];
            setCustomSymbols(next);
            localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(next));
            onChange(symbol);
            setCustomInput('');
          }}
        >
          افزودن
        </Button>
      </div>
      {customSymbols.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {customSymbols.map(symbol => (
            <div key={symbol.value} className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs">
              <button type="button" onClick={() => onChange(symbol.value)} className="text-primary hover:underline">
                {symbol.value}
              </button>
              <button
                type="button"
                aria-label={`حذف نماد ${symbol.value}`}
                onClick={() => {
                  const next = customSymbols.filter(item => item.value !== symbol.value);
                  setCustomSymbols(next);
                  localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(next));
                  if (displayValue === symbol.value) onChange('');
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function tradeMarket(symbol: string): string {
  if (symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY')) return 'Forex';
  return 'Other';
}

export default function NewTrade() {
  const [, setLocation] = useLocation();
  // FIX: در hash routing الکترون، query params باید مستقیماً از hash خوانده شوند
  // چون useElectronHashLocation اکنون فقط path را برمی‌گرداند (بدون query string)
  // تا Wouter بتواند route matching درستی انجام دهد
  const _searchStr = window.location.protocol === 'file:'
    ? (() => {
        const hash = window.location.hash.replace(/^#/, '');
        const qIdx = hash.indexOf('?');
        return qIdx >= 0 ? hash.slice(qIdx + 1) : '';
      })()
    : window.location.search;
  const searchParams = new URLSearchParams(_searchStr);
  const sessionId = searchParams.get('sessionId');
  const editId = searchParams.get('editId');
  const returnTo = searchParams.get('returnTo');
  // idFromUrl فقط برای بازیابی پیش‌نویس پس از رفرش صفحه استفاده می‌شود
  // اگر new=true باشد یا editId وجود داشته باشد، از آن صرف‌نظر می‌شود
  const isNewTrade = searchParams.get('new') === 'true';
  const idFromUrl = (isNewTrade || editId) ? null : searchParams.get('id');

  const [trade, setTrade] = useState<Trade | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [session, setSession] = useState<AnalysisSession | null>(null);
  const [linkedStrategy, setLinkedStrategy] = useState<Strategy | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tradingBoxes, setTradingBoxes] = useState<TradingBox[]>([]);
  const [customSetups, setCustomSetups] = useState<string[]>(getCustomSetups);
  const [customSetupInput, setCustomSetupInput] = useState('');
  // تایم‌فریم‌هایی که کاربر برای تحلیل چند تایم‌فریمی اضافه کرده (جدای از داده‌های ذخیره‌شده)
  const [addedMtfTimeframes, setAddedMtfTimeframes] = useState<MtfTimeframe[]>([]);
  // ورودی متن جداست تا مقدارهای میانی مثل «۰.» هنگام تایپ با رندر مجدد پاک نشوند.
  const [positionSizeInput, setPositionSizeInput] = useState('');
  const [riskPercentageInput, setRiskPercentageInput] = useState('');

  useEffect(() => {
    db.trades.toArray().then(setAllTrades);
    accountService.getAll().then(setAccounts);
    tradingBoxService.getAll().then(setTradingBoxes);
  }, []);

  // بررسی معامله تکراری
  useEffect(() => {
    if (!trade || !trade.symbol || !trade.entryPrice || !initialized.current) return;
    const check = async () => {
      const existing = await db.trades
        .where('symbol').equalsIgnoreCase(trade.symbol).toArray();
      const dup = existing.find(t =>
        t.id !== trade.id &&
        t.direction === trade.direction &&
        Math.abs(t.entryPrice - trade.entryPrice) < trade.entryPrice * 0.001 &&
        Math.abs(t.openedAt - trade.openedAt) < 60_000
      );
      if (dup) {
        setDuplicateWarning(`احتمال تکرار: معامله مشابهی در ${new Date(dup.openedAt).toLocaleDateString('fa-IR')} ثبت شده است.`);
      } else {
        setDuplicateWarning(null);
      }
    };
    const timer = setTimeout(check, 1000);
    return () => clearTimeout(timer);
  }, [trade?.symbol, trade?.direction, trade?.entryPrice, trade?.openedAt]);

  const tradeIdRef = useRef<string | null>(editId || idFromUrl || null);
  const lastSavedRef = useRef<Trade | null>(null);
  const initialized = useRef(false);
  // Tracks the last set of URL params we initialized for — re-init when they change
  const lastInitKey = useRef<string>('__unset__');
  const requestNavigation = useGuardedNavigation();

  useEffect(() => {
    // Build a key from the current URL params that identify which trade to open
    // Using editId|idFromUrl|sessionId so any change triggers a fresh load
    const currentKey = `${editId ?? ''}|${idFromUrl ?? ''}|${sessionId ?? ''}`;

    // Skip if we already initialized for this exact combination (prevents StrictMode double-run)
    if (lastInitKey.current === currentKey && initialized.current) return;
    lastInitKey.current = currentKey;

    // Reset state for fresh initialization
    initialized.current = false;
    tradeIdRef.current = editId || idFromUrl || null;
    lastSavedRef.current = null;
    setTrade(null);

    const init = async () => {
      if (initialized.current) return;
      initialized.current = true;

      const strats = await strategyService.getAllStrategies();
      setStrategies(strats);

      let currentTrade: Trade | null = null;

      const requestedTradeId = tradeIdRef.current;

      if (requestedTradeId) {
        const existing = await tradeService.getTradeById(requestedTradeId);
        if (existing) {
          currentTrade = existing;
        }
      } 
      
      if (!currentTrade) {
        // Never replace a missing edit/recovery target with a new blank trade.
        // That used to create an empty record when an editId was stale or the
        // IndexedDB read raced with navigation.
        if (requestedTradeId) {
          toast.error('معاملهٔ موردنظر پیدا نشد و معاملهٔ جدیدی ساخته نشد.');
          setLocation('/journal/trades');
          return;
        }

        currentTrade = await tradeService.createTrade({
          sessionId: sessionId || null
        });
        tradeIdRef.current = currentTrade.id;
        // Update URL so a page refresh reloads this draft (doesn't go through Wouter
        // to avoid a re-render loop; query string is only used for recovery on refresh)
        const newSearch = '?id=' + currentTrade.id + (sessionId ? `&sessionId=${sessionId}` : '');
        window.history.replaceState(null, '', window.location.pathname + newSearch);
        // Keep our init key in sync so Wouter re-renders don't re-trigger init
        lastInitKey.current = `|${currentTrade.id}|${sessionId ?? ''}`;
      }

      // Repair older drafts that were saved before market defaults existed.
      // A known symbol always wins; otherwise keep a valid stored market.
      const symbolMarket = TRADING_SYMBOLS.find(s => s.value === currentTrade!.symbol)?.market;
      if (!currentTrade.market && (symbolMarket || currentTrade.symbol)) {
        currentTrade = {
          ...currentTrade,
          market: symbolMarket ?? tradeMarket(currentTrade.symbol),
        };
        await tradeService.updateTrade(currentTrade.id, { market: currentTrade.market });
      }

      setTrade(currentTrade);
      setPositionSizeInput(
        currentTrade.positionSize != null && !POSITION_SIZE_OPTIONS.includes(currentTrade.positionSize)
          ? String(currentTrade.positionSize)
          : ''
      );
      setRiskPercentageInput(
        currentTrade.riskPercentage != null && !RISK_PERCENTAGE_OPTIONS.includes(currentTrade.riskPercentage)
          ? String(currentTrade.riskPercentage)
          : ''
      );
      lastSavedRef.current = currentTrade;

      const targetSessionId = currentTrade.sessionId || sessionId;
      if (targetSessionId) {
        const sess = await analysisService.getSessionById(targetSessionId);
        if (sess) {
          setSession(sess);
          const strat = await strategyService.getStrategyById(sess.strategyId);
          if (strat) setLinkedStrategy(strat);

          if (currentTrade.adherenceScore === null) {
            const score = await tradeService.computeAdherenceScore(sess.id);
            handleChange('adherenceScore', score);
          }
        }
      }
    };
    init();
  }, [editId, idFromUrl, sessionId]);

  const handleChange = useCallback((field: keyof Trade, value: any) => {
    setTrade(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const applyQuickTemplate = useCallback((template: typeof QUICK_TEMPLATES[number]) => {
    handleChange('direction', template.direction);
    handleChange('setupType' as any, template.setupType);
    handleChange('tradingSession' as any, template.tradingSession);
    handleChange('status', 'open');
    toast.success(`قالب «${template.label}» اعمال شد`);
  }, [handleChange]);

  const saveTrade = useCallback(async (dataToSave: Trade) => {
    if (!dataToSave.id) return;
    // Draft autosave may happen before the trigger is entered; the explicit
    // save action below enforces the required field without toast spam.
    if (dataToSave.setupType && !dataToSave.tradeTrigger?.trim()) return;
    setIsSaving(true);
    await tradeService.updateTrade(dataToSave.id, dataToSave);
    lastSavedRef.current = dataToSave;
    setIsSaving(false);
    setShowSavedIndicator(true);
    setTimeout(() => setShowSavedIndicator(false), 2000);
  }, []);

  useNavigationGuard({
    isDirty: Boolean(trade && JSON.stringify(trade) !== JSON.stringify(lastSavedRef.current)),
    onSave: async () => {
      if (trade) await saveTrade(trade);
    },
  });

  useEffect(() => {
    if (!trade || !initialized.current) return;
    const timer = setTimeout(() => {
      if (JSON.stringify(trade) !== JSON.stringify(lastSavedRef.current)) {
        saveTrade(trade);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [trade, saveTrade]);

  // اتودیتکت نتیجه بر اساس سود/زیان
  useEffect(() => {
    if (!trade || !initialized.current || trade.status !== 'closed') return;
    if (trade.profitLoss === null || trade.profitLoss === undefined) return;
    let autoResult: string;
    if (trade.profitLoss > 0) autoResult = 'win';
    else if (trade.profitLoss < 0) autoResult = 'loss';
    else autoResult = 'breakeven';
    if (trade.result !== autoResult) {
      handleChange('result', autoResult);
    }
  }, [trade?.profitLoss, trade?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // اگر سود/زیان وارد شده باشد، معامله پایان‌یافته است؛ این برای معاملات
  // قدیمی که دستی تکمیل می‌شوند هم همان رفتار ایمپورت را حفظ می‌کند.
  useEffect(() => {
    if (!trade || !initialized.current) return;
    if (typeof trade.profitLoss !== 'number' || !Number.isFinite(trade.profitLoss)) return;
    const result = trade.profitLoss > 0 ? 'win' : trade.profitLoss < 0 ? 'loss' : 'breakeven';
    if (trade.status !== 'closed' || trade.result !== result) {
      setTrade(prev => prev ? { ...prev, status: 'closed', result } : prev);
    }
  }, [trade?.profitLoss, trade?.status, trade?.result]);

  // باگ ۲: وقتی در حال ویرایش معامله هستیم، برگشت به صفحه جزئیات معامله می‌رود نه لیست
  const backUrl = returnTo || (editId ? `/journal/trades/${editId}` : '/journal/trades');

  const handleCancel = async () => {
    requestNavigation(backUrl);
  };

  const handleSaveAndView = useCallback(async () => {
    if (!trade) return;
    if (trade.setupType && !trade.tradeTrigger?.trim()) {
      toast.error('برای هر ستاپ، ثبت تریگر ورود الزامی است.');
      return;
    }
    await tradeService.updateTrade(trade.id, trade);
    const detailPath = returnTo
      ? `/journal/trades/${trade.id}?returnTo=${encodeURIComponent(returnTo)}`
      : `/journal/trades/${trade.id}`;
    setLocation(detailPath);
  }, [returnTo, setLocation, trade]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        void handleSaveAndView();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveAndView]);

  const handleDateChange = (field: 'openedAt' | 'closedAt', dateString: string) => {
    const timestamp = parseTradingDateTimeInput(dateString);
    if (Number.isNaN(timestamp)) return;
    handleChange(field, timestamp);

    // اگر سشن قبلی خالی یا خودکار بوده، با تغییر ساعت بازشدن آن را دوباره
    // محاسبه کن؛ سشن انتخاب‌شدهٔ دستی کاربر را بازنویسی نکن.
    if (field === 'openedAt' && trade) {
      const previousAutoSession = detectTradingSession(trade.openedAt);
      if (!trade.tradingSession || trade.tradingSession === previousAutoSession) {
        handleChange('tradingSession', detectTradingSession(timestamp));
      }
    }
  };

  const formatDateForInput = (timestamp: number | null) => {
    return getTradingDateTimeInput(timestamp);
  };

  const computeRMultiple = () => {
    if (!trade || trade.exitPrice === null || trade.exitPrice === undefined) return;
    const diff = Math.abs(trade.entryPrice - trade.stopLoss);
    if (diff === 0) return;

    let r = 0;
    if (trade.direction === 'long') {
      r = (trade.exitPrice - trade.entryPrice) / diff;
    } else {
      r = (trade.entryPrice - trade.exitPrice) / diff;
    }
    return r.toFixed(2);
  };

  const toggleEmotion = (emotionId: string) => {
    if (!trade) return;
    const currentEmotions = JSON.parse(trade.emotions || '[]') as string[];
    let updated;
    if (currentEmotions.includes(emotionId)) {
      updated = currentEmotions.filter(e => e !== emotionId);
    } else {
      updated = [...currentEmotions, emotionId];
    }
    handleChange('emotions', JSON.stringify(updated));
  };

  const currentEmotions = trade ? (JSON.parse(trade.emotions || '[]') as string[]) : [];
  const review = trade ? JSON.parse(trade.review || '{}') : {};
  const tags = trade ? JSON.parse(trade.tags || '[]') as string[] : [];
  const tradeScreenshots = trade ? (() => {
    try { return JSON.parse(trade.screenshots || '[]') as TradeScreenshot[]; }
    catch { return []; }
  })() : [];
  const mtf = trade ? (() => {
    try { return JSON.parse(trade.mtfAnalysis || 'null') || {}; }
    catch { return {}; }
  })() : {};
  const updateMtfScenario = (patch: Record<string, unknown>) => {
    const current = mtf.scenario || { status: '', condition: '', noTradeReason: '', invalidation: '' };
    handleChange('mtfAnalysis' as any, JSON.stringify({
      ...mtf,
      scenario: { ...current, ...patch },
    }));
  };
  // تایم‌فریم‌هایی که داده دارند یا کاربر آن‌ها را اضافه کرده، به ترتیب ثابت MTF_TIMEFRAMES
  const savedMtfTimeframes = MTF_TIMEFRAMES.filter(tf => {
    const d = mtf[tf];
    return d && (d.bias || d.structure || d.context || d.confirmation || d.importantLevels || d.screenshotId);
  });
  const activeMtfTimeframes = MTF_TIMEFRAMES.filter(
    tf => savedMtfTimeframes.includes(tf) || addedMtfTimeframes.includes(tf)
  );
  const removeMtfTimeframe = (tf: MtfTimeframe) => {
    const newMtf = { ...mtf };
    delete newMtf[tf];
    handleChange('mtfAnalysis' as any, JSON.stringify(newMtf));
    setAddedMtfTimeframes(prev => prev.filter(item => item !== tf));
  };
  const computedR = computeRMultiple();
  const netPnl = trade ? getTradeNetPnl(trade) : null;

  // استراتژی انتخاب‌شده در بخش «اطلاعات معامله» و ستاپ‌های مخصوص همان استراتژی.
  // این جداست از linkedStrategy که فقط وقتی معامله به یک جلسهٔ تحلیل وصل است پر می‌شود.
  const selectedStrategy = trade?.strategyId
    ? strategies.find(s => s.id === trade.strategyId) ?? null
    : null;
  const strategySetups: StrategySetupDefinition[] = selectedStrategy
    ? (() => {
        try { return JSON.parse(selectedStrategy.setupDefinitions || '[]') as StrategySetupDefinition[]; }
        catch { return []; }
      })()
    : [];

  if (!trade) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Initializing trade...</div>;
  }

  return (
    <div className="w-full min-w-0 max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 border-b pb-4 sticky top-0 bg-background/80 backdrop-blur z-10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => requestNavigation(backUrl)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{editId ? 'Edit Trade' : 'Log Trade'}</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className={`text-muted-foreground transition-opacity ${showSavedIndicator ? 'opacity-100' : 'opacity-0'}`}>
                Saved
              </span>
              {isSaving && <span className="text-muted-foreground animate-pulse">Saving...</span>}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          {/* Quick/Full toggle */}
          <div className="order-3 flex w-full min-w-0 rounded-lg border overflow-hidden sm:order-none sm:w-auto sm:flex-none">
            <Button
              variant={isQuickMode ? 'default' : 'ghost'}
              size="sm"
              className="min-w-0 flex-1 rounded-none gap-1.5 h-9 px-2 sm:flex-none sm:px-3"
              onClick={() => setIsQuickMode(true)}
            >
              <Zap className="w-3.5 h-3.5" /> سریع
            </Button>
            <Button
              variant={!isQuickMode ? 'default' : 'ghost'}
              size="sm"
              className="min-w-0 flex-1 rounded-none gap-1.5 h-9 px-2 sm:flex-none sm:px-3"
              onClick={() => setIsQuickMode(false)}
            >
              <BookOpen className="w-3.5 h-3.5" /> کامل
            </Button>
          </div>
          <Button className="order-1 flex-1 sm:order-none sm:flex-none" variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button className="order-2 flex-1 whitespace-nowrap sm:order-none sm:flex-none" onClick={handleSaveAndView}>
            <Eye className="w-4 h-4 mr-2" /> Save & View
          </Button>
        </div>
      </div>

      {isQuickMode && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Keyboard className="h-3.5 w-3.5" />
              <span>ثبت سریع: قالب را انتخاب کنید یا با</span>
              <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">Ctrl + Enter</kbd>
              <span>ذخیره کنید.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map(template => (
                <Button
                  key={template.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => applyQuickTemplate(template)}
                >
                  <Zap className="ml-1.5 h-3.5 w-3.5" />
                  {template.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* هشدار تکرار */}
      {duplicateWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{duplicateWarning}</span>
          <button onClick={() => setDuplicateWarning(null)} className="mr-auto shrink-0 hover:opacity-70">✕</button>
        </div>
      )}

      <div className="space-y-12">
        {/* SECTION 1: Trade Info */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">1. Trade Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>نماد معاملاتی (Symbol)</Label>
              <SymbolSelector
                value={trade.symbol}
                onChange={v => {
                  const symbol = v.toUpperCase();
                  handleChange('symbol', symbol);
                  // Keep the market in sync whenever the symbol changes,
                  // including when replacing an existing default symbol.
                  const found = TRADING_SYMBOLS.find(s => s.value === symbol);
                  handleChange('market', found?.market ?? tradeMarket(symbol));
                }}
              />
            </div>

            {/* پانل بینش پیش از معامله — بعد از ورود نماد ظاهر می‌شود */}
            {trade.symbol && trade.symbol.length >= 2 && (
              <div className="lg:col-span-3">
                <PreTradeInsightPanel
                  symbol={trade.symbol}
                  tags={tags}
                  allTrades={allTrades}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Market</Label>
              <Select value={trade.market || ''} onValueChange={v => handleChange('market', v)}>
                <SelectTrigger><SelectValue placeholder="Select Market" /></SelectTrigger>
                <SelectContent>
                  {MARKETS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>شماره تیکت متاتریدر</Label>
              <Input
                value={trade.ticketNumber ?? ''}
                onChange={e => handleChange('ticketNumber' as any, e.target.value || null)}
                placeholder="مثلاً 12345678"
                dir="ltr"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Direction</Label>
              <div className="flex gap-2">
                <Button 
                  variant={trade.direction === 'long' ? 'default' : 'outline'}
                  onClick={() => handleChange('direction', 'long')}
                  className={`flex-1 ${trade.direction === 'long' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50 hover:bg-emerald-500/30' : ''}`}
                >
                  Buy (Long)
                </Button>
                <Button 
                  variant={trade.direction === 'short' ? 'default' : 'outline'}
                  onClick={() => handleChange('direction', 'short')}
                  className={`flex-1 ${trade.direction === 'short' ? 'bg-rose-500/20 text-rose-500 border-rose-500/50 hover:bg-rose-500/30' : ''}`}
                >
                  Sell (Short)
                </Button>
              </div>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Status</Label>
              <div className="flex gap-2">
                {['open', 'closed', 'cancelled'].map(status => (
                  <Button 
                    key={status}
                    variant={trade.status === status ? 'default' : 'outline'}
                    onClick={() => handleChange('status', status)}
                    className="flex-1 capitalize"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label>Strategy</Label>
              <Select value={trade.strategyId || 'none'} onValueChange={v => handleChange('strategyId', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select Strategy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Strategy</SelectItem>
                  {strategies.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* حساب معاملاتی */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> حساب معاملاتی</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5" onClick={() => setLocation('/accounts')}>
                  <Plus className="w-3 h-3" /> مدیریت
                </Button>
              </div>
              <Select value={(trade as any).accountId || 'none'} onValueChange={v => handleChange('accountId' as any, v === 'none' ? null : v)}>
                <SelectTrigger dir="rtl" className="h-auto min-h-9 whitespace-normal [&>span]:!line-clamp-none [&>span]:!whitespace-normal">
                  <SelectValue placeholder="انتخاب حساب (اختیاری)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون حساب</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex min-w-0 items-center gap-2 whitespace-normal break-words text-right" dir="rtl">
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                        {a.name}{a.broker ? ` — ${a.broker}` : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* باکس معاملاتی */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> باکس معاملاتی</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5" onClick={() => setLocation('/trading-boxes')}>
                  <Plus className="w-3 h-3" /> مدیریت
                </Button>
              </div>
              <Select value={(trade as any).boxId || 'none'} onValueChange={v => handleChange('boxId' as any, v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب باکس (اختیاری)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون باکس</SelectItem>
                  {tradingBoxes
                    .filter(b => b.status === 'active' && (!(b as any).accountId || (b as any).accountId === (trade as any).accountId))
                    .map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                        {b.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ── سشن + ستاپ (بخش 1B) ── */}
        {!isQuickMode && (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">1B. سشن معاملاتی و ستاپ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>سشن معاملاتی</Label>
                <Select value={(trade as any).tradingSession || ''} onValueChange={v => handleChange('tradingSession' as any, v || null)}>
                  <SelectTrigger><SelectValue placeholder="انتخاب کنید…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="london">لندن</SelectItem>
                    <SelectItem value="new-york">نیویورک</SelectItem>
                    <SelectItem value="asia">آسیا</SelectItem>
                    <SelectItem value="overlap">اوورلپ</SelectItem>
                    <SelectItem value="other">سایر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ستاپ</Label>
                {selectedStrategy ? (
                  <>
                    <Select
                      value={(trade as any).setupType || ''}
                      onValueChange={v => handleChange('setupType' as any, v || null)}
                    >
                      <SelectTrigger><SelectValue placeholder={strategySetups.length ? 'انتخاب ستاپ این استراتژی…' : 'این استراتژی ستاپی ندارد'} /></SelectTrigger>
                      <SelectContent>
                        {strategySetups.map(setup => (
                          <SelectItem key={setup.id} value={setup.name}>{setup.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {strategySetups.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        برای استراتژی «{selectedStrategy.name}» هنوز ستاپی تعریف نشده.{' '}
                        <button type="button" className="text-primary hover:underline" onClick={() => setLocation(`/strategies/${selectedStrategy.id}`)}>
                          افزودن ستاپ
                        </button>
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Select value={(trade as any).setupType || ''} onValueChange={v => handleChange('setupType' as any, v || null)}>
                      <SelectTrigger><SelectValue placeholder="انتخاب کنید…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="break-and-retest">Break and Retest</SelectItem>
                        <SelectItem value="fvg">FVG (Fair Value Gap)</SelectItem>
                        <SelectItem value="liquidity-grab">Liquidity Grab</SelectItem>
                        <SelectItem value="order-block">Order Block</SelectItem>
                        <SelectItem value="trend-continuation">Trend Continuation</SelectItem>
                        <SelectItem value="reversal">Reversal</SelectItem>
                        <SelectItem value="support-resistance">حمایت/مقاومت</SelectItem>
                        <SelectItem value="other">سایر</SelectItem>
                        {customSetups.map(setup => (
                          <SelectItem key={setup} value={setup}>{setup}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">با انتخاب یک استراتژی در بخش «اطلاعات معامله»، ستاپ‌های همان استراتژی اینجا نمایش داده می‌شوند.</p>
                    <div className="flex gap-2">
                      <Input
                        value={customSetupInput}
                        onChange={e => setCustomSetupInput(e.target.value)}
                        placeholder="ستاپ سفارشی جدید…"
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        disabled={!customSetupInput.trim()}
                        onClick={() => {
                          const setup = customSetupInput.trim();
                          if (!setup) return;
                          const next = [...customSetups.filter(item => item !== setup), setup];
                          setCustomSetups(next);
                          localStorage.setItem(CUSTOM_SETUPS_KEY, JSON.stringify(next));
                          handleChange('setupType' as any, setup);
                          setCustomSetupInput('');
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> افزودن
                      </Button>
                    </div>
                    {customSetups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {customSetups.map(setup => (
                          <span key={setup} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                            {setup}
                            <button
                              type="button"
                              aria-label={`حذف ستاپ ${setup}`}
                              onClick={() => {
                                const next = customSetups.filter(item => item !== setup);
                                setCustomSetups(next);
                                localStorage.setItem(CUSTOM_SETUPS_KEY, JSON.stringify(next));
                                if ((trade as any).setupType === setup) handleChange('setupType' as any, null);
                              }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: Multi-Timeframe Analysis — این بخش مربوط به قبل از ورود به معامله است */}
        {!isQuickMode && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">2. تحلیل چند تایم‌فریمی و سناریوها</h2>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">افزودن تایم‌فریم:</span>
              {MTF_TIMEFRAMES.filter(tf => !activeMtfTimeframes.includes(tf)).map(tf => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setAddedMtfTimeframes(prev => [...prev, tf])}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/5"
                >
                  <Plus className="h-3 w-3" /> {tf}
                </button>
              ))}
              {MTF_TIMEFRAMES.every(tf => activeMtfTimeframes.includes(tf)) && (
                <span className="text-xs text-muted-foreground">همهٔ تایم‌فریم‌ها اضافه شده‌اند</span>
              )}
            </div>

            {activeMtfTimeframes.length === 0 && (
              <p className="text-sm text-muted-foreground">تایم‌فریمی انتخاب نشده. برای شروع تحلیل، یک تایم‌فریم از بالا اضافه کنید.</p>
            )}

            {activeMtfTimeframes.map(tf => {
              const tfData = mtf[tf] || {};
              const update = (field: string, value: string) => {
                const newMtf = { ...mtf, [tf]: { ...tfData, [field]: value } };
                handleChange('mtfAnalysis' as any, JSON.stringify(newMtf));
              };
              return (
                <Card key={tf} className="bg-muted/10">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{tf}</div>
                      <button
                        type="button"
                        aria-label={`حذف تایم‌فریم ${tf}`}
                        onClick={() => removeMtfTimeframe(tf)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">اسکرین‌شات مستقل این تایم‌فریم</Label>
                        <select
                          value={tfData.screenshotId || ''}
                          onChange={e => update('screenshotId', e.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="">بدون اسکرین‌شات</option>
                          {tradeScreenshots.map(ss => (
                            <option key={ss.id} value={ss.id}>
                              {ss.label || 'تصویر'}{ss.timeframe ? ` — ${ss.timeframe}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">بایاس / جهت</Label>
                        <Input value={tfData.bias || ''} onChange={e => update('bias', e.target.value)} placeholder="صعودی / نزولی / خنثی" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ساختار بازار</Label>
                        <Input value={tfData.structure || ''} onChange={e => update('structure', e.target.value)} placeholder="HH/HL، LL/LH" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">زمینه و یادداشت</Label>
                        <StableTextarea value={tfData.context || ''} onChange={e => update('context', e.target.value)} placeholder={`زمینه و تحلیل ${tf} را وارد کنید…`} className="min-h-[60px] text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">تأییدیه</Label>
                        <Input value={tfData.confirmation || ''} onChange={e => update('confirmation', e.target.value)} placeholder="چه چیزی تأیید شد؟" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">سطوح مهم</Label>
                        <Input value={tfData.importantLevels || ''} onChange={e => update('importantLevels', e.target.value)} placeholder="سطوح قیمت…" className="h-8 text-sm" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Card className="border-amber-500/25 bg-amber-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="font-semibold text-sm">تصمیم سناریو</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">وضعیت سناریو</Label>
                    <select
                      value={mtf.scenario?.status || ''}
                      onChange={e => updateMtfScenario({ status: e.target.value as any })}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">انتخاب کنید…</option>
                      <option value="liquidity-hunt">لو‌هانت / جمع‌آوری نقدینگی</option>
                      <option value="confirmation">تأییدیه دریافت شد</option>
                      <option value="scenario-failed">سناریو شکست خورد</option>
                      <option value="no-trade">وارد نشدم</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">شرط فعال شدن سناریو</Label>
                    <Input value={mtf.scenario?.condition || ''} onChange={e => updateMtfScenario({ condition: e.target.value })} placeholder="اگر قیمت/ساختار به این شرط رسید…" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">{mtf.scenario?.status === 'no-trade' ? 'دلیل وارد نشدن' : 'توضیح سناریو و نتیجه'}</Label>
                    <StableTextarea
                      value={mtf.scenario?.noTradeReason || ''}
                      onChange={e => updateMtfScenario({ noTradeReason: e.target.value })}
                      placeholder={mtf.scenario?.status === 'no-trade' ? 'چه چیزی مانع ورود شد؟' : 'چه اتفاقی برای سناریو افتاد؟'}
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">شرط ابطال</Label>
                    <Input value={mtf.scenario?.invalidation || ''} onChange={e => updateMtfScenario({ invalidation: e.target.value })} placeholder="در چه شرایطی تحلیل دیگر معتبر نیست؟" className="h-8 text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* SECTION 3: Entry Details */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">3. Entry Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label>Opened At</Label>
              <Input 
                type="datetime-local" 
                value={formatDateForInput(trade.openedAt)}
                onChange={e => handleDateChange('openedAt', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Entry Price</Label>
              <NumericInput value={trade.entryPrice} onValueChange={value => handleChange('entryPrice', value ?? 0)} />
            </div>
            <div className="space-y-2">
              <Label>Stop Loss</Label>
              <NumericInput value={trade.stopLoss} onValueChange={value => handleChange('stopLoss', value ?? 0)} />
            </div>
            <div className="space-y-2">
              <Label>Take Profit</Label>
              <NumericInput value={trade.takeProfit} onValueChange={value => handleChange('takeProfit', value)} />
            </div>
          </div>
        </section>

        {/* ── دلیل ورود ── */}
        <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">3B. دلیل ورود</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>دلیل ورود به معامله</Label>
                <VoiceInputButton onText={text => handleChange('entryReason' as any, `${(trade as any).entryReason || ''}${(trade as any).entryReason ? ' ' : ''}${text}`)} />
              </div>
              <StableTextarea
                placeholder="چرا وارد این معامله شدید؟ چه چیزی را در چارت دیدید؟ ستاپ چه بود؟"
                value={(trade as any).entryReason || ''}
                onChange={e => handleChange('entryReason' as any, e.target.value || null)}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label>تریگر ورود <span className="text-destructive">*</span></Label>
              <StableTextarea
                value={trade.tradeTrigger || ''}
                onChange={e => handleChange('tradeTrigger', e.target.value || null)}
                placeholder="شرط مشخصی که ورود را فعال کرد؛ مثلاً sweep + confirmation"
                className="min-h-[80px]"
              />
              {trade.setupType && !trade.tradeTrigger?.trim() && (
                <p className="text-xs text-destructive">برای ذخیره‌ی معامله‌ای که ستاپ دارد، تریگر را وارد کنید.</p>
              )}
            </div>
        </section>

        {/* SECTION 4: Exit Details */}
        {trade.status === 'closed' && (
          <section className="space-y-6 animate-in slide-in-from-bottom-4">
            <h2 className="text-lg font-semibold border-b pb-2">4. Exit Details</h2>
            
            <div className="space-y-2">
              <Label>Result</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'win', l: 'Win', c: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' },
                  { v: 'loss', l: 'Loss', c: 'bg-rose-500/20 text-rose-500 border-rose-500/50' },
                  { v: 'breakeven', l: 'Break Even', c: 'bg-slate-500/20 text-slate-500 border-slate-500/50' },
                  { v: 'partial-win', l: 'Partial Win', c: 'bg-teal-500/20 text-teal-500 border-teal-500/50' },
                  { v: 'partial-loss', l: 'Partial Loss', c: 'bg-amber-500/20 text-amber-500 border-amber-500/50' }
                ].map(res => (
                  <Button
                    key={res.v}
                    variant={trade.result === res.v ? 'default' : 'outline'}
                    onClick={() => handleChange('result', res.v)}
                    className={trade.result === res.v ? res.c : ''}
                  >
                    {res.l}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label>Closed At</Label>
                <Input 
                  type="datetime-local" 
                  value={formatDateForInput(trade.closedAt)}
                  onChange={e => handleDateChange('closedAt', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Exit Price</Label>
                <NumericInput value={trade.exitPrice} onValueChange={value => handleChange('exitPrice', value)} />
              </div>
              <div className="space-y-2">
                <Label>P&L ناخالص</Label>
                <NumericInput value={trade.profitLoss} onValueChange={value => handleChange('profitLoss', value)} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>R Multiple</Label>
                  {computedR && <span className="text-xs text-muted-foreground">Auto: {computedR}R</span>}
                </div>
                <NumericInput value={trade.rMultiple} onValueChange={value => handleChange('rMultiple', value)} />
              </div>
              <div className="space-y-2">
                <Label>هزینه‌های دیگر</Label>
                <NumericInput value={trade.fees} onValueChange={value => handleChange('fees', value)} />
              </div>
              <div className="space-y-2">
                <Label>کمیسیون</Label>
                <NumericInput value={trade.commission} onValueChange={value => handleChange('commission' as any, value)} />
              </div>
              <div className="space-y-2">
                <Label>اسپرد</Label>
                <NumericInput value={trade.spread} onValueChange={value => handleChange('spread' as any, value)} />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label>Reason for Exit</Label>
                <Input value={trade.reasonForExit || ''} onChange={e => handleChange('reasonForExit', e.target.value)} placeholder="Hit target, trailed stop, etc." />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <span className="text-muted-foreground">سود/زیان خالص پس از هزینه‌ها</span>
              <strong className={netPnl !== null && netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                {netPnl !== null ? `${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)}` : '—'}
              </strong>
            </div>
          </section>
        )}

        {/* ── مدیریت معامله ── */}
        {!isQuickMode && trade.status === 'closed' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">4B. مدیریت معامله</h2>
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'slMoved',         label: 'جابجایی حد ضرر' },
                { key: 'tpMoved',         label: 'جابجایی حد سود' },
                { key: 'partialClose',    label: 'بستن بخشی از پوزیشن' },
                { key: 'addedToPosition', label: 'افزودن به پوزیشن' },
                { key: 'reducedPosition', label: 'کاهش پوزیشن' },
                { key: 'manualExit',      label: 'خروج دستی' },
              ].map(item => {
                const val = (trade as any)[item.key];
                return (
                  <button key={item.key}
                    onClick={() => handleChange(item.key as any, val === true ? false : val === false ? null : true)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-right transition-colors ${
                      val === true ? 'border-primary bg-primary/10 text-primary' :
                      val === false ? 'border-muted-foreground/30 text-muted-foreground/50' :
                      'border-border hover:border-primary/40'
                    }`}>
                    {val === true ? <CheckSquare className="w-4 h-4 shrink-0" /> :
                     val === false ? <Square className="w-4 h-4 shrink-0 opacity-40" /> :
                     <Square className="w-4 h-4 shrink-0" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label>توضیح تصمیمات مدیریت</Label>
              <StableTextarea
                placeholder="چرا حد ضرر را جابجا کردید؟ دلیل خروج زودهنگام چه بود؟"
                value={(trade as any).managementReason || ''}
                onChange={e => handleChange('managementReason' as any, e.target.value || null)}
                className="min-h-[80px]"
                voice
              />
            </div>
          </section>
        )}

        {/* SECTION 5: Strategy Adherence — فارسی */}
        {(trade.sessionId || sessionId) && (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">5. Strategy Adherence</h2>
            
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Linked Session</div>
                    <div className="font-semibold">{linkedStrategy?.name || 'استراتژی نامشخص'}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setLocation(`/analysis/${trade.sessionId || sessionId}`)}>
                  مشاهده جلسه تحلیل
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>امتیاز پایبندی به استراتژی</span>
                      <span className="font-bold">{trade.adherenceScore ?? 0}%</span>
                    </div>
                    <Progress value={trade.adherenceScore ?? 0} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>تا چه اندازه قوانین استراتژی را رعایت کردی؟</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { v: 'fully', l: 'کاملاً رعایت شد', c: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' },
                        { v: 'mostly', l: 'بیشتر قوانین رعایت شد', c: 'bg-teal-500/20 text-teal-500 border-teal-500/50' },
                        { v: 'partially', l: 'بخشی از قوانین رعایت شد', c: 'bg-amber-500/20 text-amber-500 border-amber-500/50' },
                        { v: 'not', l: 'رعایت نشد', c: 'bg-rose-500/20 text-rose-500 border-rose-500/50' }
                      ].map(rating => (
                        <Button
                          key={rating.v}
                          variant={trade.adherenceRating === rating.v ? 'default' : 'outline'}
                          onClick={() => handleChange('adherenceRating', rating.v)}
                          className={trade.adherenceRating === rating.v ? rating.c : ''}
                        >
                          {rating.l}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>یادداشت پایبندی</Label>
                    <StableTextarea
                      placeholder="اگر از قوانین فاصله گرفتی، دلیل آن را بنویس…"
                      value={trade.adherenceNotes || ''}
                      onChange={e => handleChange('adherenceNotes', e.target.value)}
                      voice
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* SECTION 6: Emotions — به فارسی */}
        {!isQuickMode && (<section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">۶. وضعیت احساسی</h2>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map(emo => {
              const isSelected = currentEmotions.includes(emo.id);
              return (
                <button
                  key={emo.id}
                  onClick={() => toggleEmotion(emo.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isSelected 
                      ? `${emo.color} text-white shadow-md scale-105` 
                      : `bg-muted/50 text-muted-foreground hover:bg-muted border border-border`
                  }`}
                >
                  {emo.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label>یادداشت احساسی</Label>
            <Textarea 
              placeholder="در طول این معامله چه احساسی داشتید؟"
              value={trade.emotionNotes || ''}
              onChange={e => handleChange('emotionNotes', e.target.value)}
            />
          </div>
        </section>)}

        {/* SECTION 7: Screenshots */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">۷. اسکرین‌شات‌ها</h2>
          <ScreenshotManager
            trade={trade}
            allTrades={allTrades}
            onChange={screenshots => handleChange('screenshots', JSON.stringify(screenshots))}
          />
        </section>

        {/* SECTION 8: Review */}
        {!isQuickMode && trade.status === 'closed' && (
          <section className="space-y-6 animate-in slide-in-from-bottom-4">
            <h2 className="text-lg font-semibold border-b pb-2">8. Trade Review</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>What did I do well?</Label>
                <StableTextarea
                  value={review.didWell || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, didWell: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>What did I do wrong?</Label>
                <StableTextarea
                  value={review.didWrong || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, didWrong: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>What did I learn?</Label>
                <StableTextarea
                  value={review.learned || ''} 
                  onChange={e => handleChange('review', JSON.stringify({ ...review, learned: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Would I take this trade again?</Label>
                <div className="flex gap-2">
                  {['yes', 'no', 'maybe'].map(val => (
                    <Button
                      key={val}
                      variant={review.wouldTakeAgain === val ? 'default' : 'outline'}
                      onClick={() => handleChange('review', JSON.stringify({ ...review, wouldTakeAgain: val }))}
                      className="flex-1 capitalize"
                    >
                      {val}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Was this a valid setup?</Label>
                <div className="flex gap-2">
                  {['yes', 'no', 'unclear'].map(val => (
                    <Button
                      key={val}
                      variant={review.validSetup === val ? 'default' : 'outline'}
                      onClick={() => handleChange('review', JSON.stringify({ ...review, validSetup: val }))}
                      className="flex-1 capitalize"
                    >
                      {val}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 9: Notes & Tags */}
        {!isQuickMode && (<section className="space-y-6">
          <h2 className="text-lg font-semibold border-b pb-2">9. Notes & Tags</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input 
                placeholder="Press Enter to add tags (e.g., trend-following, fvg, overtrading)" 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val && !tags.includes(val)) {
                      handleChange('tags', JSON.stringify([...tags, val]));
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <span key={tag} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm flex items-center gap-1">
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-primary/70" 
                      onClick={() => handleChange('tags', JSON.stringify(tags.filter(t => t !== tag)))} 
                    />
                  </span>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>درس معامله</Label>
              <StableTextarea
                placeholder="از این معامله چه یاد گرفتید؟ چه نکته‌ای برای آینده دارد؟"
                value={(trade as any).lesson || ''}
                onChange={e => handleChange('lesson' as any, e.target.value || null)}
                className="min-h-[80px]"
                voice
              />
            </div>
            <div className="space-y-2">
              <Label>General Notes</Label>
              <StableTextarea
                placeholder="Any additional thoughts on this trade..."
                value={trade.notes || ''}
                onChange={e => handleChange('notes', e.target.value)}
                className="min-h-[120px]"
                voice
              />
            </div>
          </div>
        </section>)}

      </div>

    </div>
  );
}
