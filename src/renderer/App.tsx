import React, { useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { ToastContainer } from './components/layout/ToastContainer';
import { ConfirmModal } from './components/layout/ConfirmModal';
import { DashboardPage } from './pages/DashboardPage';
import { TorrentsPage } from './pages/TorrentsPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAppStore } from './stores/useAppStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { useQueueStore } from './stores/useQueueStore';
import { useHistoryStore } from './stores/useHistoryStore';
import { useUpdaterStore } from './stores/useUpdaterStore';
import { useTorrentStore } from './stores/useTorrentStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export const App: React.FC = () => {
  const activeTab = useAppStore((state) => state.activeTab);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const initQueueListeners = useQueueStore((state) => state.initListeners);
  const loadHistory = useHistoryStore((state) => state.loadHistory);
  const initUpdaterListeners = useUpdaterStore((state) => state.initListeners);
  const initTorrentListeners = useTorrentStore((state) => state.initListeners);

  useKeyboardShortcuts();

  useEffect(() => {
    loadSettings();
    initQueueListeners();
    loadHistory();
    initUpdaterListeners();
    const unsubTorrents = initTorrentListeners();
    return () => {
      if (unsubTorrents) unsubTorrents();
    };
  }, [loadSettings, initQueueListeners, loadHistory, initUpdaterListeners, initTorrentListeners]);

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main style={{ flex: 1, width: '100%', minWidth: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'dashboard' && <DashboardPage />}
          {activeTab === 'torrents' && <TorrentsPage />}
          {activeTab === 'downloads' && <DownloadsPage />}
          {activeTab === 'history' && <HistoryPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>
      <ToastContainer />
      <ConfirmModal />
    </div>
  );
};
