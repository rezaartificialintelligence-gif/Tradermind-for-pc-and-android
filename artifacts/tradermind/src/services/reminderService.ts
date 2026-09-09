import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface Reminder {
  id: string;
  title: string;
  body: string;
  scheduledAt: number;
  enabled: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'tradermind-reminders';
const CHANNEL_ID = 'tradermind-reminders';
const browserTimers = new Map<string, ReturnType<typeof setTimeout>>();

function read(): Reminder[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(reminders: Reminder[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

function notificationId(id: string): number {
  let hash = 0;
  for (const char of id) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash) || 1;
}

async function ensureNativePermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'یادآورهای TraderMind',
    description: 'اعلان‌های زمان‌بندی‌شده TraderMind',
    importance: 5,
    visibility: 1,
  }).catch(() => undefined);
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;
  const requested = await LocalNotifications.requestPermissions();
  return requested.display === 'granted';
}

async function showBrowserNotification(reminder: Reminder): Promise<void> {
  if (!('Notification' in window)) return;
  try {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') return;

    // بعضی نسخه‌های Chrome روی Android و محیط‌های embedded سازنده‌ی
    // Notification را ندارند و `new Notification()` خطای Illegal constructor
    // می‌دهد. Service Worker روش استاندارد و سازگار برای اعلان وب موبایل است.
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (typeof registration.showNotification === 'function') {
        await registration.showNotification(reminder.title, {
          body: reminder.body || 'یادآور TraderMind',
          tag: `tradermind-reminder-${reminder.id}`,
          dir: 'rtl',
          lang: 'fa',
        });
      }
      return;
    }
  } catch (error) {
    // شکست اعلان نباید رابط کاربری یا زمان‌بندی‌های دیگر را از کار بیندازد.
    console.warn('[TraderMind reminders] Browser notification unavailable', error);
  }
}

function scheduleBrowserTimer(reminder: Reminder): void {
  const remaining = reminder.scheduledAt - Date.now();
  if (remaining <= 0) {
    void showBrowserNotification(reminder);
    browserTimers.delete(reminder.id);
    return;
  }
  const maxDelay = 2_147_483_647;
  browserTimers.set(reminder.id, setTimeout(() => {
    scheduleBrowserTimer(reminder);
  }, Math.min(remaining, maxDelay)));
}

export async function scheduleReminder(reminder: Reminder): Promise<boolean> {
  if (reminder.scheduledAt <= Date.now()) return false;
  await cancelScheduledReminder(reminder.id);

  if (Capacitor.isNativePlatform()) {
    if (!(await ensureNativePermission())) return false;
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(reminder.id),
        title: reminder.title,
        body: reminder.body || 'یادآور TraderMind',
        schedule: { at: new Date(reminder.scheduledAt), allowWhileIdle: true },
        sound: 'default',
        channelId: CHANNEL_ID,
        extra: { reminderId: reminder.id },
      }],
    });
    return true;
  }

  if (window.electronAPI?.scheduleReminder) {
    return window.electronAPI.scheduleReminder({
      id: reminder.id,
      title: reminder.title,
      body: reminder.body,
      scheduledAt: reminder.scheduledAt,
    });
  }

  scheduleBrowserTimer(reminder);
  return true;
}

export async function cancelScheduledReminder(id: string): Promise<void> {
  const timer = browserTimers.get(id);
  if (timer) clearTimeout(timer);
  browserTimers.delete(id);
  if (window.electronAPI?.cancelReminder) {
    await window.electronAPI.cancelReminder(id);
  }
  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId(id) }] }).catch(() => undefined);
  }
}

export const reminderService = {
  list(): Reminder[] {
    return read().sort((a, b) => a.scheduledAt - b.scheduledAt);
  },
  async add(input: Pick<Reminder, 'title' | 'body' | 'scheduledAt'>): Promise<Reminder> {
    const reminder: Reminder = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      enabled: true,
      createdAt: Date.now(),
    };
    const reminders = read();
    reminders.push(reminder);
    write(reminders);
    const scheduled = await scheduleReminder(reminder);
    const storedReminder = { ...reminder, enabled: scheduled };
    write(read().map(item => item.id === reminder.id ? storedReminder : item));
    return storedReminder;
  },
  async remove(id: string): Promise<void> {
    await cancelScheduledReminder(id);
    write(read().filter(reminder => reminder.id !== id));
  },
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const reminders = read();
    const reminder = reminders.find(item => item.id === id);
    if (!reminder) return;
    if (!enabled) {
      await cancelScheduledReminder(id);
      write(reminders.map(item => item.id === id ? { ...item, enabled: false } : item));
      return;
    }
    const scheduled = await scheduleReminder({ ...reminder, enabled: true });
    write(reminders.map(item => item.id === id ? { ...item, enabled: scheduled } : item));
  },
  async initialize(): Promise<void> {
    for (const reminder of read()) {
      if (reminder.enabled && reminder.scheduledAt > Date.now()) await scheduleReminder(reminder);
    }
  },
};