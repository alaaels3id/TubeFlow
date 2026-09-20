import React, { useEffect, useState } from 'react';
import {
  Folder,
  Palette,
  Globe,
  Sliders,
  Bell,
  Cpu,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Type,
  FileText,
  ExternalLink,
  ArrowUpCircle,
  RefreshCw,
  DownloadCloud,
  Sparkles
} from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useAppStore } from '../stores/useAppStore';
import { useUpdaterStore } from '../stores/useUpdaterStore';
import { useI18n } from '../hooks/useI18n';
import { formatBytes } from '../utils/format';
import { formatReleaseNotes } from '../utils/formatReleaseNotes';
import { ThemeMode, FontSize, Language, DuplicateAction } from '@shared/types';

import { Logo } from '../components/common/Logo';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    selectDownloadDirectory,
    dependencies,
    loadDependencies
  } = useSettingsStore();

  const {
    currentVersion,
    state: updaterState,
    updateInfo,
    progress: updateProgress,
    error: updaterError,
    isChecking,
    isDownloading,
    checkForUpdates,
    downloadUpdate,
    installUpdate
  } = useUpdaterStore();

  const { addToast } = useAppStore();
  const { t } = useI18n();

  const [logPath, setLogPath] = useState<string>('');

  useEffect(() => {
    loadDependencies();
    if (window.api && window.api.logger) {
      window.api.logger.getPath().then(setLogPath).catch(() => {});
    }
  }, [loadDependencies]);

  const handleUpdate = async (partial: any) => {
    await updateSettings(partial);
    addToast(t('settings.saveSuccess'), 'success');
  };

  const handleOpenLogs = async () => {
    try {
      if (window.api && window.api.logger) {
        await window.api.logger.openFolder();
        addToast(settings.language === 'ar' ? 'تم فتح مجلد السجلات' : 'Opened logs folder', 'success');
      }
    } catch (e: any) {
      addToast(e.message || 'Failed to open logs', 'error');
    }
  };

  const handleTestLog = async () => {
    try {
      if (window.api && window.api.logger) {
        await window.api.logger.info('Test log entry from Settings page (معلومات)');
        await window.api.logger.warn('Test warning entry from Settings page (تحذير)');
        await window.api.logger.error('Test error/exception log entry (خطأ تجريبي)', new Error('Simulated Test Exception'));
        addToast(settings.language === 'ar' ? 'تمت كتابة رسائل الاختبار في ملف السجلات بنجاح!' : 'Test logs written to log file successfully!', 'success');
      }
    } catch (e: any) {
      addToast(e.message || 'Failed to write test log', 'error');
    }
  };

  const handleSendTestNotification = async () => {
    try {
      if (window.api && window.api.notifications) {
        await window.api.notifications.show(
          t('settings.testNotificationTitle'),
          t('settings.testNotificationBody')
        );
        addToast(t('settings.testNotificationSent'), 'success');
      }
    } catch (e: any) {
      addToast(e.message || 'Failed to send test notification', 'error');
    }
  };

  return (
    <div className="main-content" style={{ width: '100%', maxWidth: 'none', boxSizing: 'border-box' }}>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('settings.title')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {t('settings.subtitle')}
        </p>
      </div>

      {/* 1. General Settings */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-primary)'
          }}
        >
          <Folder size={18} color="var(--color-primary-500)" />
          <span>{t('settings.general')}</span>
        </h3>

        {/* Download Location */}
        <div className="input-group">
          <label className="input-label">{t('settings.downloadDirectory')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              readOnly
              className="input-control"
              value={settings.downloadDirectory || '~/Downloads'}
            />
            <button className="btn btn-secondary" onClick={selectDownloadDirectory}>
              {t('settings.chooseDirectory')}
            </button>
          </div>
        </div>

        {/* Notifications Toggle & Test Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
              {t('settings.notifications')}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
              {t('settings.notificationsDesc')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {settings.notifications && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSendTestNotification}
                style={{ padding: '5px 12px', fontSize: 'var(--font-size-xs)', height: 32, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Logo size={16} />
                <span>{t('settings.sendTestNotification')}</span>
              </button>
            )}
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => handleUpdate({ notifications: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Confirm Delete Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
              {t('settings.confirmDelete')}
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.confirmBeforeDelete}
            onChange={(e) => handleUpdate({ confirmBeforeDelete: e.target.checked })}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* 2. Appearance & Font Size */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-primary)'
          }}
        >
          <Palette size={18} color="var(--color-primary-500)" />
          <span>{t('settings.appearance')}</span>
        </h3>

        {/* Theme Mode */}
        <div className="input-group">
          <label className="input-label">{t('settings.theme')}</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {(['dark', 'light', 'system'] as ThemeMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`btn ${settings.theme === m ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleUpdate({ theme: m })}
                style={{ padding: '10px 14px' }}
              >
                {m === 'dark'
                  ? t('settings.themeDark')
                  : m === 'light'
                  ? t('settings.themeLight')
                  : t('settings.themeSystem')}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div className="input-group">
          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Type size={14} />
            <span>{t('settings.fontSize')}</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {(['small', 'medium', 'large', 'xlarge'] as FontSize[]).map((size) => (
              <button
                key={size}
                type="button"
                className={`btn ${settings.fontSize === size ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleUpdate({ fontSize: size })}
                style={{ padding: '8px 10px', fontSize: 'var(--font-size-xs)' }}
              >
                {size === 'small'
                  ? t('settings.fontSmall')
                  : size === 'medium'
                  ? t('settings.fontMedium')
                  : size === 'large'
                  ? t('settings.fontLarge')
                  : t('settings.fontXLarge')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Language & Internationalization */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-primary)'
          }}
        >
          <Globe size={18} color="var(--color-primary-500)" />
          <span>{t('settings.language')}</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <button
            type="button"
            className={`btn ${settings.language === 'en' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleUpdate({ language: 'en' })}
            style={{ padding: '12px' }}
          >
            <span>English (LTR)</span>
          </button>

          <button
            type="button"
            className={`btn ${settings.language === 'ar' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleUpdate({ language: 'ar' })}
            style={{ padding: '12px' }}
          >
            <span>العربية (RTL)</span>
          </button>
        </div>
      </div>

      {/* 4. Downloads & Concurrency */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-primary)'
          }}
        >
          <Sliders size={18} color="var(--color-primary-500)" />
          <span>{t('settings.downloads')}</span>
        </h3>

        {/* Concurrency Limit */}
        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label className="input-label">{t('settings.concurrency')}</label>
            <span style={{ fontWeight: 700, color: 'var(--color-primary-500)' }}>
              {settings.concurrentDownloads}
            </span>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            {t('settings.concurrencyDesc')}
          </p>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={settings.concurrentDownloads}
            onChange={(e) => handleUpdate({ concurrentDownloads: parseInt(e.target.value, 10) })}
            style={{ width: '100%', accentColor: 'var(--color-primary-500)', cursor: 'pointer' }}
          />
        </div>

        {/* Duplicate Action */}
        <div className="input-group">
          <label className="input-label">{t('settings.duplicateAction')}</label>
          <select
            className="select-control"
            value={settings.duplicateAction}
            onChange={(e) => handleUpdate({ duplicateAction: e.target.value as DuplicateAction })}
          >
            <option value="copy">{t('settings.duplicateCopy')}</option>
            <option value="replace">{t('settings.duplicateReplace')}</option>
            <option value="skip">{t('settings.duplicateSkip')}</option>
          </select>
        </div>
      </div>

      {/* 5. About & Dependencies */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-primary)'
          }}
        >
          <Cpu size={18} color="var(--color-primary-500)" />
          <span>{t('settings.about')}</span>
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
          <Logo size={44} />
          <div>
            <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--text-primary)' }}>
              TubeFlow Desktop
            </h4>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
              Version 1.0.0 • Modern YouTube Media Manager
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* yt-dlp Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                {t('settings.ytDlpStatus')}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {dependencies?.ytDlp?.path || 'bin/yt-dlp'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {dependencies?.ytDlp?.available ? (
                <span className="badge badge-success">
                  <CheckCircle2 size={12} />
                  <span>{dependencies.ytDlp.version || t('settings.installed')}</span>
                </span>
              ) : (
                <span className="badge badge-warning">
                  <AlertCircle size={12} />
                  <span>{t('settings.missing')}</span>
                </span>
              )}
            </div>
          </div>

          {/* FFmpeg Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                {t('settings.ffmpegStatus')}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {dependencies?.ffmpeg?.path || '/opt/homebrew/bin/ffmpeg'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {dependencies?.ffmpeg?.available ? (
                <span className="badge badge-success">
                  <CheckCircle2 size={12} />
                  <span>{dependencies.ffmpeg.version || t('settings.installed')}</span>
                </span>
              ) : (
                <span className="badge badge-warning">
                  <AlertCircle size={12} />
                  <span>{t('settings.missing')}</span>
                </span>
              )}
            </div>
          </div>

          {/* System & Error Logs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              flexWrap: 'wrap',
              gap: 10
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={15} color="var(--color-primary-500)" />
                <span>{settings.language === 'ar' ? 'سجل النظام والأخطاء (Console & Error Logs)' : 'System & Error Logs'}</span>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2, wordBreak: 'break-all' }}>
                {logPath || 'logs/app.log'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTestLog}
                style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)', height: 32 }}
                title="Write a test log and simulated exception to app.log"
              >
                <span>{settings.language === 'ar' ? 'تسجيل رسالة اختبار' : 'Test Log'}</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenLogs}
                style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)', height: 32, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ExternalLink size={13} />
                <span>{settings.language === 'ar' ? 'فتح مجلد السجلات' : 'Open Logs'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Application Updates */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowUpCircle size={20} color="var(--color-primary-500)" />
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700 }}>
              {t('updater.title')}
            </h3>
          </div>
          <span className="badge badge-info" style={{ fontSize: '12px' }}>
            v{currentVersion}
          </span>
        </div>

        <div
          style={{
            padding: 16,
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {updaterState === 'downloaded' ? (
                  <>
                    <CheckCircle2 size={16} color="var(--color-success, #10b981)" />
                    <span style={{ color: 'var(--color-success, #10b981)' }}>{t('updater.updateDownloaded')}</span>
                  </>
                ) : updaterState === 'available' ? (
                  <>
                    <Sparkles size={16} color="var(--color-primary-500)" />
                    <span style={{ color: 'var(--text-primary)' }}>
                      {t('updater.updateAvailable', { version: updateInfo?.version || '' })}
                    </span>
                  </>
                ) : updaterState === 'checking' ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" color="var(--color-primary-500)" />
                    <span>{t('updater.checking')}</span>
                  </>
                ) : updaterState === 'downloading' ? (
                  <>
                    <DownloadCloud size={16} className="animate-pulse" color="var(--color-primary-500)" />
                    <span>{t('updater.downloading', { percent: updateProgress?.percent || 0 })}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} color="var(--color-success, #10b981)" />
                    <span>{t('updater.upToDate', { version: currentVersion })}</span>
                  </>
                )}
              </div>

              {updaterState === 'downloaded' && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 4 }}>
                  {t('updater.macInstallNotice')}
                </div>
              )}

              {updaterError && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger, #ef4444)', marginTop: 4 }}>
                  {updaterError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {updaterState === 'downloaded' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={installUpdate}
                  style={{ height: 34, fontSize: 'var(--font-size-xs)' }}
                >
                  <RefreshCw size={14} />
                  <span>{t('updater.installAndRestart')}</span>
                </button>
              ) : updaterState === 'available' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={downloadUpdate}
                  disabled={isDownloading}
                  style={{ height: 34, fontSize: 'var(--font-size-xs)' }}
                >
                  <DownloadCloud size={14} />
                  <span>{t('updater.downloadUpdate')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={checkForUpdates}
                  disabled={isChecking}
                  style={{ height: 34, fontSize: 'var(--font-size-xs)' }}
                >
                  <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
                  <span>{isChecking ? t('updater.checking') : t('updater.checkForUpdates')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress bar while downloading */}
          {updaterState === 'downloading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <div
                style={{
                  height: 6,
                  width: '100%',
                  backgroundColor: 'var(--border-subtle)',
                  borderRadius: 3,
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${updateProgress?.percent || 0}%`,
                    backgroundColor: 'var(--color-primary-500)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>{updateProgress?.percent || 0}%</span>
                <span>
                  {formatBytes(updateProgress?.transferred || 0)} / {formatBytes(updateProgress?.total || 0)}
                </span>
              </div>
            </div>
          )}

          {/* Release Notes preview */}
          {updateInfo?.releaseNotes && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                maxHeight: 180,
                overflowY: 'auto'
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="var(--color-primary-500)" />
                <span>{t('updater.releaseNotes')} ({updateInfo.version}):</span>
              </div>
              <div
                className="release-notes-content"
                dangerouslySetInnerHTML={{ __html: formatReleaseNotes(updateInfo.releaseNotes) }}
              />
            </div>
          )}
        </div>

        {/* Legal notice */}
        <div
          style={{
            marginTop: 4,
            padding: 12,
            backgroundColor: 'rgba(178, 58, 72, 0.08)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            gap: 10,
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-secondary)',
            lineHeight: 1.5
          }}
        >
          <ShieldCheck size={18} color="var(--color-primary-500)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>TubeFlow v{currentVersion}</strong> — {t('app.disclaimer')}
          </div>
        </div>
      </div>
    </div>
  );
};
