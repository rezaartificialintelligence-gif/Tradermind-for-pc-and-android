import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, type ColorTheme, type TextColor, type RadiusScale } from '../store/useAppStore';

// 'custom' از customAccentColor خوانده می‌شود؛ مقدار پیش‌فرض فقط fallback است.
const COLOR_THEMES: Record<ColorTheme, string> = {
  blue: '#3b82f6',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  teal: '#14b8a6',
  crimson: '#dc2626',
  custom: '#3b82f6',
};

// مقادیر rem برای هر سطح از گردی گوشه‌ها — از تیز کاملاً حرفه‌ای تا خیلی نرم
const RADIUS_SCALE: Record<RadiusScale, string> = {
  none: '0rem',
  sm: '0.375rem',
  md: '0.75rem',
  lg: '1.05rem',
  xl: '1.5rem',
};

function hexToHsl(hex: string): string | null {
  const value = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getContrastForeground(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '226 21% 10%' : '0 0% 100%';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // PART 8 / Prompt 3 — selector برای جلوگیری از re-render غیرضروری
  const { theme, fontSize, colorTheme, customAccentColor, textColor, radius, density, sidebarStyle, language } = useAppStore(
    useShallow(s => ({
      theme: s.theme,
      fontSize: s.fontSize,
      colorTheme: s.colorTheme,
      customAccentColor: s.customAccentColor,
      textColor: s.textColor,
      radius: s.radius,
      density: s.density,
      sidebarStyle: s.sidebarStyle,
      language: s.language,
    }))
  );

  // ── حالت نمایش (روشن / تاریک / سیستم)
  React.useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (resolved: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
    };
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    applyTheme(theme as 'light' | 'dark');
    return undefined;
  }, [theme]);

  // ── اندازه متن
  React.useEffect(() => {
    window.document.documentElement.setAttribute('data-font-size', fontSize ?? 'md');
  }, [fontSize]);

  React.useEffect(() => {
    const root = window.document.documentElement;
    const accentHex = colorTheme === 'custom'
      ? (/^#[0-9a-f]{6}$/i.test(customAccentColor) ? customAccentColor : COLOR_THEMES.custom)
      : (COLOR_THEMES[colorTheme] ?? COLOR_THEMES.blue);
    const primary = hexToHsl(accentHex);
    if (primary) {
      root.style.setProperty('--primary', primary);
      root.style.setProperty('--ring', primary);
      root.style.setProperty('--chart-1', primary);
      root.style.setProperty('--sidebar-primary', primary);
      root.style.setProperty('--sidebar-ring', primary);
      root.style.setProperty('--primary-foreground', getContrastForeground(accentHex));
      root.style.setProperty('--sidebar-primary-foreground', getContrastForeground(accentHex));
    }

    const customText = textColor !== 'auto' ? hexToHsl(textColor) : null;
    if (customText) {
      root.style.setProperty('--foreground', customText);
      root.style.setProperty('--card-foreground', customText);
      root.style.setProperty('--popover-foreground', customText);
      root.style.setProperty('--sidebar-foreground', customText);
    } else {
      ['--foreground', '--card-foreground', '--popover-foreground', '--sidebar-foreground']
        .forEach(name => root.style.removeProperty(name));
    }
  }, [colorTheme, customAccentColor, textColor]);

  // ── شعاع گوشه‌ها (تیز → خیلی گرد)
  React.useEffect(() => {
    window.document.documentElement.style.setProperty('--radius', RADIUS_SCALE[radius] ?? RADIUS_SCALE.md);
  }, [radius]);

  // ── تراکم چیدمان (فشرده / معمولی / راحت)
  React.useEffect(() => {
    window.document.documentElement.setAttribute('data-density', density ?? 'comfortable');
  }, [density]);

  // ── ظاهر پس‌زمینه سایدبار (ساده / شیشه‌ای / گرادیانت)
  React.useEffect(() => {
    window.document.documentElement.setAttribute('data-sidebar-style', sidebarStyle ?? 'solid');
  }, [sidebarStyle]);

  // ── جهت‌نویسی و زبان (RTL/LTR)
  React.useEffect(() => {
    const root = window.document.documentElement;
    const isRtl = language === 'fa';
    root.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    root.setAttribute('lang', language);
  }, [language]);

  return <>{children}</>;
}
