import React from 'react';
import { Alert, Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AdsConsent } from 'react-native-google-mobile-ads';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAdsStore } from '../../../ads/adsStore';
import { registerAdsStrings } from '../../../ads/i18n';
import i18n, { initI18n } from '../../i18n';
import { openPrivacyPolicy, PRIVACY_POLICY_URL } from '../../platform/links';
import { SettingsScreen } from '../SettingsScreen';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderSettings() {
  const props = { navigation: { goBack: jest.fn() }, route: { key: 'Settings', name: 'Settings' } } as any;
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SettingsScreen {...props} />
    </SafeAreaProvider>,
  );
}

beforeAll(() => {
  initI18n('en');
  registerAdsStrings();
});

beforeEach(() => {
  jest.restoreAllMocks();
  useAdsStore.getState().set({ privacyOptionsRequired: false, privacyFormOpen: false });
});

describe('Privacy policy link', () => {
  it('opens the published policy from Settings', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderSettings();
    await fireEvent.press(screen.getByText('Privacy policy'));
    expect(open).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
    expect(PRIVACY_POLICY_URL).toMatch(/^https:\/\/docs\.google\.com\/document\/d\/e\/[\w-]+\/pub$/);
  });

  it('shows an alert instead of throwing when the URL cannot be opened', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No Activity found to handle Intent'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await expect(openPrivacyPolicy()).resolves.toBe(false);
    expect(alert).toHaveBeenCalledWith(
      "Couldn't open privacy policy",
      'No app on this device could open the link. Install or enable a web browser, then try again.',
      [{ text: 'OK' }],
    );
  });

  it('handles a failed open from the Settings row', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('blocked'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSettings();
    await fireEvent.press(screen.getByText('Privacy policy'));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
  });

  it('has Urdu strings for the row and the failure alert', () => {
    for (const key of ['privacyPolicy', 'privacyPolicyFailedTitle', 'privacyPolicyFailedBody', 'ok']) {
      expect(i18n.getResource('ur', 'translation', `settings.${key}`)).toEqual(expect.any(String));
    }
  });
});

describe('Privacy choices', () => {
  it('still appears next to the policy link and opens the consent form when required', async () => {
    useAdsStore.getState().set({ privacyOptionsRequired: true });
    await renderSettings();
    expect(screen.getByText('Privacy policy')).toBeTruthy();
    await fireEvent.press(screen.getByText('Privacy choices'));
    await waitFor(() => expect(AdsConsent.showPrivacyOptionsForm).toHaveBeenCalled());
  });

  it('is hidden when the consent form is not required', async () => {
    await renderSettings();
    expect(screen.queryByText('Privacy choices')).toBeNull();
    expect(screen.getByText('Privacy policy')).toBeTruthy();
  });
});
