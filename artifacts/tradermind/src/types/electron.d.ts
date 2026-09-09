export {};

declare global {
  interface Window {
    electronAPI?: {
      platform?: string;
      version?: string;
      isElectron?: boolean;
      onCloseRequested?: (callback: () => void) => () => void;
      confirmClose?: () => void;
      cancelClose?: () => void;
      scheduleReminder?: (reminder: {
        id: string;
        title: string;
        body: string;
        scheduledAt: number;
      }) => Promise<boolean>;
      cancelReminder?: (id: string) => Promise<void>;
    };
  }
}