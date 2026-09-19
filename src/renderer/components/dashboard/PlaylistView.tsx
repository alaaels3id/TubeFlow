import React, { useState, useMemo } from 'react';
import { ListMusic, Download, CheckSquare, Square, FolderPlus, Clock, ArrowUpDown } from 'lucide-react';
import { PlaylistMetadata } from '@shared/types';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useAppStore } from '../../stores/useAppStore';
import { useI18n } from '../../hooks/useI18n';

interface PlaylistViewProps {
  playlist: PlaylistMetadata;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ playlist }) => {
  const { settings, updateSettings } = useSettingsStore();
  const { addJob } = useQueueStore();
  const { addToast, setActiveTab } = useAppStore();
  const { t } = useI18n();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(playlist.items.map((item) => item.id))
  );

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'default'>('asc');

  const sortedItems = useMemo(() => {
    if (sortOrder === 'default') {
      return playlist.items;
    }
    const items = [...playlist.items];
    items.sort((a, b) => {
      const cmp = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [playlist.items, sortOrder]);

  const [targetQuality, setTargetQuality] = useState<string>(settings.defaultQuality || '1080p');
  const [targetFormat, setTargetFormat] = useState<'mp4' | 'webm' | 'mp3' | 'm4a' | 'opus'>(
    settings.defaultFormat || 'mp4'
  );

  const [createFolder, setCreateFolder] = useState<boolean>(settings.createPlaylistFolder ?? true);
  const [isDownloading, setIsDownloading] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.size === playlist.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(playlist.items.map((item) => item.id)));
    }
  };

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDownloadSelected = async () => {
    if (selectedIds.size === 0) {
      addToast(t('playlist.emptySelection'), 'warning');
      return;
    }

    setIsDownloading(true);
    let enqueuedCount = 0;

    const selectedVideos = sortedItems.filter((item) => selectedIds.has(item.id));

    for (const video of selectedVideos) {
      await addJob({
        url: video.url,
        type: 'playlist-item',
        playlistId: playlist.id,
        playlistTitle: playlist.title,
        title: video.title,
        thumbnail: video.thumbnail,
        channel: video.channel || playlist.channel,
        quality: targetQuality,
        format: targetFormat,
        destination: settings.downloadDirectory
      });
      enqueuedCount++;
    }

    setIsDownloading(false);
    addToast(`Added ${enqueuedCount} playlist items to queue`, 'success');
    setActiveTab('downloads');
  };

  const allSelected = selectedIds.size === playlist.items.length;

  return (
    <div className="card animate-fade-in" style={{ padding: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Playlist Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(178, 58, 72, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary-500)'
              }}
            >
              <ListMusic size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {playlist.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                {playlist.channel} • {t('playlist.videosCount', { count: playlist.itemCount })}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() =>
                setSortOrder((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? 'default' : 'asc'))
              }
              style={{ fontSize: 'var(--font-size-xs)' }}
              title={
                sortOrder === 'asc'
                  ? t('playlist.sortAsc')
                  : sortOrder === 'desc'
                  ? t('playlist.sortDesc')
                  : t('playlist.sortOriginal')
              }
            >
              <ArrowUpDown size={14} />
              <span>
                {sortOrder === 'asc'
                  ? t('playlist.sortAsc')
                  : sortOrder === 'desc'
                  ? t('playlist.sortDesc')
                  : t('playlist.sortOriginal')}
              </span>
            </button>

            <button className="btn btn-secondary" onClick={toggleSelectAll} style={{ fontSize: 'var(--font-size-xs)' }}>
              {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
              <span>{allSelected ? t('playlist.deselectAll') : t('playlist.selectAll')}</span>
            </button>
            <span className="badge badge-info">
              {t('playlist.selectedCount', { count: selectedIds.size })}
            </span>
          </div>
        </div>

        {/* Global Playlist Configuration */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            padding: 12,
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
            <input
              type="checkbox"
              checked={createFolder}
              onChange={(e) => {
                setCreateFolder(e.target.checked);
                updateSettings({ createPlaylistFolder: e.target.checked });
              }}
            />
            <FolderPlus size={16} color="var(--color-primary-500)" />
            <span>{t('playlist.createFolder')}</span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                {t('playlist.quality')}:
              </span>
              <select
                className="select-control"
                style={{ height: 32, padding: '2px 26px 2px 10px', fontSize: 'var(--font-size-xs)' }}
                value={targetQuality}
                onChange={(e) => setTargetQuality(e.target.value)}
              >
                <option value="best">Best Available</option>
                <option value="2160p">4K (2160p)</option>
                <option value="1440p">2K (1440p)</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="720p">720p (HD)</option>
                <option value="480p">480p</option>
                <option value="audio">Audio Only</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                {t('playlist.format')}:
              </span>
              <select
                className="select-control"
                style={{ height: 32, padding: '2px 26px 2px 10px', fontSize: 'var(--font-size-xs)' }}
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value as any)}
              >
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
                <option value="mp3">MP3</option>
                <option value="m4a">M4A</option>
                <option value="opus">Opus</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleDownloadSelected}
              disabled={isDownloading || selectedIds.size === 0}
              style={{ height: 32, fontSize: 'var(--font-size-xs)' }}
            >
              <Download size={14} />
              <span>{t('playlist.downloadSelected', { count: selectedIds.size })}</span>
            </button>
          </div>
        </div>

        {/* Video Items List */}
        <div
          style={{
            maxHeight: 380,
            overflowY: 'auto',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {sortedItems.map((item, displayIdx) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)'
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}} // handled by row click
                  style={{ cursor: 'pointer' }}
                />

                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-muted)',
                    width: 24,
                    textAlign: 'center'
                  }}
                >
                  {sortOrder === 'default' ? item.index : displayIdx + 1}
                </span>

                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    style={{
                      width: 54,
                      height: 34,
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover'
                    }}
                  />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {item.title}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-muted)'
                  }}
                >
                  <Clock size={12} />
                  <span>{item.durationString}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
