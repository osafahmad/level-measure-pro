import { Alert, Linking } from 'react-native';
import i18n from '../i18n';

/** Published Google Doc. The same URL is the Privacy Policy URL in App Store Connect and Play Console. */
export const PRIVACY_POLICY_URL =
  'https://docs.google.com/document/d/e/2PACX-1vTHUNHzffSwhHhfbv-wOhVjGAjkYH9QR44gcPuSEhaDmTegQYQQeIuyoetR9dndXijMVg5EGBSd-laI/pub';

/**
 * Opens the privacy policy in the browser. No canOpenURL check: on Android 11+ it reports false
 * for https unless the manifest declares <queries>. openURL rejects when nothing can handle the
 * link (no browser, or one disabled); that shows an alert instead of throwing.
 */
export async function openPrivacyPolicy(): Promise<boolean> {
  try {
    await Linking.openURL(PRIVACY_POLICY_URL);
    return true;
  } catch {
    Alert.alert(i18n.t('settings.privacyPolicyFailedTitle'), i18n.t('settings.privacyPolicyFailedBody'), [
      { text: i18n.t('settings.ok') },
    ]);
    return false;
  }
}
