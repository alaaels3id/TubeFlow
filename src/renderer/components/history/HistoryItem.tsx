import React from 'react';
import {
  ExternalLink,
  FolderOpen,
  Trash2,
  RotateCcw,
  HardDrive,
  Calendar,
  FileArchive,
  FileText,
  Package,
  Music,
  Film,
  File
} from 'lucide-react';
import { HistoryItem as HistoryItemType } from '@shared/types';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useAppStore } from '../../stores/useAppStore';
import { useI18n } from '../../hooks/useI18n';
import { formatBytes, formatDate } from '../../utils/format';

interface HistoryItemProps {
  item: HistoryItemType;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({ item }) => {
  const { removeItem } = useHistoryStore();
  const { openFile, openFolder, addJob } = useQueueStore();
  const { setActiveTab } = useAppStore();
  const { t } = useI18n();

  const isCompleted = item.status === 'completed';
  const isFailed = item.status === 'failed';

  let badgeClass = 'badge-neutral';
  if (isCompleted) badgeClass = 'badge-success';
  else if (isFailed) badgeClass = 'badge-error';

  const handleRetry = async () => {
    await addJob({
      url: item.url,
      type: item.type === 'file' ? 'file' : (item.type === 'playlist' ? 'playlist-item' : 'video'),
      title: item.title,
      thumbnail: item.thumbnail,
      channel: item.channel,
      quality: item.type === 'file' ? '' : item.quality,
      format: item.format || (item.type === 'file' ? 'file' : 'mp4')
    });
    setActiveTab('downloads');
  };

  const getFormatBadge = (): string => {
    const titleMatch = (item.title || item.filePath || '').match(/\.([a-zA-Z0-9]{1,10})$/);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].toUpperCase();
    }
    if (item.format && item.format !== 'file') {
      return item.format.toUpperCase();
    }
    return item.type === 'file' ? 'FILE' : 'MP4';
  };

  const badgeFormat = getFormatBadge();
  const lowerExt = badgeFormat.toLowerCase();

  const nonVideoExts = [
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'cab', 'dmg',
    'exe', 'msi', 'pkg', 'deb', 'rpm', 'apk', 'bin', 'run', 'appimage',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'epub',
    'torrent', 'file'
  ];

  const isNonVideo = item.type === 'file' || nonVideoExts.includes(lowerExt);

  const shouldShowQuality = Boolean(
    !isNonVideo &&
    item.quality &&
    !['file', 'direct', 'unknown', 'none'].includes(item.quality.toLowerCase()) &&
    !nonVideoExts.includes(item.quality.toLowerCase())
  );

  const renderThumbnailIcon = () => {
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'cab'].includes(lowerExt)) {
      return <FileArchive size={22} color="var(--color-primary-400)" />;
    }
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'epub'].includes(lowerExt)) {
      return <FileText size={22} color="var(--color-accent-400)" />;
    }
    if (['dmg', 'pkg', 'exe', 'msi', 'deb', 'rpm', 'apk', 'bin', 'appimage'].includes(lowerExt)) {
      return <Package size={22} color="#f59e0b" />;
    }
    if (['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'opus', 'wma'].includes(lowerExt) || item.quality === 'audio') {
      return <Music size={22} color="#10b981" />;
    }
    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv'].includes(lowerExt) || item.type === 'video') {
      return <Film size={22} color="var(--color-primary-400)" />;
    }
    return <File size={22} color="var(--text-muted)" />;
  };

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Thumbnail */}
        <div
          style={{
            width: 90,
            height: 52,
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-input)',
            flexShrink: 0
          }}
        >
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt={item.title}
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
              {renderThumbnailIcon()}
            </div>
          )}
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h4
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '75%'
              }}
              title={item.title}
            >
              {item.title}
            </h4>
            <span className={`badge ${badgeClass}`}>{item.status}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-secondary)'
            }}
          >
            {item.channel && <span>{item.channel}</span>}
            <span className="badge badge-neutral" style={{ padding: '0 5px', fontSize: 10 }}>
              {shouldShowQuality ? `${item.quality} • ` : ''}{badgeFormat}
            </span>
            {item.fileSize ? <span>{formatBytes(item.fileSize)}</span> : null}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} />
              <span>{formatDate(item.downloadDate)}</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isFailed && (
            <button
              className="btn btn-secondary btn-icon"
              onClick={handleRetry}
              title={t('downloads.retry')}
            >
              <RotateCcw size={14} />
            </button>
          )}

          {isCompleted && item.filePath && (
            <>
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => openFile(item.filePath!)}
                title={t('downloads.openFile')}
              >
                <ExternalLink size={14} />
              </button>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => openFolder(item.filePath!)}
                title={t('downloads.openFolder')}
              >
                <FolderOpen size={14} />
              </button>
            </>
          )}

          <button
            className="btn btn-ghost btn-icon"
            onClick={() => removeItem(item.id)}
            title={t('downloads.remove')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
