import { create } from 'zustand';
import { UpdateStatus, UpdateInfo, UpdateProgress, UpdateState } from '@shared/types';

interface UpdaterStore {
  state: UpdateState;
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  isChecking: boolean;
  isDownloading: boolean;

  initListeners: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
  state: 'idle',
  currentVersion: '1.2.0',
  updateInfo: null,
  progress: null,
  error: null,
  isChecking: false,
  isDownloading: false,

  initListeners: async () => {
    try {
      if (window.api && window.api.getAppVersion) {
        const ver = await window.api.getAppVersion();
        if (ver) set({ currentVersion: ver });
      }

      if (window.api && window.api.updater) {
        const initialStatus = await window.api.updater.getStatus();
        if (initialStatus) {
          set({
            state: initialStatus.state,
            currentVersion: initialStatus.currentVersion || get().currentVersion,
            updateInfo: initialStatus.updateInfo || null,
            progress: initialStatus.progress || null,
            error: initialStatus.error || null,
            isChecking: initialStatus.state === 'checking',
            isDownloading: initialStatus.state === 'downloading'
          });
        }

        window.api.updater.onStatusChange((status: UpdateStatus) => {
          set({
            state: status.state,
            currentVersion: status.currentVersion || get().currentVersion,
            updateInfo: status.updateInfo || null,
            progress: status.progress || null,
            error: status.error || null,
            isChecking: status.state === 'checking',
            isDownloading: status.state === 'downloading'
          });
        });
      }
    } catch (e) {
      console.error('[UPDATER_STORE] Failed to initialize listeners:', e);
    }
  },

  checkForUpdates: async () => {
    set({ isChecking: true, error: null });
    try {
      if (window.api && window.api.updater) {
        const status = await window.api.updater.checkForUpdates();
        set({
          state: status.state,
          updateInfo: status.updateInfo || null,
          error: status.error || null,
          isChecking: status.state === 'checking'
        });
      }
    } catch (e: any) {
      set({ error: e.message || 'Check for updates failed', isChecking: false, state: 'error' });
    }
  },

  downloadUpdate: async () => {
    set({ isDownloading: true, error: null });
    try {
      if (window.api && window.api.updater) {
        await window.api.updater.downloadUpdate();
      }
    } catch (e: any) {
      set({ error: e.message || 'Download update failed', isDownloading: false, state: 'error' });
    }
  },

  installUpdate: async () => {
    try {
      if (window.api && window.api.updater) {
        await window.api.updater.installUpdate();
      }
    } catch (e: any) {
      set({ error: e.message || 'Install update failed', state: 'error' });
    }
  }
}));
