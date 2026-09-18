import React from 'react';
import {
  Play,
  Pause,
  X,
  RotateCcw,
  ExternalLink,
  FolderOpen,
  Trash2,
  AlertCircle,
  Clock,
  Zap,
  HardDrive
} from 'lucide-react';
import { DownloadJob } from '@shared/types';
import { useQueueStore } from '../../stores/useQueueStore';
import { useI18n } from '../../hooks/useI18n';
import { formatBytes, formatDuration } from '../../utils/format';

interface DownloadItemProps {
  job: DownloadJob;
}

export const DownloadItem: React.FC<DownloadItemProps> = ({ job }) => {
  const { pauseJob, resumeJob, cancelJob, retryJob, removeJob, openFile, openFolder } =
    useQueueStore();
  const { t } = useI18n();

  const isDownloading = job.status === 'downloading';
  const isPaused = job.status === 'paused';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isPending = job.status === 'pending';

  let badgeClass = 'badge-neutral';
  if (isDownloading) badgeClass = 'badge-info';
  else if (isCompleted) badgeClass = 'badge-success';
  else if (isFailed) badgeClass = 'badge-error';
  else if (isPaused) badgeClass = 'badge-warning';

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Thumbnail */}
        <div
          style={{
            width: 110,
            height: 64,
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-input)',
            flexShrink: 0,
            position: 'relative'
          }}
        >
          {job.thumbnail ? (
            <img
              src={job.thumbnail}
              alt={job.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}
            >
              <HardDrive size={24} />
            </div>
          )}
          <span
            style={{
              position: 'absolute',
              top: 4,
              insetInlineStart: 4,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
              fontSize: 10,
              padding: '1px 4px',
              borderRadius: 3,
              fontWeight: 600,
              textTransform: 'uppercase'
            }}
          >
            {job.format}
          </span>
        </div>

        {/* Info & Progress */}
        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h4
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '80%'
              }}
              title={job.title}
            >
              {job.title}
            </h4>

            <span className={`badge ${badgeClass}`}>
              {t(`downloads.status.${job.status}` as any) || job.status}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="progress-container">
            <div
              className="progress-fill"
              style={{
                width: `${job.progress}%`,
                background: isFailed
                  ? 'var(--status-error)'
                  : isPaused
                  ? 'var(--status-warning)'
                  : undefined
              }}
            />
          </div>

          {/* Metrics bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-secondary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span>
                {job.progress}%
                {job.totalBytes > 0 && (
                  <span style={{ marginInlineStart: 4 }}>
                    ({formatBytes(job.downloadedBytes)} / {formatBytes(job.totalBytes)})
                  </span>
                )}
              </span>

              {isDownloading && job.speed > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-accent-400)' }}>
                  <Zap size={12} />
                  <span>{formatBytes(job.speed)}/s</span>
                </span>
              )}

              {isDownloading && job.remainingSeconds > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} />
                  <span>{formatDuration(job.remainingSeconds)}</span>
                </span>
              )}

              {job.quality && (
                <span className="badge badge-neutral" style={{ padding: '1px 6px', fontSize: 10 }}>
                  {job.quality}
                </span>
              )}
            </div>

            {job.errorMessage && (
              <span
                style={{
                  color: 'var(--status-error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  maxWidth: 240,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={job.errorMessage}
              >
                <AlertCircle size={12} />
                <span>{job.errorMessage}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isDownloading && (
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => pauseJob(job.id)}
              title={t('downloads.pause')}
            >
              <Pause size={15} />
            </button>
          )}

          {isPaused && (
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => resumeJob(job.id)}
              title={t('downloads.resume')}
            >
              <Play size={15} />
            </button>
          )}

          {(isDownloading || isPending || isPaused) && (
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => cancelJob(job.id)}
              title={t('downloads.cancel')}
            >
              <X size={15} />
            </button>
          )}

          {isFailed && (
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => retryJob(job.id)}
              title={t('downloads.retry')}
            >
              <RotateCcw size={15} />
            </button>
          )}

          {isCompleted && job.filePath && (
            <>
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => openFile(job.filePath!)}
                title={t('downloads.openFile')}
              >
                <ExternalLink size={15} />
              </button>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => openFolder(job.filePath!)}
                title={t('downloads.openFolder')}
              >
                <FolderOpen size={15} />
              </button>
            </>
          )}

          <button
            className="btn btn-ghost btn-icon"
            onClick={() => removeJob(job.id)}
            title={t('downloads.remove')}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
