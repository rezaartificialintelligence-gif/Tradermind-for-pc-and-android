import { useState, useEffect } from 'react';
import { accountService } from '../services/accountService';
import { tradingBoxService } from '../services/tradingBoxService';
import { Account, TradingBox } from '../db/database';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Card, CardContent } from '../components/ui/card';
import { Plus, Pencil, Trash2, Wallet, Star } from 'lucide-react';
import { toast } from 'sonner';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'IRR', 'USDT'];
const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#ef4444'];

const emptyForm = {
  name: '',
  broker: '',
  currency: 'USD',
  initialBalance: '',
  currentBalance: '',
  color: '#3b82f6',
  isDefault: false,
  notes: '',
  boxIds: [] as string[],
};

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [boxes, setBoxes] = useState<TradingBox[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = async () => {
    const [nextAccounts, nextBoxes] = await Promise.all([
      accountService.getAll(),
      tradingBoxService.getAll(),
    ]);
    setAccounts(nextAccounts);
    setBoxes(nextBoxes);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditingId(acc.id);
    setForm({
      name: acc.name,
      broker: acc.broker,
      currency: acc.currency,
      initialBalance: acc.initialBalance?.toString() ?? '',
      currentBalance: acc.currentBalance?.toString() ?? '',
      color: acc.color,
      isDefault: acc.isDefault,
      notes: acc.notes ?? '',
      boxIds: boxes.filter(box => box.accountId === acc.id).map(box => box.id),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('نام حساب الزامی است');
      return;
    }
    setSaving(true);
    const data = {
      name: form.name.trim(),
      broker: form.broker.trim(),
      currency: form.currency,
      initialBalance: form.initialBalance ? parseFloat(form.initialBalance) : null,
      currentBalance: form.currentBalance ? parseFloat(form.currentBalance) : null,
      color: form.color,
      isDefault: form.isDefault,
      notes: form.notes.trim() || null,
    };
    try {
      let savedAccountId = editingId;
      if (editingId) {
        await accountService.update(editingId, data);
        toast.success('حساب به‌روز شد');
      } else {
        const created = await accountService.create(data);
        savedAccountId = created.id;
        toast.success('حساب جدید اضافه شد');
      }
      if (savedAccountId) {
        const affectedBoxes = boxes.filter(box =>
          box.accountId === savedAccountId || form.boxIds.includes(box.id)
        );
        await Promise.all(affectedBoxes.map(box =>
          tradingBoxService.update(box.id, {
            accountId: form.boxIds.includes(box.id) ? savedAccountId : null,
          })
        ));
      }
      await load();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await Promise.all(
      boxes.filter(box => box.accountId === id).map(box =>
        tradingBoxService.update(box.id, { accountId: null })
      )
    );
    await accountService.delete(id);
    toast.success('حساب حذف شد');
    await load();
    setDeleteConfirm(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">حساب‌های معاملاتی</h1>
          <p className="text-sm text-muted-foreground mt-1">معاملات هر حساب را جداگانه ثبت و تحلیل کنید</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> حساب جدید
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Wallet className="w-10 h-10 opacity-30" />
            <p>هنوز حسابی تعریف نشده</p>
            <Button variant="outline" onClick={openNew} className="gap-2">
              <Plus className="w-4 h-4" /> اولین حساب را بسازید
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map(acc => (
            <Card key={acc.id} className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: acc.color }} />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Wallet className="w-5 h-5 shrink-0" style={{ color: acc.color }} />
                    <div className="min-w-0 flex-1" dir="rtl">
                      <div className="font-semibold whitespace-normal break-words leading-6 flex items-center gap-1.5">
                        {acc.name}
                        {acc.isDefault && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                      </div>
                      {acc.broker && <div className="text-xs text-muted-foreground whitespace-normal break-words leading-5">{acc.broker}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(acc.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {boxes.filter(box => box.accountId === acc.id).map(box => (
                    <span key={box.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: box.color }} />
                      {box.name}
                    </span>
                  ))}
                  {boxes.every(box => box.accountId !== acc.id) && (
                    <span className="text-xs text-muted-foreground">باکسی متصل نشده</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">ارز: </span>
                    <span className="font-medium">{acc.currency}</span>
                  </div>
                  {acc.currentBalance != null && (
                    <div>
                      <span className="text-muted-foreground">موجودی: </span>
                      <span className="font-medium">{acc.currentBalance.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                {acc.notes && <p className="text-xs text-muted-foreground line-clamp-2">{acc.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog ساخت/ویرایش */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'ویرایش حساب' : 'حساب جدید'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>نام حساب *</Label>
              <Input placeholder="مثلاً حساب اصلی" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>بروکر</Label>
              <Input placeholder="نام بروکر (اختیاری)" value={form.broker} onChange={e => setForm(f => ({ ...f, broker: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>ارز</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>رنگ</Label>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="w-6 h-6 rounded-full border-2 transition-transform"
                      style={{ backgroundColor: c, borderColor: form.color === c ? 'white' : 'transparent', transform: form.color === c ? 'scale(1.2)' : 'scale(1)' }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>موجودی اولیه</Label>
                <Input type="number" placeholder="0" value={form.initialBalance} onChange={e => setForm(f => ({ ...f, initialBalance: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>موجودی فعلی</Label>
                <Input type="number" placeholder="0" value={form.currentBalance} onChange={e => setForm(f => ({ ...f, currentBalance: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>یادداشت</Label>
              <Textarea placeholder="توضیحات اضافی…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="min-h-[70px]" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>باکس‌های این حساب</Label>
                <span className="text-xs text-muted-foreground">چند انتخابی</span>
              </div>
              {boxes.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  هنوز باکسی ساخته نشده؛ بعداً هم می‌توانید از صفحهٔ باکس‌ها آن را به این حساب متصل کنید.
                </p>
              ) : (
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {boxes.map(box => (
                    <label key={box.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={form.boxIds.includes(box.id)}
                        onChange={event => setForm(current => ({
                          ...current,
                          boxIds: event.target.checked
                            ? [...current.boxIds, box.id]
                            : current.boxIds.filter(id => id !== box.id),
                        }))}
                      />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: box.color }} />
                      <span className="truncate">{box.name}</span>
                      {box.accountId && box.accountId !== editingId && (
                        <span className="mr-auto text-[10px] text-amber-500">متصل به حساب دیگر</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="rounded" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} />
              <span className="text-sm">حساب پیش‌فرض</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>لغو</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'ذخیره…' : 'ذخیره'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>حذف حساب</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">آیا مطمئنید؟ معاملات مرتبط تغییری نمی‌کنند ولی حساب پاک می‌شود.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>لغو</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
