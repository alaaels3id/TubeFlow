import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Copy,
  Check,
  Download,
  Search,
  Clock,
  Globe,
  X,
  AlertCircle,
  Loader2,
  FolderCheck
} from 'lucide-react';
import { VideoMetadata, SubtitleTrack } from '@shared/types';
import { useI18n } from '../../hooks/useI18n';
import { useAppStore } from '../../stores/useAppStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

interface TranscriptModalProps {
  video: VideoMetadata;
  isOpen: boolean;
  onClose: () => void;
}

export const TranscriptModal: React.FC<TranscriptModalProps> = ({ video, isOpen, onClose }) => {
  const { t, isRtl, language: appLanguage } = useI18n();
  const { addToast } = useAppStore();
  const { settings } = useSettingsStore();

  const [availableLanguages, setAvailableLanguages] = useState<SubtitleTrack[]>(video.subtitles || []);
  const [selectedLang, setSelectedLang] = useState<string>(() => {
    if (video.subtitles && video.subtitles.length > 0) {
      if (appLanguage === 'ar') {
        const ar = video.subtitles.find((s) => s.code.startsWith('ar'));
        if (ar) return ar.code;
      }
      const en = video.subtitles.find((s) => s.code.startsWith('en'));
      if (en) return en.code;
      return video.subtitles[0].code;
    }
    return appLanguage === 'ar' ? 'ar' : 'en';
  });

  const [withTimestamps, setWithTimestamps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch transcript whenever modal opens, language changes, or timestamps toggle
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    window.api
      .getTranscript(video.url, selectedLang, withTimestamps)
      .then((res) => {
        if (!isMounted) return;
        setTranscriptText(res.text || '');
        if (res.availableLanguages && res.availableLanguages.length > 0) {
          setAvailableLanguages(res.availableLanguages);
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        const msg = String(err?.message || '');
        if (msg.includes('No transcript or subtitle') || msg.includes('transcript:get')) {
          setError(t('transcriptModal.noTranscript'));
        } else {
          setError(err.message || t('transcriptModal.noTranscript'));
        }
        setTranscriptText('');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, video.url, selectedLang, withTimestamps]);

  // Statistics
  const stats = useMemo(() => {
    if (!transcriptText) return { words: 0, lines: 0 };
    const words = transcriptText.trim().split(/\s+/).filter(Boolean).length;
    const lines = transcriptText.split('\n').filter(Boolean).length;
    return { words, lines };
  }, [transcriptText]);

  // Filtered view if search is active
  const displayedText = useMemo(() => {
    if (!searchQuery.trim() || !transcriptText) return transcriptText;
    const query = searchQuery.toLowerCase();
    const lines = transcriptText.split('\n');
    const matched = lines.filter((l) => l.toLowerCase().includes(query));
    return matched.length > 0 ? matched.join('\n') : `No matching lines found for "${searchQuery}".`;
  }, [transcriptText, searchQuery]);

  const handleCopy = async () => {
    if (!transcriptText) return;
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      addToast(t('transcriptModal.copied'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleSave = async (format: 'txt' | 'srt' = 'txt') => {
    if (!transcriptText) return;
    setIsSaving(true);
    try {
      const savedPath = await window.api.saveTranscript({
        title: video.title,
        text: transcriptText,
        format,
        destination: settings.downloadDirectory
      });
      addToast(t('transcriptModal.saved', { path: savedPath }), 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save transcript file', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-dialog animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92%',
          maxWidth: 780,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary-500)',
                opacity: 0.9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FileText size={20} color="#fff" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 className="modal-title" style={{ fontSize: 'var(--font-size-md)', fontWeight: 700 }}>
                  {t('transcriptModal.title')}
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                  TXT
                </span>
              </div>
              <p
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 540,
                  margin: 0
                }}
                title={video.title}
              >
                {video.title}
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title={t('transcriptModal.close')}>
            <X size={18} />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--bg-input)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Language Selector */}
            {availableLanguages.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={15} color="var(--text-muted)" />
                <select
                  className="select-control"
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  style={{
                    height: 32,
                    fontSize: 'var(--font-size-xs)',
                    padding: '2px 8px',
                    minWidth: 130
                  }}
                >
                  {availableLanguages.map((track) => (
                    <option key={track.code} value={track.code}>
                      {track.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Timestamps Toggle */}
            <div
              style={{
                display: 'inline-flex',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-card)',
                padding: 2
              }}
            >
              <button
                type="button"
                className={`btn ${!withTimestamps ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setWithTimestamps(false)}
                style={{ height: 26, padding: '0 10px', fontSize: '11px', borderRadius: 'var(--radius-sm)' }}
              >
                {t('transcriptModal.cleanText')}
              </button>
              <button
                type="button"
                className={`btn ${withTimestamps ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setWithTimestamps(true)}
                style={{
                  height: 26,
                  padding: '0 10px',
                  fontSize: '11px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Clock size={12} />
                <span>{t('transcriptModal.withTimestamps')}</span>
              </button>
            </div>
          </div>

          {/* Search within transcript */}
          <div style={{ position: 'relative', width: 200 }}>
            <Search
              size={13}
              color="var(--text-muted)"
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                [isRtl ? 'right' : 'left']: 8
              }}
            />
            <input
              type="text"
              placeholder={t('transcriptModal.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-control"
              style={{
                height: 30,
                fontSize: '12px',
                paddingLeft: isRtl ? 8 : 26,
                paddingRight: isRtl ? 26 : 8
              }}
            />
          </div>
        </div>

        {/* Content Box */}
        <div
          style={{
            flex: 1,
            minHeight: 280,
            maxHeight: 460,
            overflowY: 'auto',
            padding: 20,
            backgroundColor: 'var(--bg-base)',
            fontFamily: withTimestamps
              ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
              : 'inherit',
            fontSize: 'var(--font-size-sm)',
            lineHeight: 1.65,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            userSelect: 'text'
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 240,
                gap: 12,
                color: 'var(--text-secondary)'
              }}
            >
              <Loader2 size={32} className="animate-spin" color="var(--color-primary-500)" />
              <p style={{ fontSize: 'var(--font-size-sm)' }}>{t('transcriptModal.loading')}</p>
            </div>
          ) : error ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 240,
                gap: 10,
                textAlign: 'center',
                color: 'var(--color-danger-500)'
              }}
            >
              <AlertCircle size={36} />
              <p style={{ fontWeight: 600, maxWidth: 460, margin: 0 }}>{error}</p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {t('transcriptModal.tryDifferentLang')}
              </p>
            </div>
          ) : (
            displayedText
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--bg-card)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          {/* Word & Line Count Stats */}
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
            {!isLoading && !error && transcriptText && (
              <span>{t('transcriptModal.stats', { words: stats.words, lines: stats.lines })}</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Copy Button */}
            <button
              className="btn btn-secondary"
              onClick={handleCopy}
              disabled={isLoading || !transcriptText}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {copied ? <Check size={15} color="var(--color-success-500)" /> : <Copy size={15} />}
              <span>{copied ? t('transcriptModal.copied') : t('transcriptModal.copy')}</span>
            </button>

            {/* Save as TXT Button */}
            <button
              className="btn btn-primary"
              onClick={() => handleSave('txt')}
              disabled={isLoading || !transcriptText || isSaving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 130 }}
            >
              {isSaving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              <span>{t('transcriptModal.saveTxt')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
