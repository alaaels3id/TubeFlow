import {
  AnalyzeResult,
  AppSettings,
  DownloadJob,
  HistoryItem,
  SystemDependencies,
  UpdateStatus,
  TorrentSearchResult,
  TorrentJob
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
    playlistIndex?: number;
    filesizeApprox?: number;
    totalBytes?: number;
  }) => Promise<string>; // returns jobId
  pauseDownload: (id: string) => Promise<boolean>;
  pauseAll: () => Promise<boolean>;
  resumeDownload: (id: string) => Promise<boolean>;
  resumeAll: () => Promise<boolean>;
  cancelDownload: (id: string) => Promise<boolean>;
  stopAll: () => Promise<boolean>;
  retryDownload: (id: string) => Promise<boolean>;
  removeDownload: (id: string) => Promise<boolean>;
  getQueue: () => Promise<DownloadJob[]>;
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

  // App & Updater
  getAppVersion: () => Promise<string>;
  updater: {
    getStatus: () => Promise<UpdateStatus>;
    checkForUpdates: () => Promise<UpdateStatus>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    onStatusChange: (callback: (status: UpdateStatus) => void) => () => void;
  };

  // Torrents
  torrent: {
    search: (query: string, category?: string, provider?: string) => Promise<TorrentSearchResult[]>;
    start: (options: { magnet: string; name?: string; destination?: string }) => Promise<string>;
    pause: (id: string) => Promise<boolean>;
    resume: (id: string) => Promise<boolean>;
    remove: (id: string, deleteFiles?: boolean) => Promise<boolean>;
    getAll: () => Promise<TorrentJob[]>;
    selectFile: () => Promise<{ name: string; path: string; data: string } | null>;
    onUpdate: (callback: (torrents: TorrentJob[]) => void) => () => void;
  };
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
