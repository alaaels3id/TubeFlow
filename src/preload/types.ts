import {
  AnalyzeResult,
  AppSettings,
  DownloadJob,
  HistoryItem,
  SystemDependencies
} from '../shared/types';

export interface ElectronAPI {
  // YouTube Metadata
  analyzeUrl: (url: string) => Promise<AnalyzeResult>;
  
  // Downloads
  startDownload: (options: {
    url: string;
    type: 'video' | 'playlist-item';
    title: string;
    thumbnail: string;
    channel?: string;
    quality: string;
    format: 'mp4' | 'webm' | 'mp3' | 'm4a' | 'opus';
    destination?: string;
    playlistId?: string;
    playlistTitle?: string;
  }) => Promise<string>; // returns jobId
  pauseDownload: (id: string) => Promise<boolean>;
  resumeDownload: (id: string) => Promise<boolean>;
  cancelDownload: (id: string) => Promise<boolean>;
  retryDownload: (id: string) => Promise<boolean>;
  removeDownload: (id: string) => Promise<boolean>;
  sortQueue: (order: 'asc' | 'desc') => Promise<DownloadJob[]>;
  openFile: (filePath: string) => Promise<boolean>;
  openFolder: (filePath: string) => Promise<boolean>;
  
  // Progress event subscriptions
  onDownloadProgress: (callback: (job: DownloadJob) => void) => () => void;
  onDownloadCompleted: (callback: (job: DownloadJob) => void) => () => void;
  onDownloadFailed: (callback: (job: DownloadJob) => void) => () => void;

  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  selectFolder: () => Promise<string | null>;

  // History
  getHistory: () => Promise<HistoryItem[]>;
  removeHistoryItem: (id: string) => Promise<boolean>;
  clearHistory: () => Promise<boolean>;

  // Notifications
  notifications: {
    show: (title: string, body: string, icon?: string) => Promise<void>;
  };

  // System & Dependencies
  getDependencies: () => Promise<SystemDependencies>;
  getSystemTheme: () => Promise<'light' | 'dark'>;
  readClipboard: () => Promise<string>;

  // Logger
  logger: {
    write: (level: string, source: string, ...args: any[]) => Promise<void>;
    info: (...args: any[]) => Promise<void>;
    warn: (...args: any[]) => Promise<void>;
    error: (...args: any[]) => Promise<void>;
    debug: (...args: any[]) => Promise<void>;
    openFolder: () => Promise<boolean>;
    getRecentLogs: (lines?: number) => Promise<string>;
    getPath: () => Promise<string>;
  };
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
