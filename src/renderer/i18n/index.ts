import { en } from './en';
import { ar } from './ar';
import { Language } from '@shared/types';

export const translations = { en, ar };

export type TranslationKey = string;

// Helper to access nested objects by key string 'dashboard.title'
export function getNestedTranslation(obj: any, path: string): string {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}

export function translate(lang: Language, key: string, params?: Record<string, string | number>): string {
  const dict = translations[lang] || translations.en;
  let text = getNestedTranslation(dict, key);
  
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value));
    });
  }
  
  return text;
}
