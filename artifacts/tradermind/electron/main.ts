import { app, BrowserWindow, Notification, ipcMain } from 'electron';
import path from 'node:path';

interface ReminderPayload {
  id: string;
  title: string;
  body: string;
  scheduledAt: number;
}

const MAX_TIMEOUT = 2_147_483_647;

let mainWindow: BrowserWindow | null = null;
let allowClose = false;
const reminderTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelReminder(id: string): void {
  const timer = reminderTimers.get(id);
  if (timer) clearTimeout(timer);
  reminderTimers.delete(id);
}

function showReminder(reminder: ReminderPayload): void {
  reminderTimers.delete(reminder.id);
  if (Notification.isSupported()) {
    new Notification({
      title: reminder.title,
      body: reminder.body || 'یادآور TraderMind',
    }).show();
  }
}

function scheduleReminder(reminder: ReminderPayload): boolean {
  cancelReminder(reminder.id);
  if (reminder.scheduledAt <= Date.now()) return false;

  const scheduleNextChunk = (): void => {
    const remaining = reminder.scheduledAt - Date.now();
    if (remaining <= 0) {
      showReminder(reminder);
      return;
    }

    const timer = setTimeout(scheduleNextChunk, Math.min(remaining, MAX_TIMEOUT));
    reminderTimers.set(reminder.id, timer);
  };

  scheduleNextChunk();
  return true;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0b141b',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.loadFile(path.join(__dirname, '../../dist/public/index.html'));

  mainWindow.on('close', (event) => {
    if (allowClose) return;
    event.preventDefault();
    mainWindow?.webContents.send('close-requested');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('confirm-close', () => {
  allowClose = true;
  mainWindow?.close();
});

ipcMain.on('cancel-close', () => {
  // The renderer keeps ownership of the close dialog state.
});

ipcMain.handle('schedule-reminder', (_event, reminder: ReminderPayload) => (
  scheduleReminder(reminder)
));

ipcMain.handle('cancel-reminder', (_event, id: string) => {
  cancelReminder(id);
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  allowClose = true;
  for (const id of reminderTimers.keys()) cancelReminder(id);
});