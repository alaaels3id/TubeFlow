import React, { useState } from 'react';
import { Download, Copy, Check, HardDrive, ArrowUp, ArrowDown, Film, Box, Gamepad2, Music, Tag, Star } from 'lucide-react';
import { TorrentSearchResult } from '../../../shared/types';
import { useTorrentStore } from '../../stores/useTorrentStore';
import { useAppStore } from '../../stores/useAppStore';

interface Props {
  item: TorrentSearchResult;
}

export const TorrentSearchResultItem: React.FC<Props> = ({ item }) => {
  const startDownload = useTorrentStore((state) => state.startDownload);
  const addToast = useAppStore((state) => state.addToast);
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [posterError, setPosterError] = useState(false);

  const handleCopyMagnet = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.magnet);
    setCopied(true);
    addToast('Magnet link copied to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsStarting(true);
    try {
      await startDownload(item.magnet, item.name);
    } finally {
      setIsStarting(false);
    }
  };

  const getCategoryIcon = (group: string) => {
    switch (group) {
      case 'movies':
        return <Film size={13} color="var(--color-accent-400)" />;
      case 'apps':
        return <Box size={13} color="var(--status-success)" />;
      case 'games':
        return <Gamepad2 size={13} color="#a855f7" />;
      case 'music':
        return <Music size={13} color="#ec4899" />;
      default:
        return <Tag size={13} color="var(--text-muted)" />;
    }
  };

  const getSourceBadgeStyle = (source: string) => {
    if (source.includes('YTS')) {
      return {
        bg: 'rgba(16, 185, 129, 0.12)',
        color: '#10b981',
        border: '1px solid rgba(16, 185, 129, 0.3)'
      };
    }
    if (source.includes('ThePirateBay')) {
      return {
        bg: 'rgba(14, 165, 233, 0.12)',
        color: '#38bdf8',
        border: '1px solid rgba(14, 165, 233, 0.3)'
      };
    }
    return {
      bg: 'rgba(168, 85, 247, 0.12)',
      color: '#c084fc',
      border: '1px solid rgba(168, 85, 247, 0.3)'
    };
  };

  const sourceStyle = getSourceBadgeStyle(item.source);

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 16px',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        transition: 'all var(--transition-fast)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
        {/* Optional Poster Thumbnail */}
        {item.poster && !posterError && (
          <img
            src={item.poster}
            alt={item.name}
            onError={() => setPosterError(true)}
            style={{
              width: 44,
              height: 64,
              borderRadius: 'var(--radius-sm)',
              objectFit: 'cover',
              flexShrink: 0,
              backgroundColor: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border-subtle)'
            }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title & Quality Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span
              title={item.name}
              style={{
                fontWeight: 600,
                fontSize: 'var(--font-size-base)',
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                wordBreak: 'break-word'
              }}
            >
              {item.name}
            </span>

            {item.quality && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px'
                }}
              >
                {item.quality}
              </span>
            )}
          </div>

          {/* Badges / Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Source Provider */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: sourceStyle.bg,
                color: sourceStyle.color,
                border: sourceStyle.border,
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600
              }}
            >
              {item.source}
            </span>

            {/* Category */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-secondary)'
              }}
            >
              {getCategoryIcon(item.categoryGroup)}
              <span>{item.category}</span>
            </span>

            {/* Rating if available */}
            {typeof item.rating === 'number' && item.rating > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 'var(--font-size-xs)',
                  color: '#facc15',
                  fontWeight: 600
                }}
                title="IMDb Rating"
              >
                <Star size={12} fill="#facc15" color="#facc15" />
                <span>{item.rating.toFixed(1)}</span>
              </span>
            )}

            {/* Size */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-secondary)'
              }}
            >
              <HardDrive size={13} color="var(--text-muted)" />
              <strong>{item.formattedSize}</strong>
            </span>

            {/* Seeders / Leechers */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 'var(--font-size-xs)',
                color: 'var(--status-success)',
                fontWeight: 600
              }}
              title="Seeds / Leechers"
            >
              <ArrowUp size={13} strokeWidth={2.5} />
              <span>{item.seeders}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/</span>
              <span style={{ color: 'var(--status-warning)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <ArrowDown size={13} strokeWidth={2.5} />
                {item.leechers}
              </span>
            </span>

            {item.added && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {item.added}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleCopyMagnet}
          title="Copy Magnet link"
          style={{ padding: '6px 10px' }}
        >
          {copied ? <Check size={14} color="var(--status-success)" /> : <Copy size={14} />}
          <span style={{ fontSize: 'var(--font-size-xs)' }}>{copied ? 'Copied' : 'Magnet'}</span>
        </button>

        <button
          className="btn btn-primary btn-sm"
          onClick={handleDownload}
          disabled={isStarting}
          style={{ padding: '6px 14px', gap: 6 }}
        >
          <Download size={15} />
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
            {isStarting ? 'Starting...' : 'Download'}
          </span>
        </button>
      </div>
    </div>
  );
};

