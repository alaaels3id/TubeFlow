import React, { useEffect } from 'react';
import { Search, Trash2, History as HistoryIcon } from 'lucide-react';
import { HistoryItem } from '../components/history/HistoryItem';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useAppStore } from '../stores/useAppStore';
import { useI18n } from '../../renderer/hooks/useI18n';

export const HistoryPage: React.FC = () => {
  const { history, loadHistory, filter, setFilter, searchQuery, setSearchQuery, clearHistory } =
    useHistoryStore();
  const { openConfirmModal } = useAppStore();
  const { t } = useI18n();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClearHistory = () => {
    openConfirmModal({
      title: t('history.confirmClearTitle'),
      message: t('history.confirmClearMessage'),
      confirmText: t('history.clearHistory'),
      onConfirm: clearHistory
    });
  };

  const filteredHistory = history.filter((item) => {
    const matchesFilter = filter === 'all' || item.status === filter;
    const matchesSearch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.channel && item.channel.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('history.title')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {t('history.subtitle')}
          </p>
        </div>

        {history.length > 0 && (
          <button className="btn btn-secondary" onClick={handleClearHistory} style={{ fontSize: 'var(--font-size-xs)' }}>
            <Trash2 size={14} color="var(--status-error)" />
            <span>{t('history.clearHistory')}</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            className="input-control"
            style={{ paddingInlineStart: 36, height: 38, fontSize: 'var(--font-size-sm)' }}
            placeholder={t('history.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', insetInlineStart: 12, pointerEvents: 'none' }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'completed', 'failed', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f)}
              style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)', height: 38 }}
            >
              {t(`history.filter${f.charAt(0).toUpperCase() + f.slice(1)}` as any)}
            </button>
          ))}
        </div>
      </div>

      {/* History Items List */}
      {filteredHistory.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredHistory.map((item) => (
            <HistoryItem key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <HistoryIcon size={24} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {t('history.empty')}
          </p>
        </div>
      )}
    </div>
  );
};
