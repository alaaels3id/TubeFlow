import React, { useState } from 'react';
import { Search, Clipboard, X, Loader2 } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useAppStore } from '../../stores/useAppStore';

interface UrlAnalyzerProps {
  onAnalyze: (url: string) => Promise<void>;
  isLoading: boolean;
}

export const UrlAnalyzer: React.FC<UrlAnalyzerProps> = ({ onAnalyze, isLoading }) => {
  const [url, setUrl] = useState('');
  const { t } = useI18n();
  const { addToast } = useAppStore();

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    try {
      await onAnalyze(url.trim());
    } catch (e: any) {
      const rawMsg = e.message || '';
      const cleanMsg = rawMsg
        .replace(/^Error invoking remote method '[^']+':\s*/, '')
        .replace(/^Error:\s*/, '')
        .trim();
      addToast(cleanMsg || t('errors.generic'), 'error');
    }
  };

  const handlePaste = async () => {
    try {
      let text = '';
      if (window.api && window.api.readClipboard) {
        text = await window.api.readClipboard();
      } else {
        text = await navigator.clipboard.readText();
      }
      if (text) {
        setUrl(text.trim());
      }
    } catch {
      // Fallback
    }
  };

  const handleClear = () => {
    setUrl('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleAnalyze();
    }
  };

  return (
    <div className="card card-hero">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 4 }}>
            {t('dashboard.title')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {t('dashboard.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              id="url-analyzer-input"
              type="text"
              className="input-control"
              style={{
                paddingInlineStart: 40,
                paddingInlineEnd: url ? 40 : 14,
                height: 44,
                fontSize: 'var(--font-size-base)'
              }}
              placeholder={t('dashboard.inputPlaceholder')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              autoFocus
            />
            <Search
              size={18}
              color="var(--text-muted)"
              style={{ position: 'absolute', insetInlineStart: 14, pointerEvents: 'none' }}
            />
            {url && (
              <button
                className="btn btn-ghost btn-icon"
                onClick={handleClear}
                style={{
                  position: 'absolute',
                  insetInlineEnd: 8,
                  padding: 4,
                  color: 'var(--text-muted)'
                }}
                title={t('dashboard.clear')}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            className="btn btn-secondary"
            onClick={handlePaste}
            disabled={isLoading}
            title={t('dashboard.pasteFromClipboard')}
            style={{ height: 44, padding: '0 14px' }}
          >
            <Clipboard size={16} />
            <span>{t('dashboard.pasteFromClipboard')}</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={isLoading || !url.trim()}
            style={{ height: 44, padding: '0 22px' }}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('dashboard.analyzing')}</span>
              </>
            ) : (
              <span>{t('dashboard.analyze')}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
