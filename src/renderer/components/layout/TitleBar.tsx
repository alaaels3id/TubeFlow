import React from 'react';
import { Moon, Sun, Globe } from 'lucide-react';
import { Logo } from '../common/Logo';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useI18n } from '../../hooks/useI18n';

export const TitleBar: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();
  const { t } = useI18n();

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: nextTheme });
  };

  const toggleLanguage = () => {
    const nextLang = settings.language === 'en' ? 'ar' : 'en';
    updateSettings({ language: nextLang });
  };

  return (
    <header className="titlebar drag-region">
      <div className="titlebar-brand no-drag">
        <Logo size={20} />
        <span>{t('app.name')}</span>
      </div>

      <div className="titlebar-actions no-drag">
        {/* Quick Language Toggle */}
        <button
          className="btn btn-ghost btn-icon"
          onClick={toggleLanguage}
          title={settings.language === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
          style={{ height: 28, width: 28, padding: 0 }}
        >
          <Globe size={15} />
        </button>

        {/* Quick Theme Toggle */}
        <button
          className="btn btn-ghost btn-icon"
          onClick={toggleTheme}
          title={settings.theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          style={{ height: 28, width: 28, padding: 0 }}
        >
          {settings.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
};
