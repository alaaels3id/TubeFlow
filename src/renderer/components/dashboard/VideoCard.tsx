import React, { useState } from 'react';
import { Download, Folder, User, Clock, CheckCircle2, Film, HardDrive } from 'lucide-react';
import { VideoMetadata } from '@shared/types';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useAppStore } from '../../stores/useAppStore';
import { useI18n } from '../../hooks/useI18n';
import { formatBytes } from '../../utils/format';

interface VideoCardProps {
  video: VideoMetadata;
  onDownloaded?: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onDownloaded }) => {
  const { settings, selectDownloadDirectory } = useSettingsStore();
  const { addJob } = useQueueStore();
  const { addToast, setActiveTab } = useAppStore();
  const { t } = useI18n();

  const [selectedQuality, setSelectedQuality] = useState<string>(
    video.availableResolutions.includes(settings.defaultQuality)
      ? settings.defaultQuality
      : video.availableResolutions[0] || '1080p'
  );

  const [selectedFormat, setSelectedFormat] = useState<'mp4' | 'webm' | 'mp3' | 'm4a' | 'opus'>(
    settings.defaultFormat || 'mp4'
  );

  const [isStarting, setIsStarting] = useState(false);

  const handleDownload = async () => {
    setIsStarting(true);
    try {
      const jobId = await addJob({
        url: video.url,
        type: 'video',
        title: video.title,
        thumbnail: video.thumbnail,
        channel: video.channel,
        quality: selectedQuality,
        format: selectedFormat,
        destination: settings.downloadDirectory,
        filesizeApprox: currentSize,
        totalBytes: currentSize
      });

      if (jobId) {
        addToast(`Added "${video.title}" to download queue`, 'success');
        if (onDownloaded) onDownloaded();
        // Switch to downloads tab so user can see real-time progress
        setActiveTab('downloads');
      }
    } catch (e: any) {
      addToast(e.message || 'Failed to start download', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const isAudioOnly = selectedQuality === 'audio' || ['mp3', 'm4a', 'opus'].includes(selectedFormat);

  const getSizeForResolution = (res: string): number => {
    if (res === 'audio' || isAudioOnly) {
      const audioFmt = video.formats.find((f) => f.resolution === 'audio');
      if (audioFmt?.filesizeApprox) return audioFmt.filesizeApprox;
      return video.duration ? Math.round((128 * 1000 / 8) * video.duration) : 0;
    }
    const fmt = video.formats.find((f) => f.resolution === res);
    return fmt?.filesizeApprox || 0;
  };

  const currentSize = getSizeForResolution(selectedQuality);

  return (
    <div className="card animate-fade-in" style={{ padding: 22 }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Thumbnail with overlay duration */}
        <div
          style={{
            position: 'relative',
            width: 280,
            height: 158,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-input)',
            flexShrink: 0
          }}
        >
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Film size={40} color="var(--text-muted)" />
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              bottom: 8,
              insetInlineEnd: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: '#ffffff',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Clock size={11} />
            <span>{video.durationString}</span>
          </div>
        </div>

        {/* Video Information & Selectors */}
        <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <h3
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.35,
                marginBottom: 6
              }}
            >
              {video.title}
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={14} color="var(--color-primary-500)" />
                <span>{video.channel}</span>
              </div>
            </div>
          </div>

          {/* Quality & Format Selection Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="input-label" style={{ marginBottom: 0 }}>{t('videoCard.quality')}</label>
                {currentSize > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-primary-400)',
                      backgroundColor: 'rgba(178, 58, 72, 0.12)',
                      border: '1px solid rgba(178, 58, 72, 0.25)',
                      padding: '1px 7px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title={t('videoCard.approxSize')}
                  >
                    <HardDrive size={11} />
                    <span>~{formatBytes(currentSize)}</span>
                  </span>
                )}
              </div>
              <select
                className="select-control"
                value={selectedQuality}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedQuality(val);
                  if (val === 'audio' && ['mp4', 'webm'].includes(selectedFormat)) {
                    setSelectedFormat('mp3');
                  }
                }}
              >
                {video.availableResolutions.map((res) => {
                  const size = getSizeForResolution(res);
                  const sizeText = size > 0 ? ` • ~${formatBytes(size)}` : '';
                  const label =
                    res === 'audio'
                      ? t('videoCard.audioOnly')
                      : res === '2160p'
                      ? '4K (2160p)'
                      : res === '1440p'
                      ? '2K (1440p)'
                      : res === '1080p'
                      ? '1080p (Full HD)'
                      : res === '720p'
                      ? '720p (HD)'
                      : res;
                  return (
                    <option key={res} value={res}>
                      {label}{sizeText}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ marginBottom: 4 }}>{t('videoCard.format')}</label>
              <select
                className="select-control"
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as any)}
              >
                {isAudioOnly ? (
                  <>
                    <option value="mp3">MP3 (Audio)</option>
                    <option value="m4a">M4A (AAC)</option>
                    <option value="opus">Opus</option>
                  </>
                ) : (
                  <>
                    <option value="mp4">MP4 (Video)</option>
                    <option value="webm">WebM (Video)</option>
                    <option value="mp3">MP3 (Audio Only)</option>
                    <option value="m4a">M4A (Audio Only)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Destination Folder */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: 'var(--font-size-xs)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <Folder size={15} color="var(--color-accent-500)" style={{ flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)' }}>{t('videoCard.destination')}:</span>
              <span
                style={{
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={settings.downloadDirectory}
              >
                {settings.downloadDirectory || '~/Downloads'}
              </span>
            </div>
            <button
              className="btn btn-ghost"
              onClick={selectDownloadDirectory}
              style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)', height: 26 }}
            >
              {t('videoCard.changeDestination')}
            </button>
          </div>

          {/* Download Action & Current Size */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, flexWrap: 'wrap', gap: 10 }}>
            {currentSize > 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--font-size-sm)'
                }}
              >
                <HardDrive size={15} color="var(--color-primary-500)" />
                <span>{t('videoCard.approxSize')}:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                  ~{formatBytes(currentSize)}
                </span>
              </div>
            ) : (
              <div />
            )}

            <button
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={isStarting}
              style={{ minWidth: 160 }}
            >
              <Download size={16} />
              <span>{t('videoCard.download')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
