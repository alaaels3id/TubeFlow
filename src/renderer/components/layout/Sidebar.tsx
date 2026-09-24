import React from 'react';
import { LayoutDashboard, Download, History, Settings, ShieldCheck, Magnet } from 'lucide-react';
import { Logo } from '../common/Logo';
import { useAppStore } from '../../stores/useAppStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useTorrentStore } from '../../stores/useTorrentStore';
import { useUpdaterStore } from '../../stores/useUpdaterStore';
import { useI18n } from '../../hooks/useI18n';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();
  const activeCount = useQueueStore((state) => state.activeCount);
  const activeTorrentCount = useTorrentStore((state) => state.activeCount);
  const { currentVersion, state: updateState } = useUpdaterStore();
  const { t } = useI18n();

  interface NavItem {
    id: 'dashboard' | 'torrents' | 'downloads' | 'history' | 'settings';
    label: string;
    icon: any;
    badge?: number;
  }

  const hasUpdate = updateState === 'available' || updateState === 'downloaded';

  const navItems: NavItem[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'torrents', label: t('nav.torrents') || 'Torrents', icon: Magnet, badge: activeTorrentCount > 0 ? activeTorrentCount : undefined },
    { id: 'downloads', label: t('nav.downloads'), icon: Download, badge: activeCount > 0 ? activeCount : undefined },
    { id: 'history', label: t('nav.history'), icon: History },
    { id: 'settings', label: t('nav.settings'), icon: Settings, badge: hasUpdate ? 1 : undefined }
  ];

  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: '4px 6px 12px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Logo size={28} showText />
        </div>

        <nav className="nav-list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={18} strokeWidth={isActive ? 2.3 : 1.8} />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="nav-badge" style={{ backgroundColor: item.id === 'settings' ? 'var(--color-primary-500)' : undefined }}>
                  {item.id === 'settings' ? '●' : item.badge}
                </span>
              )}
            </button>
          );
        })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-xs)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} color="var(--color-primary-500)" />
            <span>v{currentVersion}</span>
          </div>

          {hasUpdate && (
            <span
              onClick={() => setActiveTab('settings')}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-success, #10b981)',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title="Update available"
            >
              NEW
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};
