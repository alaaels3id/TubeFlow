import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

export function useKeyboardShortcuts() {
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const confirmModal = useAppStore((state) => state.confirmModal);
  const closeConfirmModal = useAppStore((state) => state.closeConfirmModal);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd + , -> Settings
      if (isCmdOrCtrl && e.key === ',') {
        e.preventDefault();
        setActiveTab('settings');
        return;
      }

      // Cmd + L -> Focus URL analyzer
      if (isCmdOrCtrl && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setActiveTab('dashboard');
        const urlInput = document.getElementById('url-analyzer-input') as HTMLInputElement | null;
        if (urlInput) {
          urlInput.focus();
          urlInput.select();
        }
        return;
      }

      // Esc -> Close modal if open
      if (e.key === 'Escape') {
        if (confirmModal && confirmModal.isOpen) {
          e.preventDefault();
          closeConfirmModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, confirmModal, closeConfirmModal]);
}
