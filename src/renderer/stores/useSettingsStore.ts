import { create } from 'zustand';
import { AppSettings, SystemDependencies } from '@shared/types';

interface SettingsStore {
  settings: AppSettings;
  dependencies: SystemDependencies | null;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  selectDownloadDirectory: () => Promise<void>;
  loadDependencies: () => Promise<void>;
  applyDomSettings: (settings: AppSettings) => void;
}

const DEFAULT_FALLBACK_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  fontSize: 'medium',
  downloadDirectory: '',
  defaultQuality: '1080p',
  defaultFormat: 'mp4',
  concurrentDownloads: 3,
  notifications: true,
  confirmBeforeDelete: true,
  duplicateAction: 'copy',
  createPlaylistFolder: true
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_FALLBACK_SETTINGS,
  dependencies: null,
  isLoading: true,

  applyDomSettings: (settings: AppSettings) => {
    const root = document.documentElement;

    // Apply theme
    if (settings.theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', settings.theme);
    }

    // Apply font size
    root.setAttribute('data-font-size', settings.fontSize);

    // Apply Language and RTL
    root.setAttribute('lang', settings.language);
    root.setAttribute('dir', settings.language === 'ar' ? 'rtl' : 'ltr');
  },

  loadSettings: async () => {
    try {
      if (window.api && window.api.getSettings) {
        const loaded = await window.api.getSettings();
        set({ settings: loaded, isLoading: false });
        get().applyDomSettings(loaded);
      } else {
        get().applyDomSettings(DEFAULT_FALLBACK_SETTINGS);
        set({ isLoading: false });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
      set({ isLoading: false });
    }
  },

  updateSettings: async (partial) => {
    try {
      const current = get().settings;
      const updated = { ...current, ...partial };
      set({ settings: updated });
      get().applyDomSettings(updated);

      if (window.api && window.api.saveSettings) {
        const saved = await window.api.saveSettings(partial);
        set({ settings: saved });
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },

  selectDownloadDirectory: async () => {
    try {
      if (window.api && window.api.selectFolder) {
        const selected = await window.api.selectFolder();
        if (selected) {
          await get().updateSettings({ downloadDirectory: selected });
        }
      }
    } catch (e) {
      console.error('Failed to select folder:', e);
    }
  },

  loadDependencies: async () => {
    try {
      if (window.api && window.api.getDependencies) {
        const deps = await window.api.getDependencies();
        set({ dependencies: deps });
      }
    } catch (e) {
      console.error('Failed to get dependencies:', e);
    }
  }
}));
