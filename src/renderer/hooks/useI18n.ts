import { useSettingsStore } from '../stores/useSettingsStore';
import { translate } from '../i18n';

export function useI18n() {
  const language = useSettingsStore((state) => state.settings.language);

  const t = (key: string, params?: Record<string, string | number>) => {
    return translate(language, key, params);
  };

  const isRtl = language === 'ar';

  return { t, language, isRtl };
}
