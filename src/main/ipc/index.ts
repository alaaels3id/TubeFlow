import { ipcMain, dialog, shell, nativeTheme, BrowserWindow, app } from 'electron';
import { metadataService } from '../services/metadataService';
import { downloadService } from '../services/downloadService';
import { storageService } from '../services/storageService';
import { binaryService } from '../services/binaryService';
import { showNotification } from '../notifications';
import { loggerService } from '../services/loggerService';
import { updaterService } from '../services/updaterService';
import { torrentService } from '../services/torrentService';
import { torrentSearchService } from '../services/torrentSearchService';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Wire download callbacks to push to renderer
  downloadService.setCallbacks({
    onProgress: (job) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download:progress', job);
      }
    },
    onCompleted: (job) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download:completed', job);
      }
    },
    onFailed: (job) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download:failed', job);
      }
    }
  });

  // YouTube Analyze
  ipcMain.handle('youtube:analyze', async (_event, url: string) => {
    if (!url || typeof url !== 'string') {
      throw new Error('Please enter a valid YouTube URL');
    }
    return await metadataService.analyze(url.trim());
  });

  // Download actions
  ipcMain.handle('download:start', async (_event, options) => {
    return await downloadService.startDownload(options);
  });

  ipcMain.handle('download:pause', async (_event, id: string) => {
    return downloadService.pauseDownload(id);
  });

  ipcMain.handle('download:pauseAll', async () => {
    return downloadService.pauseAll();
  });

  ipcMain.handle('download:resume', async (_event, id: string) => {
    return downloadService.resumeDownload(id);
  });

  ipcMain.handle('download:resumeAll', async () => {
    return downloadService.resumeAll();
  });

  ipcMain.handle('download:cancel', async (_event, id: string) => {
    return downloadService.cancelDownload(id);
  });

  ipcMain.handle('download:stopAll', async () => {
    return downloadService.stopAll();
  });

  ipcMain.handle('download:retry', async (_event, id: string) => {
    return downloadService.retryDownload(id);
  });

  ipcMain.handle('download:remove', async (_event, id: string) => {
    return downloadService.removeDownload(id);
  });

  ipcMain.handle('download:getQueue', async () => {
    return downloadService.getQueue();
  });

  ipcMain.handle('download:sortQueue', async (_event, order: 'asc' | 'desc') => {
    return downloadService.sortQueue(order);
  });

  ipcMain.handle('download:openFile', async (_event, filePath: string) => {
    if (!filePath) return false;
    const res = await shell.openPath(filePath);
    return res === '';
  });

  ipcMain.handle('download:openFolder', async (_event, filePath: string) => {
    if (!filePath) return false;
    shell.showItemInFolder(filePath);
    return true;
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    return storageService.getSettings();
  });

  ipcMain.handle('settings:save', async (_event, newSettings) => {
    return storageService.saveSettings(newSettings);
  });

  ipcMain.handle('settings:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths.length) {
      return null;
    }
    return result.filePaths[0];
  });

  // History
  ipcMain.handle('history:get', async () => {
    return storageService.getHistory();
  });

  ipcMain.handle('history:remove', async (_event, id: string) => {
    return storageService.removeHistoryItem(id);
  });

  ipcMain.handle('history:clear', async () => {
    return storageService.clearHistory();
  });

  // Notifications (from qurany + custom icon support)
  ipcMain.handle('notifications:show', async (_event, title: string, body: string, icon?: string) => {
    console.log('[IPC] notifications:show invoked with args:', { title, body, icon });
    try {
      showNotification(title, body, icon, true); // force=true for explicit user test
      console.log('[IPC] showNotification executed successfully');
      return true;
    } catch (err) {
      console.error('[IPC] showNotification threw error:', err);
      throw err;
    }
  });

  // System
  ipcMain.handle('system:getDependencies', async () => {
    return await binaryService.getDependencies();
  });

  ipcMain.handle('system:getTheme', async () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  // Logger
  ipcMain.handle('logger:write', (_event, level: string, source: string, ...args: any[]) => {
    loggerService.write(level, source, ...args);
  });

  ipcMain.handle('logger:openFolder', async () => {
    return loggerService.openLogsFolder();
  });

  ipcMain.handle('logger:getRecent', async (_event, lines?: number) => {
    return loggerService.readRecentLogs(lines);
  });

  ipcMain.handle('logger:getPath', async () => {
    return loggerService.getLogFilePath();
  });

  // App & Updater
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('updater:getStatus', () => {
    return updaterService.getStatus();
  });

  ipcMain.handle('updater:check', async () => {
    return await updaterService.checkForUpdates();
  });

  ipcMain.handle('updater:download', async () => {
    return await updaterService.downloadUpdate();
  });

  ipcMain.handle('updater:install', () => {
    updaterService.installUpdate();
  });

  // Forward updater status changes to renderer
  updaterService.onStatusChange((status) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status-changed', status);
    }
  });

  // Torrents
  torrentService.setOnUpdate((jobs) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('torrent:update', jobs);
    }
  });

  ipcMain.handle('torrent:search', async (_event, query: string, category?: string, provider?: string) => {
    return await torrentSearchService.search(query, category, provider);
  });

  ipcMain.handle('torrent:start', async (_event, options) => {
    return await torrentService.addTorrent(options);
  });

  ipcMain.handle('torrent:pause', async (_event, id: string) => {
    return await torrentService.pauseTorrent(id);
  });

  ipcMain.handle('torrent:resume', async (_event, id: string) => {
    return await torrentService.resumeTorrent(id);
  });

  ipcMain.handle('torrent:remove', async (_event, id: string, deleteFiles?: boolean) => {
    return await torrentService.removeTorrent(id, deleteFiles);
  });

  ipcMain.handle('torrent:getAll', async () => {
    return torrentService.getAllJobs();
  });

  ipcMain.handle('torrent:selectFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select .torrent file',
      filters: [{ name: 'Torrent Files', extensions: ['torrent'] }],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    const filePath = result.filePaths[0];
    const pathMod = await import('node:path');
    const fsMod = await import('node:fs');
    const fileName = pathMod.basename(filePath);
    const fileBuffer = fsMod.readFileSync(filePath);

    return {
      name: fileName,
      path: filePath,
      data: fileBuffer.toString('base64')
    };
  });
}

