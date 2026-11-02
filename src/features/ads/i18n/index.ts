import i18n from 'i18next';
import en from './en.json';
import ur from './ur.json';

let registered = false;

/** Merge the ads strings into the app's single `translation` namespace (after initI18n). */
export function registerAdsStrings() {
  if (registered) return;
  registered = true;
  i18n.addResourceBundle('en', 'translation', en, true, false);
  i18n.addResourceBundle('ur', 'translation', ur, true, false);
}
