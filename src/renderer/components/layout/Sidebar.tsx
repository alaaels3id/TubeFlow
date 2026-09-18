import React from 'react';
import { LayoutDashboard, Download, History, Settings, ShieldCheck } from 'lucide-react';
import { Logo } from '../common/Logo';
import { useAppStore } from '../../stores/useAppStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useI18n } from '../../hooks/useI18n';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();
  const activeCount = useQueueStore((state) => state.activeCount);
  const { t } = useI18n();

  interface NavItem {
    id: 'dashboard' | 'downloads' | 'history' | 'settings';
    label: string;
    icon: any;
    badge?: number;
  }

  const navItems: NavItem[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'downloads', label: t('nav.downloads'), icon: Download, badge: activeCount > 0 ? activeCount : undefined },
    { id: 'history', label: t('nav.history'), icon: History },
    { id: 'settings', label: t('nav.settings'), icon: Settings }
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
                <span className="nav-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
          <ShieldCheck size={14} color="var(--color-primary-500)" />
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
