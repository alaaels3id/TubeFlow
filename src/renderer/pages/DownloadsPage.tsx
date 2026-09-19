import React, { useState } from 'react';
import { Download, PlusCircle, ArrowUpDown } from 'lucide-react';
import { DownloadItem } from '../components/downloads/DownloadItem';
import { useQueueStore } from '../stores/useQueueStore';
import { useAppStore } from '../stores/useAppStore';
import { useI18n } from '../hooks/useI18n';

export const DownloadsPage: React.FC = () => {
  const { jobs, activeCount, sortQueue } = useQueueStore();
  const { setActiveTab } = useAppStore();
  const { t } = useI18n();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleToggleSort = () => {
    const next = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(next);
    sortQueue(next);
  };

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('downloads.title')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {t('downloads.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {jobs.length > 1 && (
            <button
              className="btn btn-secondary"
              onClick={handleToggleSort}
              style={{ fontSize: 'var(--font-size-xs)', height: 32 }}
              title={sortOrder === 'asc' ? t('downloads.sortDesc') : t('downloads.sortAsc')}
            >
              <ArrowUpDown size={14} />
              <span>{sortOrder === 'asc' ? t('downloads.sortAsc') : t('downloads.sortDesc')}</span>
            </button>
          )}

          {activeCount > 0 && (
            <span className="badge badge-info" style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)' }}>
              {t('downloads.activeCount', { count: activeCount })}
            </span>
          )}
        </div>
      </div>

      {jobs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {jobs.map((job) => (
            <DownloadItem key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <Download size={26} />
          </div>

          <div>
            <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {t('downloads.noDownloads')}
            </h4>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {t('dashboard.subtitle')}
            </p>
          </div>

          <button className="btn btn-primary" onClick={() => setActiveTab('dashboard')}>
            <PlusCircle size={16} />
            <span>{t('nav.dashboard')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
