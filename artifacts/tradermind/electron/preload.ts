import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,
  isElectron: true,
  onCloseRequested(callback: () => void): () => void {
    const listener = (): void => callback();
    ipcRenderer.on('close-requested', listener);
    return () => ipcRenderer.removeListener('close-requested', listener);
  },
  confirmClose(): void {
    ipcRenderer.send('confirm-close');
  },
  cancelClose(): void {
    ipcRenderer.send('cancel-close');
  },
  scheduleReminder(reminder: {
    id: string;
    title: string;
    body: string;
    scheduledAt: number;
  }): Promise<boolean> {
    return ipcRenderer.invoke('schedule-reminder', reminder) as Promise<boolean>;
  },
  cancelReminder(id: string): Promise<void> {
    return ipcRenderer.invoke('cancel-reminder', id) as Promise<void>;
  },
});