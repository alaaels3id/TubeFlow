import { create } from 'zustand';
import { HistoryItem } from '@shared/types';
import { useAppStore } from './useAppStore';

interface HistoryStore {
  history: HistoryItem[];
  isLoading: boolean;
  filter: 'all' | 'completed' | 'failed' | 'cancelled';
  searchQuery: string;
  setFilter: (filter: 'all' | 'completed' | 'failed' | 'cancelled') => void;
  setSearchQuery: (query: string) => void;
  loadHistory: () => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: [],
  isLoading: false,
  filter: 'all',
  searchQuery: '',

  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  loadHistory: async () => {
    set({ isLoading: true });
    try {
      if (window.api && window.api.getHistory) {
        const list = await window.api.getHistory();
        set({ history: list, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      console.error('Failed to load history:', e);
      set({ isLoading: false });
    }
  },

  removeItem: async (id: string) => {
    try {
      if (window.api && window.api.removeHistoryItem) {
        await window.api.removeHistoryItem(id);
      }
      set((state) => ({ history: state.history.filter((h) => h.id !== id) }));
    } catch (e) {
      console.error('Failed to remove history item:', e);
    }
  },

  clearHistory: async () => {
    try {
      if (window.api && window.api.clearHistory) {
        await window.api.clearHistory();
      }
      set({ history: [] });
      useAppStore.getState().addToast('Download history cleared', 'info');
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  }
}));
