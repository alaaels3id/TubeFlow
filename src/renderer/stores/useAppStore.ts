import { create } from 'zustand';

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface AppStore {
  activeTab: 'dashboard' | 'torrents' | 'downloads' | 'history' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'torrents' | 'downloads' | 'history' | 'settings') => void;
  
  toasts: ToastItem[];
  addToast: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
  removeToast: (id: string) => void;

  confirmModal: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  } | null;
  openConfirmModal: (modal: { title: string; message: string; onConfirm: () => void; confirmText?: string }) => void;
  closeConfirmModal: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  toasts: [],
  addToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastItem = { id, message, type };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  confirmModal: null,
  openConfirmModal: (modal) => set({ confirmModal: { ...modal, isOpen: true } }),
  closeConfirmModal: () => set({ confirmModal: null })
}));
