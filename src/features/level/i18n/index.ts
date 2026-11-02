import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import { findBestLanguageTag } from 'react-native-localize';
import en from './en.json';
import ur from './ur.json';

export type Language = 'en' | 'ur';

export function deviceLanguage(): Language {
  return findBestLanguageTag(['en', 'ur'])?.languageTag === 'ur' ? 'ur' : 'en';
}

export const isRTL = (lang: Language) => lang === 'ur';

/** True when the running layout direction already matches the language. */
export const directionMatches = (lang: Language) => I18nManager.isRTL === isRTL(lang);

/**
 * Persist the layout direction for the language. It takes effect on the next app start.
 * Left/right stay physical so instrument geometry and "raise left side" are never mirrored.
 */
export function applyDirection(lang: Language) {
  I18nManager.allowRTL(true);
  I18nManager.swapLeftAndRightInRTL(false);
  I18nManager.forceRTL(isRTL(lang));
}

export function initI18n(lang: Language) {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources: { en: { translation: en }, ur: { translation: ur } },
      lng: lang,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  applyDirection(lang);
  return i18n;
}

export default i18n;
