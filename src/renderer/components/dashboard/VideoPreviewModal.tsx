import React, { useMemo } from 'react';
import { Play, X, Download, ExternalLink, Film, Clock, User } from 'lucide-react';
import { VideoMetadata } from '@shared/types';
import { useI18n } from '../../hooks/useI18n';

interface VideoPreviewModalProps {
  video: VideoMetadata;
  selectedQuality?: string;
  selectedFormat?: string;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  video,
  selectedQuality,
  selectedFormat,
  isOpen,
  onClose,
  onDownload
}) => {
  const { t, isRtl } = useI18n();
  const webviewRef = React.useRef<any>(null);

  const previewSource = useMemo(() => {
    if (!video || !video.url) {
      return { type: 'unsupported' as const };
    }

    const url = video.url.trim();

    // 1. YouTube Match
    const ytMatch = url.match(
      /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/|live\/))([a-zA-Z0-9_-]{11})/i
    );
    const ytId = ytMatch ? ytMatch[1] : /^[a-zA-Z0-9_-]{11}$/.test(video.id) ? video.id : null;
    if (ytId) {
      return {
        type: 'youtube' as const,
        watchUrl: `https://www.youtube.com/watch?v=${ytId}&autoplay=1`
      };
    }

    // 2. Vimeo Match
    const vimeoMatch = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
      return {
        type: 'vimeo' as const,
        embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`
      };
    }

    // 3. Direct Video file extensions
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (
      cleanUrl.endsWith('.mp4') ||
      cleanUrl.endsWith('.webm') ||
      cleanUrl.endsWith('.m4v') ||
      cleanUrl.endsWith('.mov') ||
      cleanUrl.endsWith('.ogv')
    ) {
      return {
        type: 'direct' as const,
        directUrl: url
      };
    }

    return {
      type: 'unsupported' as const,
      fallbackUrl: url
    };
  }, [video]);

  // Setup clean webview player on YouTube dom-ready
  React.useEffect(() => {
    if (!isOpen || previewSource.type !== 'youtube') return;

    const wv = webviewRef.current;
    if (!wv) return;

    const handleDomReady = () => {
      try {
        wv.insertCSS(`
          #masthead-container, #secondary, #below, #chat, #guide, 
          ytd-banner-promo-renderer, tp-yt-app-drawer, ytd-miniplayer,
          #comments, #related {
            display: none !important;
          }
          html, body, ytd-app, #content, #page-manager, ytd-watch-flexy, #columns, #primary, #primary-inner {
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #000 !important;
          }
          #full-bleed-container, #player-container-outer, #player-container-inner, #player-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            z-index: 9999 !important;
          }
          .html5-video-player, video {
            width: 100% !important;
            height: 100% !important;
          }
        `);

        wv.executeJavaScript(`
          (() => {
            const v = document.querySelector('video');
            if (v) {
              v.play().catch(() => {});
            }
            const skipTimer = setInterval(() => {
              const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern');
              if (skipBtn) skipBtn.click();
            }, 500);
            setTimeout(() => clearInterval(skipTimer), 45000);
          })();
        `).catch(() => {});
      } catch (err) {
        // ignore
      }
    };

    wv.addEventListener('dom-ready', handleDomReady);
    return () => {
      wv.removeEventListener('dom-ready', handleDomReady);
    };
  }, [isOpen, previewSource]);

  if (!isOpen) return null;

  const handleOpenExternal = () => {
    if (window.api?.openExternal) {
      window.api.openExternal(video.url);
    } else {
      window.open(video.url, '_blank');
    }
  };

  const badgeText = `${(selectedFormat || 'MP4').toUpperCase()}${selectedQuality ? ` • ${selectedQuality}` : ''}`;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-dialog animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '94%',
          maxWidth: 860,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)'
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(178, 58, 72, 0.15)',
                border: '1px solid rgba(178, 58, 72, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Play size={20} color="var(--color-primary-400)" fill="var(--color-primary-400)" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 className="modal-title" style={{ fontSize: 'var(--font-size-md)', fontWeight: 700 }}>
                  {t('videoPreviewModal.title')}
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '11px', fontWeight: 600 }}>
                  {badgeText}
                </span>
              </div>
              <p
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-muted)',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 580
                }}
                title={video.title}
              >
                {video.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            aria-label={t('videoPreviewModal.close')}
            style={{ width: 34, height: 34, padding: 0, borderRadius: 'var(--radius-md)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Player Area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            backgroundColor: '#000000',
            aspectRatio: '16 / 9',
            maxHeight: '62vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {previewSource.type === 'youtube' && previewSource.watchUrl && (
            <webview
              ref={webviewRef}
              src={previewSource.watchUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#000000'
              }}
              allowpopups={false}
            />
          )}

          {previewSource.type === 'vimeo' && previewSource.embedUrl && (
            <iframe
              src={previewSource.embedUrl}
              title={video.title}
              style={{
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          )}

          {previewSource.type === 'direct' && previewSource.directUrl && (
            <video
              src={previewSource.directUrl}
              controls
              autoPlay
              style={{
                width: '100%',
                height: '100%',
                maxHeight: '62vh',
                objectFit: 'contain'
              }}
            />
          )}

          {previewSource.type === 'unsupported' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 30,
                gap: 14,
                color: 'var(--text-secondary)'
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Film size={26} color="var(--text-muted)" />
              </div>
              <div>
                <h4 style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', marginBottom: 6 }}>
                  {t('videoPreviewModal.unsupportedTitle')}
                </h4>
                <p style={{ fontSize: 'var(--font-size-sm)', maxWidth: 440, lineHeight: 1.5 }}>
                  {t('videoPreviewModal.unsupportedDesc')}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenExternal}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4 }}
              >
                <ExternalLink size={16} />
                <span>{t('videoPreviewModal.openInBrowser')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Meta & Actions */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          {/* Metadata badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={14} color="var(--color-primary-400)" />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{video.channel}</span>
            </div>
            {video.durationString && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={14} />
                <span>{video.durationString}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleOpenExternal}
              title={t('videoPreviewModal.openInBrowser')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px' }}
            >
              <ExternalLink size={15} />
              <span>{t('videoPreviewModal.openInBrowser')}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ height: 36, padding: '0 16px' }}
            >
              {t('videoPreviewModal.close')}
            </button>

            {onDownload && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  onDownload();
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 18px' }}
              >
                <Download size={15} />
                <span>{t('videoPreviewModal.downloadNow')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
