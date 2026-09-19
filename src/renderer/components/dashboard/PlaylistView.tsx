import React, { useState, useMemo, useEffect } from 'react';
import {
  ListMusic,
  Download,
  CheckSquare,
  Square,
  FolderPlus,
  Clock,
  ArrowUpDown,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { PlaylistMetadata, PlaylistItem } from '@shared/types';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useAppStore } from '../../stores/useAppStore';
import { useI18n } from '../../hooks/useI18n';

interface PlaylistViewProps {
  playlist: PlaylistMetadata;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ playlist }) => {
  const { settings, updateSettings } = useSettingsStore();
  const { addJob } = useQueueStore();
  const { history } = useHistoryStore();
  const { addToast, setActiveTab } = useAppStore();
  const { t } = useI18n();

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'default'>('asc');
  const [hideDownloaded, setHideDownloaded] = useState<boolean>(true);

  // Helper to detect if a playlist item was already downloaded in history
  const isItemDownloaded = (item: PlaylistItem) => {
    if (item.isDownloaded) return true;
    const itemId = item.id ? item.id.trim() : '';
    const itemUrl = item.url ? item.url.split('&')[0].trim() : '';
    const itemNormTitle = (item.title || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();

    return history.some((h) => {
      if (h.status !== 'completed') return false;
      const hUrl = h.url ? h.url.split('&')[0].trim() : '';
      if (itemUrl && hUrl && itemUrl === hUrl) return true;
      if (itemId && (h.id === itemId || (h.url && h.url.includes(itemId)))) return true;
      if (itemNormTitle && h.title) {
        const hNorm = h.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
        if (hNorm === itemNormTitle) return true;
      }
      return false;
    });
  };

  const sortedItems = useMemo(() => {
    // Deduplicate playlist items by ID, URL, or normalized title
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const unique: PlaylistItem[] = [];

    for (const item of playlist.items) {
      if (!item) continue;
      const id = (item.id || '').trim();
      const url = (item.url || '').trim();
      const title = (item.title || '').trim().toLowerCase();

      if (id && seenIds.has(id)) continue;
      if (url && seenUrls.has(url)) continue;
      if (title && seenTitles.has(title)) continue;

      if (id) seenIds.add(id);
      if (url) seenUrls.add(url);
      if (title) seenTitles.add(title);
      unique.push(item);
    }

    if (sortOrder === 'default') {
      return unique;
    }

    const items = [...unique];
    items.sort((a, b) => {
      const cmp = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [playlist.items, sortOrder]);

  const downloadedCount = useMemo(() => {
    return sortedItems.filter((item) => isItemDownloaded(item)).length;
  }, [sortedItems, history]);

  // Exclude already-downloaded videos by default so only un-downloaded remain
  const displayItems = useMemo(() => {
    if (!hideDownloaded) {
      return sortedItems;
    }
    return sortedItems.filter((item) => !isItemDownloaded(item));
  }, [sortedItems, hideDownloaded, history]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(displayItems.map((item) => item.id));
  });

  useEffect(() => {
    setSelectedIds(
      new Set(displayItems.filter((item) => (hideDownloaded ? true : !isItemDownloaded(item))).map((item) => item.id))
    );
  }, [displayItems, hideDownloaded]);

  const [targetQuality, setTargetQuality] = useState<string>(settings.defaultQuality || '1080p');
  const [targetFormat, setTargetFormat] = useState<'mp4' | 'webm' | 'mp3' | 'm4a' | 'opus'>(
    settings.defaultFormat || 'mp4'
  );

  const [createFolder, setCreateFolder] = useState<boolean>(settings.createPlaylistFolder ?? true);
  const [isDownloading, setIsDownloading] = useState(false);

  const toggleSelectAll = () => {
    const selectable = displayItems.filter((item) => (hideDownloaded ? true : !isItemDownloaded(item)));
    if (selectedIds.size === selectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((item) => item.id)));
    }
  };

  const toggleItem = (id: string, isDownloaded?: boolean) => {
    if (isDownloaded) return;
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
    const enqueuedUrls = new Set<string>();

    const selectedVideos = displayItems.filter((item) => selectedIds.has(item.id));

    for (const video of selectedVideos) {
      if (enqueuedUrls.has(video.url)) continue;
      enqueuedUrls.add(video.url);

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

  const selectableCount = displayItems.filter((item) => (hideDownloaded ? true : !isItemDownloaded(item))).length;
  const allSelected = selectableCount > 0 && selectedIds.size === selectableCount;

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
                {playlist.channel} • {t('playlist.videosCount', { count: displayItems.length })}
                {downloadedCount > 0 && (
                  <span style={{ marginInlineStart: 6, color: 'var(--color-success, #10b981)', fontWeight: 500 }}>
                    • ({t('playlist.alreadyDownloaded', { count: downloadedCount })})
                  </span>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {downloadedCount > 0 && (
              <button
                className="btn btn-secondary"
                onClick={() => setHideDownloaded((prev) => !prev)}
                style={{ fontSize: 'var(--font-size-xs)' }}
                title={hideDownloaded ? t('playlist.showAll') : t('playlist.hideDownloaded', { count: downloadedCount })}
              >
                {hideDownloaded ? <Eye size={14} /> : <EyeOff size={14} />}
                <span>{hideDownloaded ? t('playlist.showAll') : t('playlist.hideDownloaded', { count: downloadedCount })}</span>
              </button>
            )}

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
          {displayItems.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={36} style={{ margin: '0 auto 10px', color: 'var(--color-success, #10b981)' }} />
              <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                {t('playlist.alreadyDownloaded', { count: downloadedCount })}
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => setHideDownloaded(false)}
                style={{ marginTop: 12, fontSize: 'var(--font-size-xs)' }}
              >
                <Eye size={14} />
                <span>{t('playlist.showAll')}</span>
              </button>
            </div>
          ) : (
            displayItems.map((item, displayIdx) => {
              const downloaded = isItemDownloaded(item);
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id, downloaded)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'transparent',
                    cursor: downloaded ? 'default' : 'pointer',
                    opacity: downloaded ? 0.65 : 1,
                    transition: 'background-color var(--transition-fast)'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={downloaded}
                    onChange={() => {}} // handled by row click
                    style={{ cursor: downloaded ? 'not-allowed' : 'pointer' }}
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

                  {downloaded && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '11px',
                        padding: '2px 8px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--color-success, #10b981)',
                        borderRadius: '9999px',
                        fontWeight: 600,
                        flexShrink: 0
                      }}
                    >
                      <CheckCircle2 size={12} />
                      {t('playlist.downloadedBadge')}
                    </span>
                  )}

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
            })
          )}
        </div>
      </div>
    </div>
  );
};
