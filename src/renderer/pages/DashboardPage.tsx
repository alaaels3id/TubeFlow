import React, { useState } from 'react';
import { UrlAnalyzer } from '../components/dashboard/UrlAnalyzer';
import { VideoCard } from '../components/dashboard/VideoCard';
import { PlaylistView } from '../components/dashboard/PlaylistView';
import { HistoryItem } from '../components/history/HistoryItem';
import { VideoMetadata, PlaylistMetadata } from '@shared/types';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useQueueStore } from '../stores/useQueueStore';
import { useI18n } from '../hooks/useI18n';
import { ArrowRight, History, DownloadCloud } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

export const DashboardPage: React.FC = () => {
  const [analyzedVideo, setAnalyzedVideo] = useState<VideoMetadata | null>(null);
  const [analyzedPlaylist, setAnalyzedPlaylist] = useState<PlaylistMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { history } = useHistoryStore();
  const { jobs } = useQueueStore();
  const { setActiveTab } = useAppStore();
  const { t } = useI18n();

  const handleAnalyze = async (url: string) => {
    setIsLoading(true);
    setAnalyzedVideo(null);
    setAnalyzedPlaylist(null);

    try {
      if (!window.api || !window.api.analyzeUrl) {
        throw new Error('Desktop IPC bridge not available');
      }

      const result = await window.api.analyzeUrl(url);

      if (result.type === 'video' && result.video) {
        setAnalyzedVideo(result.video);
      } else if (result.type === 'playlist' && result.playlist) {
        setAnalyzedPlaylist(result.playlist);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const recentHistory = history.slice(0, 3);
  const activeJobs = jobs.filter((j) => j.status === 'downloading' || j.status === 'processing');

  return (
    <div className="main-content">
      {/* URL Analyzer Hero Card */}
      <UrlAnalyzer onAnalyze={handleAnalyze} isLoading={isLoading} />

      {/* Video Details Card */}
      {analyzedVideo && <VideoCard video={analyzedVideo} />}

      {/* Playlist Details Card */}
      {analyzedPlaylist && <PlaylistView playlist={analyzedPlaylist} />}

      {/* Active downloads quick banner if running */}
      {activeJobs.length > 0 && (
        <div
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderInlineStart: '4px solid var(--color-accent-500)',
            backgroundColor: 'var(--badge-bg-info)',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('downloads')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <DownloadCloud size={20} color="var(--color-accent-500)" className="animate-pulse" />
            <div>
              <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('downloads.activeCount', { count: activeJobs.length })}
              </h4>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                {activeJobs[0].title}
              </p>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 'var(--font-size-xs)' }}>
            <span>{t('nav.downloads')}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Recent Downloads Section */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12
          }}
        >
          <h3
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <History size={18} color="var(--color-primary-500)" />
            <span>{t('dashboard.recentDownloads')}</span>
          </h3>

          {history.length > 3 && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 'var(--font-size-xs)' }}
              onClick={() => setActiveTab('history')}
            >
              <span>{t('history.title')}</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>

        {recentHistory.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentHistory.map((item) => (
              <HistoryItem key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div
            className="card"
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            <p>{t('dashboard.noRecent')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
