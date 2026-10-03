import React, { useState } from 'react';
import { Download, Folder, FileArchive, FileText, Package, Music, Film, File, HardDrive, Globe } from 'lucide-react';
import { FileMetadata } from '@shared/types';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useAppStore } from '../../stores/useAppStore';
import { useI18n } from '../../hooks/useI18n';
import { formatBytes } from '../../utils/format';

interface FileCardProps {
  file: FileMetadata;
  onDownloaded?: () => void;
}

export const FileCard: React.FC<FileCardProps> = ({ file, onDownloaded }) => {
  const { settings, selectDownloadDirectory } = useSettingsStore();
  const { addJob } = useQueueStore();
  const { addToast, setActiveTab } = useAppStore();
  const { t } = useI18n();
  const [isStarting, setIsStarting] = useState(false);

  const ext = (file.extension || 'file').toLowerCase();

  const renderIcon = () => {
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'cab'].includes(ext)) {
      return <FileArchive size={38} color="var(--color-primary-400)" />;
    }
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'epub'].includes(ext)) {
      return <FileText size={38} color="var(--color-accent-400)" />;
    }
    if (['dmg', 'pkg', 'exe', 'msi', 'deb', 'rpm', 'apk', 'bin', 'appimage'].includes(ext)) {
      return <Package size={38} color="#f59e0b" />;
    }
    if (['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'opus', 'wma'].includes(ext)) {
      return <Music size={38} color="#10b981" />;
    }
    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv'].includes(ext)) {
      return <Film size={38} color="var(--color-primary-400)" />;
    }
    return <File size={38} color="var(--text-muted)" />;
  };

  const handleDownload = async () => {
    setIsStarting(true);
    try {
      const jobId = await addJob({
        url: file.url,
        type: 'file',
        title: file.filename,
        thumbnail: '',
        quality: '',
        format: file.extension,
        destination: settings.downloadDirectory,
        filesizeApprox: file.filesizeApprox,
        totalBytes: file.filesizeApprox
      });

      if (jobId) {
        addToast(`Added "${file.filename}" to download queue`, 'success');
        if (onDownloaded) onDownloaded();
        setActiveTab('downloads');
      }
    } catch (e: any) {
      addToast(e.message || 'Failed to start download', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="card" style={{ padding: 24, marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* File Icon Box */}
        <div
          style={{
            width: 110,
            height: 80,
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid var(--border-color)',
            position: 'relative'
          }}
        >
          {renderIcon()}
          <span
            style={{
              position: 'absolute',
              bottom: 4,
              insetInlineEnd: 4,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: '#ffffff',
              padding: '1px 5px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase'
            }}
          >
            {ext}
          </span>
        </div>

        {/* File Info */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <h3
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 8,
              wordBreak: 'break-all'
            }}
          >
            {file.filename}
          </h3>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
              marginBottom: 16
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                maxWidth: 320,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={file.url}
            >
              <Globe size={13} />
              <span>{file.url}</span>
            </span>

            {file.filesizeApprox ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <HardDrive size={13} />
                <span>{formatBytes(file.filesizeApprox)}</span>
              </span>
            ) : null}

            <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: 10 }}>
              {ext}
            </span>
          </div>

          {/* Destination & Action */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              borderTop: '1px solid var(--border-color)',
              paddingTop: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {t('downloads.destination')}:
              </span>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)',
                  maxWidth: 240,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={settings.downloadDirectory}
              >
                {settings.downloadDirectory}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={selectDownloadDirectory}
                title={t('settings.change')}
                style={{ padding: '2px 6px' }}
              >
                <Folder size={14} />
              </button>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={isStarting}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Download size={16} />
              <span>{isStarting ? t('downloads.status.pending') : t('video.downloadBtn')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
