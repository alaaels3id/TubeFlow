import { create } from 'zustand';
import { TorrentCategory, TorrentJob, TorrentSearchResult } from '../../shared/types';
import { useAppStore } from './useAppStore';

interface TorrentStore {
  // Search
  searchQuery: string;
  searchCategory: TorrentCategory;
  searchResults: TorrentSearchResult[];
  isSearching: boolean;
  searchError: string | null;
  hasSearched: boolean;
  selectedSort: 'seeders' | 'size' | 'name';
  sortOrder: 'asc' | 'desc';

  // Torrents list
  torrents: TorrentJob[];
  activeCount: number;
  viewTab: 'search' | 'downloads';

  // Actions
  setSearchQuery: (query: string) => void;
  setSearchCategory: (cat: TorrentCategory) => void;
  setViewTab: (tab: 'search' | 'downloads') => void;
  setSort: (sort: 'seeders' | 'size' | 'name') => void;
  search: (customQuery?: string) => Promise<void>;
  startDownload: (magnet: string, name?: string) => Promise<string | null>;
  pauseTorrent: (id: string) => Promise<void>;
  resumeTorrent: (id: string) => Promise<void>;
  removeTorrent: (id: string, deleteFiles?: boolean) => Promise<void>;
  selectTorrentFile: () => Promise<void>;
  initListeners: () => () => void;
}

export const useTorrentStore = create<TorrentStore>((set, get) => ({
  searchQuery: '',
  searchCategory: 'all',
  searchResults: [],
  isSearching: false,
  searchError: null,
  hasSearched: false,
  selectedSort: 'seeders',
  sortOrder: 'desc',

  torrents: [],
  activeCount: 0,
  viewTab: 'search',

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchCategory: (cat) => {
    set({ searchCategory: cat });
    // If user already searched something, re-trigger search with new category
    const currentQuery = get().searchQuery.trim();
    if (currentQuery) {
      get().search(currentQuery);
    }
  },
  setViewTab: (tab) => set({ viewTab: tab }),

  setSort: (sort) => {
    const currentSort = get().selectedSort;
    const currentOrder = get().sortOrder;
    const newOrder = currentSort === sort && currentOrder === 'desc' ? 'asc' : 'desc';

    set({ selectedSort: sort, sortOrder: newOrder });

    // Re-sort results
    const results = [...get().searchResults].sort((a, b) => {
      let valA: any = a[sort];
      let valB: any = b[sort];
      if (sort === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        return newOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return newOrder === 'asc' ? valA - valB : valB - valA;
    });

    set({ searchResults: results });
  },

  search: async (customQuery?: string) => {
    const query = (customQuery !== undefined ? customQuery : get().searchQuery).trim();
    if (!query) return;

    set({ isSearching: true, searchError: null, hasSearched: true });

    try {
      const results = await window.api.torrent.search(query, get().searchCategory);
      // Sort initially by seeders desc
      results.sort((a, b) => b.seeders - a.seeders);
      set({ searchResults: results, isSearching: false });
    } catch (err: any) {
      set({
        searchResults: [],
        isSearching: false,
        searchError: err?.message || 'Failed to search torrents. Check your connection.'
      });
    }
  },

  startDownload: async (magnet: string, name?: string) => {
    try {
      const jobId = await window.api.torrent.start({ magnet, name });
      useAppStore.getState().addToast(`Started downloading "${name || 'Torrent'}"`, 'success');
      // Switch view to downloads tab
      set({ viewTab: 'downloads' });
      return jobId;
    } catch (err: any) {
      useAppStore.getState().addToast(`Download error: ${err?.message || 'Unknown error'}`, 'error');
      return null;
    }
  },

  pauseTorrent: async (id: string) => {
    try {
      await window.api.torrent.pause(id);
    } catch (err: any) {
      useAppStore.getState().addToast(`Failed to pause: ${err.message}`, 'error');
    }
  },

  resumeTorrent: async (id: string) => {
    try {
      await window.api.torrent.resume(id);
    } catch (err: any) {
      useAppStore.getState().addToast(`Failed to resume: ${err.message}`, 'error');
    }
  },

  removeTorrent: async (id: string, deleteFiles: boolean = false) => {
    try {
      await window.api.torrent.remove(id, deleteFiles);
      useAppStore.getState().addToast('Torrent removed', 'info');
    } catch (err: any) {
      useAppStore.getState().addToast(`Failed to remove: ${err.message}`, 'error');
    }
  },

  selectTorrentFile: async () => {
    try {
      const file = await window.api.torrent.selectFile();
      if (file && file.data) {
        // Base64 buffer or file path
        const dataUri = `data:application/x-bittorrent;base64,${file.data}`;
        await get().startDownload(dataUri, file.name.replace(/\.torrent$/i, ''));
      }
    } catch (err: any) {
      useAppStore.getState().addToast(`Error reading file: ${err.message}`, 'error');
    }
  },

  initListeners: () => {
    // Initial fetch of torrents
    window.api.torrent.getAll().then((list) => {
      const active = list.filter((t) => t.status === 'downloading' || t.status === 'seeding').length;
      set({ torrents: list, activeCount: active });
    }).catch(() => {});

    // Listen for real-time updates
    const unsubscribe = window.api.torrent.onUpdate((list) => {
      const active = list.filter((t) => t.status === 'downloading' || t.status === 'seeding').length;
      set({ torrents: list, activeCount: active });
    });

    return unsubscribe;
  }
}));
