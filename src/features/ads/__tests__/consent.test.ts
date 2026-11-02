import { AppState } from 'react-native';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';
import { check, request, RESULTS } from 'react-native-permissions';
import { useAdsStore } from '../adsStore';
import { adsConfig } from '../config';
import { __resetConsentForTests, openPrivacyOptions, startAds } from '../consent';

const consent = AdsConsent as unknown as Record<string, jest.Mock>;
const sdk = mobileAds() as unknown as { initialize: jest.Mock; setRequestConfiguration: jest.Mock };
const info = (canRequestAds: boolean, privacy = 'NOT_REQUIRED') => ({
  status: 'OBTAINED',
  canRequestAds,
  privacyOptionsRequirementStatus: privacy,
  isConsentFormAvailable: true,
});
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.clearAllMocks();
  (AppState as { currentState: string }).currentState = 'active';
  __resetConsentForTests();
  useAdsStore.setState({ phase: 'idle', sdkInitialized: false, privacyOptionsRequired: false, privacyFormOpen: false });
  consent.gatherConsent.mockResolvedValue(info(true));
  consent.getConsentInfo.mockResolvedValue(info(true));
  consent.getGdprApplies.mockResolvedValue(false);
  consent.getPurposeConsents.mockResolvedValue('');
  (check as jest.Mock).mockResolvedValue(RESULTS.DENIED); // ATT not asked yet
});

describe('consent flow', () => {
  it('may start the SDK from previous consent but never asks ATT or marks ready while UMP is pending', async () => {
    consent.gatherConsent.mockReturnValue(new Promise(() => {}));
    startAds();
    await flush();
    expect(sdk.initialize).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
    expect(useAdsStore.getState().phase).toBe('consent');
  });

  it('asks ATT after UMP settles, then marks ads ready', async () => {
    startAds();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(sdk.initialize).toHaveBeenCalledTimes(1); // memoised across both paths
    expect(useAdsStore.getState().phase).toBe('ready');
  });

  it('an early "cannot request ads" does not block the start after consent', async () => {
    consent.getConsentInfo.mockResolvedValueOnce(info(false)).mockResolvedValue(info(true));
    startAds();
    await flush();
    expect(sdk.initialize).toHaveBeenCalledTimes(1);
    expect(useAdsStore.getState().phase).toBe('ready');
  });

  it('continues with existing consent when gatherConsent fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consent.gatherConsent.mockRejectedValue(new Error('offline'));
    startAds();
    await flush();
    expect(useAdsStore.getState().phase).toBe('ready');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('blocks ads when consent does not allow requests', async () => {
    consent.getConsentInfo.mockResolvedValue(info(false));
    startAds();
    await flush();
    expect(sdk.initialize).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(useAdsStore.getState().phase).toBe('blocked');
  });

  it('skips ATT when GDPR applies and purpose 1 was refused', async () => {
    consent.getGdprApplies.mockResolvedValue(true);
    consent.getPurposeConsents.mockResolvedValue('0111');
    startAds();
    await flush();
    expect(request).not.toHaveBeenCalled();
    expect(useAdsStore.getState().phase).toBe('ready');
  });

  it('does not ask ATT again once it was answered', async () => {
    (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
    startAds();
    await flush();
    expect(request).not.toHaveBeenCalled();
  });

  it('records when a privacy options entry point is required', async () => {
    consent.getConsentInfo.mockResolvedValue(info(true, 'REQUIRED'));
    startAds();
    await flush();
    expect(useAdsStore.getState().privacyOptionsRequired).toBe(true);
  });

  it('blocks ads after the privacy options form withdraws consent', async () => {
    startAds();
    await flush();
    consent.getConsentInfo.mockResolvedValue(info(false, 'REQUIRED'));
    const pending = openPrivacyOptions();
    expect(useAdsStore.getState().privacyFormOpen).toBe(true);
    await pending;
    expect(useAdsStore.getState().privacyFormOpen).toBe(false);
    expect(useAdsStore.getState().phase).toBe('blocked');
  });

  it('passes debug geography to UMP only in __DEV__', async () => {
    const debug = adsConfig.debug as { geography: string | null };
    const g = globalThis as unknown as { __DEV__: boolean };
    debug.geography = 'EEA';
    try {
      startAds();
      await flush();
      expect(consent.gatherConsent).toHaveBeenLastCalledWith(expect.objectContaining({ debugGeography: 1 }));

      __resetConsentForTests();
      g.__DEV__ = false;
      startAds();
      await flush();
      expect(consent.gatherConsent.mock.lastCall?.[0]).not.toHaveProperty('debugGeography');
    } finally {
      g.__DEV__ = true;
      debug.geography = null;
    }
  });
});
