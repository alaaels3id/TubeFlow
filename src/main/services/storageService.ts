import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { AppSettings, HistoryItem } from '../../shared/types';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  fontSize: 'medium',
  downloadDirectory: app ? app.getPath('downloads') : '',
  defaultQuality: '1080p',
  defaultFormat: 'mp4',
  concurrentDownloads: 3,
  notifications: true,
  confirmBeforeDelete: true,
  duplicateAction: 'copy',
  createPlaylistFolder: true
};

export class StorageService {
  private userDataPath: string;
  private settingsFile: string;
  private historyFile: string;
  private cachedSettings: AppSettings | null = null;
  private cachedHistory: HistoryItem[] | null = null;

  constructor() {
    this.userDataPath = app.getPath('userData');
    this.settingsFile = path.join(this.userDataPath, 'settings.json');
    this.historyFile = path.join(this.userDataPath, 'history.json');
    this.ensureDir();
  }

  private ensureDir() {
    if (!fs.existsSync(this.userDataPath)) {
      fs.mkdirSync(this.userDataPath, { recursive: true });
    }
  }

  public getSettings(): AppSettings {
    if (this.cachedSettings) return this.cachedSettings;
    try {
      if (fs.existsSync(this.settingsFile)) {
        const data = fs.readFileSync(this.settingsFile, 'utf-8');
        this.cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        return this.cachedSettings!;
      }
    } catch (e) {
      console.error('Failed to read settings file:', e);
    }
    this.cachedSettings = { ...DEFAULT_SETTINGS, downloadDirectory: app.getPath('downloads') };
    this.saveSettings(this.cachedSettings);
    return this.cachedSettings;
  }

  public saveSettings(newSettings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const merged = { ...current, ...newSettings };
    try {
      fs.writeFileSync(this.settingsFile, JSON.stringify(merged, null, 2), 'utf-8');
      this.cachedSettings = merged;
    } catch (e) {
      console.error('Failed to write settings file:', e);
    }
    return merged;
  }

  public getHistory(): HistoryItem[] {
    if (this.cachedHistory) return this.cachedHistory;
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf-8');
        this.cachedHistory = JSON.parse(data);
        return this.cachedHistory!;
      }
    } catch (e) {
      console.error('Failed to read history file:', e);
    }
    this.cachedHistory = [];
    return this.cachedHistory;
  }

  public addHistoryItem(item: HistoryItem): void {
    const history = this.getHistory();
    // Remove if already exists with same id
    const filtered = history.filter((h) => h.id !== item.id);
    filtered.unshift(item);
    // Limit history to 500 items
    const truncated = filtered.slice(0, 500);
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(truncated, null, 2), 'utf-8');
      this.cachedHistory = truncated;
    } catch (e) {
      console.error('Failed to update history file:', e);
    }
  }

  public removeHistoryItem(id: string): boolean {
    const history = this.getHistory();
    const updated = history.filter((h) => h.id !== id);
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(updated, null, 2), 'utf-8');
      this.cachedHistory = updated;
      return true;
    } catch {
      return false;
    }
  }

  public clearHistory(): boolean {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify([], null, 2), 'utf-8');
      this.cachedHistory = [];
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService = new StorageService();
