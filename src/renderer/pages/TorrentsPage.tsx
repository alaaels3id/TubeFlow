import React, { useState } from 'react';
import {
  Search,
  Download,
  Film,
  Box,
  Gamepad2,
  Music,
  Compass,
  FileCode,
  Link,
  ArrowUpDown,
  Loader2,
  Inbox,
  HardDrive
} from 'lucide-react';
import { TorrentCategory, TorrentJob, TorrentSearchResult } from '../../shared/types';
import { useTorrentStore } from '../stores/useTorrentStore';
import { TorrentSearchResultItem } from '../components/torrent/TorrentSearchResultItem';
import { TorrentCard } from '../components/torrent/TorrentCard';
import { useI18n } from '../hooks/useI18n';

export const TorrentsPage: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    searchCategory,
    setSearchCategory,
    searchResults,
    isSearching,
    searchError,
    hasSearched,
    selectedSort,
    setSort,
    search,
    startDownload,
    selectTorrentFile,
    torrents,
    activeCount,
    viewTab,
    setViewTab
  } = useTorrentStore();

  const { t } = useI18n();
  const [directInput, setDirectInput] = useState('');
  const [showDirectBar, setShowDirectBar] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search();
  };

  const handleDirectDownload = async () => {
    const trimmed = directInput.trim();
    if (!trimmed) return;
    await startDownload(trimmed, 'Direct Torrent');
    setDirectInput('');
    setShowDirectBar(false);
  };

  const categories: { id: TorrentCategory; label: string; icon: any }[] = [
    { id: 'all', label: 'All', icon: Compass },
    { id: 'movies', label: 'Movies & Video', icon: Film },
    { id: 'apps', label: 'Applications', icon: Box },
    { id: 'games', label: 'Games', icon: Gamepad2 },
    { id: 'music', label: 'Music', icon: Music }
  ];

  // Calculate total download speed
  const totalDownloadSpeed = torrents
    .filter((t: TorrentJob) => t.status === 'downloading')
    .reduce((acc: number, curr: TorrentJob) => acc + (curr.downloadSpeed || 0), 0);

  const formatSpeed = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B/s';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}/s`;
  };

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Torrent Downloader
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            Search movies, software applications, and games or download directly to your device
          </p>
        </div>

        {/* View Switcher Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface-elevated)',
            padding: 3,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <button
            className={`btn btn-sm ${viewTab === 'search' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewTab('search')}
            style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)' }}
          >
            <Search size={14} />
            <span>Search & Browse</span>
            {searchResults.length > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  padding: '1px 6px',
                  borderRadius: 10
                }}
              >
                {searchResults.length}
              </span>
            )}
          </button>

          <button
            className={`btn btn-sm ${viewTab === 'downloads' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setViewTab('downloads')}
            style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)' }}
          >
            <Download size={14} />
            <span>Downloads</span>
            {torrents.length > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: activeCount > 0 ? 'var(--color-primary-500)' : 'rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  padding: '1px 6px',
                  borderRadius: 10
                }}
              >
                {torrents.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Search Hero Area */}
      <div
        className="card card-hero"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 20
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10, width: '100%' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                insetInlineStart: 14,
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movie name (e.g. Inception), application (e.g. Photoshop), game, or magnet..."
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
                transition: 'border-color var(--transition-fast)'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSearching || !searchQuery.trim()}
            style={{ padding: '0 24px', flexShrink: 0 }}
          >
            {isSearching ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
            <span>Search</span>
          </button>
        </form>

        {/* Category Pills & Quick Tools */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = searchCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSearchCategory(cat.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--color-primary-500)' : 'var(--border-subtle)',
                    backgroundColor: isSelected ? 'rgba(178, 58, 72, 0.2)' : 'var(--bg-surface-elevated)',
                    color: isSelected ? 'var(--color-primary-300)' : 'var(--text-secondary)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <Icon size={14} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowDirectBar(!showDirectBar)}
              title="Add raw magnet link"
              style={{ fontSize: 'var(--font-size-xs)' }}
            >
              <Link size={13} />
              <span>Paste Magnet</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={selectTorrentFile}
              title="Select local .torrent file"
              style={{ fontSize: 'var(--font-size-xs)' }}
            >
              <FileCode size={13} />
              <span>Open .torrent</span>
            </button>
          </div>
        </div>

        {/* Direct Magnet Inline Bar */}
        {showDirectBar && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: 12,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)'
            }}
          >
            <input
              type="text"
              value={directInput}
              onChange={(e) => setDirectInput(e.target.value)}
              placeholder="Paste magnet:?xt=urn:btih:... link here"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                outline: 'none'
              }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleDirectDownload}
              disabled={!directInput.trim()}
            >
              <Download size={14} />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: Search Results */}
      {viewTab === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Results Header with Sorting */}
          {searchResults.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                Found <strong>{searchResults.length}</strong> torrents
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ArrowUpDown size={12} />
                  Sort by:
                </span>
                <button
                  className={`btn btn-sm ${selectedSort === 'seeders' ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setSort('seeders')}
                  style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}
                >
                  Seeds
                </button>
                <button
                  className={`btn btn-sm ${selectedSort === 'size' ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setSort('size')}
                  style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}
                >
                  Size
                </button>
                <button
                  className={`btn btn-sm ${selectedSort === 'name' ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setSort('name')}
                  style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}
                >
                  Name
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isSearching && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                color: 'var(--text-muted)',
                gap: 12
              }}
            >
              <Loader2 size={32} className="spin" color="var(--color-primary-500)" />
              <span style={{ fontSize: 'var(--font-size-sm)' }}>Searching torrent databases...</span>
            </div>
          )}

          {/* Search Error State */}
          {searchError && !isSearching && (
            <div
              className="card"
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--status-error)',
                backgroundColor: 'rgba(248, 113, 113, 0.08)'
              }}
            >
              <p style={{ margin: 0 }}>{searchError}</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => search()}
                style={{ marginTop: 12 }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Results List */}
          {!isSearching && searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {searchResults.map((item: TorrentSearchResult) => (
                <TorrentSearchResultItem key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* Empty Search Results */}
          {!isSearching && hasSearched && searchResults.length === 0 && !searchError && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                color: 'var(--text-muted)',
                gap: 12
              }}
            >
              <Inbox size={40} strokeWidth={1.5} />
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                No torrents found
              </span>
              <span style={{ fontSize: 'var(--font-size-sm)' }}>
                Try searching with different keywords or switch category filter to "All"
              </span>
            </div>
          )}

          {/* Initial Search Prompt */}
          {!isSearching && !hasSearched && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                color: 'var(--text-muted)',
                gap: 12
              }}
            >
              <Compass size={44} strokeWidth={1.3} color="var(--color-primary-400)" />
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Discover movies, software applications & more
              </span>
              <span style={{ fontSize: 'var(--font-size-sm)', maxWidth: 420, textAlign: 'center' }}>
                Type a movie or application name above to search verified torrent networks, or paste a magnet link to start immediately.
              </span>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Active & Completed Torrents */}
      {viewTab === 'downloads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Aggregate Header Bar */}
          {torrents.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-secondary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span>
                  Total Torrents: <strong>{torrents.length}</strong>
                </span>
                <span>
                  Active: <strong>{activeCount}</strong>
                </span>
              </div>

              {totalDownloadSpeed > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-400)', fontWeight: 600 }}>
                  <HardDrive size={14} />
                  <span>Total Speed: {formatSpeed(totalDownloadSpeed)}</span>
                </div>
              )}
            </div>
          )}

          {/* Torrents List */}
          {torrents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {torrents.map((job: TorrentJob) => (
                <TorrentCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                color: 'var(--text-muted)',
                gap: 12
              }}
            >
              <Inbox size={40} strokeWidth={1.5} />
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                No torrent downloads yet
              </span>
              <span style={{ fontSize: 'var(--font-size-sm)' }}>
                Search for a torrent above or paste a magnet link to start downloading.
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setViewTab('search')}
                style={{ marginTop: 6 }}
              >
                <Search size={14} />
                <span>Search Torrents</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
