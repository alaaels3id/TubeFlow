import React, { useState } from 'react';
import { Download, Copy, Check, HardDrive, ArrowUp, ArrowDown, Film, Box, Gamepad2, Music, Tag } from 'lucide-react';
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

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '14px 18px',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        transition: 'all var(--transition-fast)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            title={item.name}
            style={{
              fontWeight: 600,
              fontSize: 'var(--font-size-base)',
              color: 'var(--text-primary)',
              lineHeight: 1.4,
              wordBreak: 'break-word',
              marginBottom: 6
            }}
          >
            {item.name}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
    </div>
  );
};
