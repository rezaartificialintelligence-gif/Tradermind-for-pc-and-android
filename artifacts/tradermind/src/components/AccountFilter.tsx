/**
 * AccountFilter.tsx — فیلتر مشترک «حساب معاملاتی» برای صفحات گزارش/داشبورد/تحلیل.
 *
 * استفاده:
 *   const { accounts, selectedAccountId, setSelectedAccountId, filterByAccount } = useAccountFilter();
 *   const trades = useMemo(() => filterByAccount(allTrades), [allTrades, selectedAccountId]);
 *   ...
 *   <AccountFilter
 *     accounts={accounts}
 *     selectedAccountId={selectedAccountId}
 *     onChange={setSelectedAccountId}
 *   />
 *
 * انتخاب کاربر در localStorage ذخیره می‌شود تا هنگام رفتن بین صفحات گزارش، فیلتر یکسان بماند.
 */
import { useCallback, useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { accountService } from '../services/accountService';
import type { Account } from '../db/database';

const STORAGE_KEY = 'tradermind-reports-account-filter';

export function useAccountFilter() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });

  useEffect(() => {
    accountService.getAll().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  // اگر حساب انتخاب‌شده دیگر وجود نداشته باشد (مثلاً حذف شده)، فیلتر را پاک می‌کنیم.
  useEffect(() => {
    if (selectedAccountId && accounts.length > 0 && !accounts.some(a => a.id === selectedAccountId)) {
      setSelectedAccountIdState(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  }, [accounts, selectedAccountId]);

  const setSelectedAccountId = useCallback((id: string | null) => {
    setSelectedAccountIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  const filterByAccount = useCallback(<T extends { accountId?: string | null }>(items: T[]): T[] => {
    if (!selectedAccountId) return items;
    return items.filter(item => item.accountId === selectedAccountId);
  }, [selectedAccountId]);

  return { accounts, selectedAccountId, setSelectedAccountId, filterByAccount };
}

export function AccountFilter({
  accounts,
  selectedAccountId,
  onChange,
  className = '',
}: {
  accounts: Account[];
  selectedAccountId: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  if (accounts.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`} dir="rtl">
      <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
      <select
        value={selectedAccountId ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition min-w-0"
        aria-label="فیلتر بر اساس حساب معاملاتی"
      >
        <option value="">همهٔ حساب‌ها</option>
        {accounts.map(acc => (
          <option key={acc.id} value={acc.id}>{acc.name}</option>
        ))}
      </select>
    </div>
  );
}
