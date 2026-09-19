import { contextBridge, ipcRenderer, clipboard } from 'electron';
import { ElectronAPI } from './types';
import { DownloadJob } from '../shared/types';

const api: ElectronAPI = {
  analyzeUrl: (url: string) => ipcRenderer.invoke('youtube:analyze', url),

  startDownload: (options) => ipcRenderer.invoke('download:start', options),
  pauseDownload: (id: string) => ipcRenderer.invoke('download:pause', id),
  resumeDownload: (id: string) => ipcRenderer.invoke('download:resume', id),
  cancelDownload: (id: string) => ipcRenderer.invoke('download:cancel', id),
  retryDownload: (id: string) => ipcRenderer.invoke('download:retry', id),
  removeDownload: (id: string) => ipcRenderer.invoke('download:remove', id),
  sortQueue: (order: 'asc' | 'desc') => ipcRenderer.invoke('download:sortQueue', order),
  openFile: (filePath: string) => ipcRenderer.invoke('download:openFile', filePath),
  openFolder: (filePath: string) => ipcRenderer.invoke('download:openFolder', filePath),

  onDownloadProgress: (callback: (job: DownloadJob) => void) => {
    const handler = (_event: any, job: DownloadJob) => callback(job);
    ipcRenderer.on('download:progress', handler);
    return () => {
      ipcRenderer.removeListener('download:progress', handler);
    };
  },

  onDownloadCompleted: (callback: (job: DownloadJob) => void) => {
    const handler = (_event: any, job: DownloadJob) => callback(job);
    ipcRenderer.on('download:completed', handler);
    return () => {
      ipcRenderer.removeListener('download:completed', handler);
    };
  },

  onDownloadFailed: (callback: (job: DownloadJob) => void) => {
    const handler = (_event: any, job: DownloadJob) => callback(job);
    ipcRenderer.on('download:failed', handler);
    return () => {
      ipcRenderer.removeListener('download:failed', handler);
    };
  },

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  selectFolder: () => ipcRenderer.invoke('settings:selectFolder'),

  getHistory: () => ipcRenderer.invoke('history:get'),
  removeHistoryItem: (id: string) => ipcRenderer.invoke('history:remove', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  notifications: {
    show: (title: string, body: string, icon?: string) => ipcRenderer.invoke('notifications:show', title, body, icon)
  },

  getDependencies: () => ipcRenderer.invoke('system:getDependencies'),
  getSystemTheme: () => ipcRenderer.invoke('system:getTheme'),
  readClipboard: async () => {
    try {
      return clipboard.readText();
    } catch {
      return '';
    }
  },

  logger: {
    write: (level: string, source: string, ...args: any[]) =>
      ipcRenderer.invoke('logger:write', level, source, ...args),
    info: (...args: any[]) => ipcRenderer.invoke('logger:write', 'INFO', 'RENDERER', ...args),
    warn: (...args: any[]) => ipcRenderer.invoke('logger:write', 'WARN', 'RENDERER', ...args),
    error: (...args: any[]) => ipcRenderer.invoke('logger:write', 'ERROR', 'RENDERER', ...args),
    debug: (...args: any[]) => ipcRenderer.invoke('logger:write', 'DEBUG', 'RENDERER', ...args),
    openFolder: () => ipcRenderer.invoke('logger:openFolder'),
    getRecentLogs: (lines?: number) => ipcRenderer.invoke('logger:getRecent', lines),
    getPath: () => ipcRenderer.invoke('logger:getPath')
  }
};

contextBridge.exposeInMainWorld('api', api);
