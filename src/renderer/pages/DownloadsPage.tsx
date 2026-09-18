import React from 'react';
import { Download, PlusCircle } from 'lucide-react';
import { DownloadItem } from '../components/downloads/DownloadItem';
import { useQueueStore } from '../stores/useQueueStore';
import { useAppStore } from '../stores/useAppStore';
import { useI18n } from '../hooks/useI18n';

export const DownloadsPage: React.FC = () => {
  const { jobs, activeCount } = useQueueStore();
  const { setActiveTab } = useAppStore();
  const { t } = useI18n();

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

        {activeCount > 0 && (
          <span className="badge badge-info" style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)' }}>
            {t('downloads.activeCount', { count: activeCount })}
          </span>
        )}
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
