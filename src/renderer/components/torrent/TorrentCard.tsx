import React from 'react';
import {
  Play,
  Pause,
  Trash2,
  FolderOpen,
  ArrowDown,
  ArrowUp,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { TorrentJob } from '../../../shared/types';
import { useTorrentStore } from '../../stores/useTorrentStore';
import { useAppStore } from '../../stores/useAppStore';

interface Props {
  job: TorrentJob;
}

export const TorrentCard: React.FC<Props> = ({ job }) => {
  const { pauseTorrent, resumeTorrent, removeTorrent } = useTorrentStore();
  const { openConfirmModal, addToast } = useAppStore();

  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const formatEta = (seconds: number) => {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  };

  const handleOpenFolder = () => {
    if (job.destination) {
      window.api.openFolder(job.destination);
    }
  };

  const handleRemove = () => {
    openConfirmModal({
      title: 'Remove Torrent',
      message: `Are you sure you want to remove "${job.name}"?`,
      confirmText: 'Remove',
      onConfirm: () => {
        removeTorrent(job.id, false);
      }
    });
  };

  const getStatusBadge = () => {
    switch (job.status) {
      case 'downloading':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(36, 123, 160, 0.2)',
              color: 'var(--color-accent-400)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <ArrowDown size={12} strokeWidth={2.5} />
            Downloading
          </span>
        );
      case 'seeding':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(52, 211, 153, 0.15)',
              color: 'var(--status-success)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <ArrowUp size={12} strokeWidth={2.5} />
            Seeding
          </span>
        );
      case 'completed':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(52, 211, 153, 0.15)',
              color: 'var(--status-success)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <CheckCircle2 size={12} />
            Completed
          </span>
        );
      case 'paused':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(251, 191, 36, 0.15)',
              color: 'var(--status-warning)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Pause size={12} />
            Paused
          </span>
        );
      case 'error':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(248, 113, 113, 0.15)',
              color: 'var(--status-error)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <AlertCircle size={12} />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  const progressPercent = Math.min(100, Math.max(0, job.progress || 0));

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px 20px',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {getStatusBadge()}
          <span
            title={job.name}
            style={{
              fontWeight: 600,
              fontSize: 'var(--font-size-base)',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {job.name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {job.status === 'downloading' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => pauseTorrent(job.id)}
              title="Pause download"
              style={{ padding: '6px 10px' }}
            >
              <Pause size={14} />
            </button>
          )}

          {job.status === 'paused' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => resumeTorrent(job.id)}
              title="Resume download"
              style={{ padding: '6px 10px' }}
            >
              <Play size={14} />
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleOpenFolder}
            title="Open folder"
            style={{ padding: '6px 10px' }}
          >
            <FolderOpen size={14} />
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRemove}
            title="Remove from list"
            style={{ padding: '6px 10px', color: 'var(--status-error)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div
          style={{
            height: 6,
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background:
                job.status === 'completed'
                  ? 'var(--status-success)'
                  : 'linear-gradient(90deg, var(--color-primary-500), var(--color-accent-400))',
              transition: 'width 0.3s ease',
              borderRadius: 'var(--radius-full)'
            }}
          />
        </div>
      </div>

      {/* Meta Stats Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span>
            <strong>{progressPercent.toFixed(1)}%</strong> ({formatBytes(job.downloadedBytes)} /{' '}
            {formatBytes(job.totalBytes)})
          </span>

          {job.status === 'downloading' && (
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-accent-400)' }}>
                <ArrowDown size={13} />
                {formatSpeed(job.downloadSpeed)}
              </span>

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--status-success)' }}>
                <ArrowUp size={13} />
                {formatSpeed(job.uploadSpeed)}
              </span>

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Users size={13} color="var(--text-muted)" />
                {job.numPeers} peers
              </span>

              {job.eta > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={13} color="var(--text-muted)" />
                  ETA: {formatEta(job.eta)}
                </span>
              )}
            </>
          )}

          {job.status === 'completed' && (
            <span style={{ color: 'var(--status-success)' }}>Ready in Downloads folder</span>
          )}
        </div>

        {job.errorMessage && (
          <span style={{ color: 'var(--status-error)' }}>{job.errorMessage}</span>
        )}
      </div>
    </div>
  );
};
