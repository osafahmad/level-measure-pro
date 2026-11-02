const info = (canRequestAds: boolean, privacy = 'NOT_REQUIRED') => ({
  status: 'OBTAINED',
  canRequestAds,
  privacyOptionsRequirementStatus: privacy,
  isConsentFormAvailable: true,
});
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

/** Fresh modules per test (new JS runtime), so the once-per-launch guards start clean. */
function load() {
  jest.resetModules();
  require('react-native').AppState.currentState = 'active';
  const ads = require('react-native-google-mobile-ads');
  const permissions = require('react-native-permissions');
  const consent = ads.AdsConsent as Record<string, jest.Mock>;
  consent.gatherConsent.mockResolvedValue(info(true));
  consent.getConsentInfo.mockResolvedValue(info(true));
  consent.getGdprApplies.mockResolvedValue(false);
  consent.getPurposeConsents.mockResolvedValue('');
  (permissions.check as jest.Mock).mockResolvedValue(permissions.RESULTS.DENIED); // ATT not asked yet
  return {
    consent,
    sdk: ads.default() as { initialize: jest.Mock; setRequestConfiguration: jest.Mock },
    check: permissions.check as jest.Mock,
    request: permissions.request as jest.Mock,
    RESULTS: permissions.RESULTS,
    useAdsStore: require('../adsStore').useAdsStore,
    adsConfig: require('../config').adsConfig,
    ...(require('../consent') as typeof import('../consent')),
  };
}

let m: ReturnType<typeof load>;
const phase = () => m.useAdsStore.getState().phase;

beforeEach(() => {
  m = load();
});

describe('consent flow', () => {
  it('may start the SDK from previous consent but never asks ATT or marks ready while UMP is pending', async () => {
    m.consent.gatherConsent.mockReturnValue(new Promise(() => {}));
    m.startAds();
    await flush();
    expect(m.sdk.initialize).toHaveBeenCalledTimes(1);
    expect(m.request).not.toHaveBeenCalled();
    expect(phase()).toBe('consent');
  });

  it('asks ATT after UMP settles, then marks ads ready', async () => {
    m.startAds();
    await flush();
    expect(m.request).toHaveBeenCalledTimes(1);
    expect(m.sdk.initialize).toHaveBeenCalledTimes(1); // memoised across both paths
    expect(phase()).toBe('ready');
  });

  it('an early "cannot request ads" does not block the start after consent', async () => {
    m.consent.getConsentInfo.mockResolvedValueOnce(info(false)).mockResolvedValue(info(true));
    m.startAds();
    await flush();
    expect(m.sdk.initialize).toHaveBeenCalledTimes(1);
    expect(phase()).toBe('ready');
  });

  it('continues with existing consent when gatherConsent fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    m.consent.gatherConsent.mockRejectedValue(new Error('offline'));
    m.startAds();
    await flush();
    expect(phase()).toBe('ready');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('blocks ads when consent does not allow requests', async () => {
    m.consent.getConsentInfo.mockResolvedValue(info(false));
    m.startAds();
    await flush();
    expect(m.sdk.initialize).not.toHaveBeenCalled();
    expect(m.request).not.toHaveBeenCalled();
    expect(phase()).toBe('blocked');
  });

  it('skips ATT when GDPR applies and purpose 1 was refused', async () => {
    m.consent.getGdprApplies.mockResolvedValue(true);
    m.consent.getPurposeConsents.mockResolvedValue('0111');
    m.startAds();
    await flush();
    expect(m.request).not.toHaveBeenCalled();
    expect(phase()).toBe('ready');
  });

  it('does not ask ATT again once it was answered', async () => {
    m.check.mockResolvedValue(m.RESULTS.GRANTED);
    m.startAds();
    await flush();
    expect(m.request).not.toHaveBeenCalled();
  });

  it('records when a privacy options entry point is required', async () => {
    m.consent.getConsentInfo.mockResolvedValue(info(true, 'REQUIRED'));
    m.startAds();
    await flush();
    expect(m.useAdsStore.getState().privacyOptionsRequired).toBe(true);
  });

  it('blocks ads after the privacy options form withdraws consent', async () => {
    m.startAds();
    await flush();
    m.consent.getConsentInfo.mockResolvedValue(info(false, 'REQUIRED'));
    const pending = m.openPrivacyOptions();
    expect(m.useAdsStore.getState().privacyFormOpen).toBe(true);
    await pending;
    expect(m.useAdsStore.getState().privacyFormOpen).toBe(false);
    expect(phase()).toBe('blocked');
  });

  it('passes debug geography to UMP only in __DEV__', async () => {
    const g = globalThis as unknown as { __DEV__: boolean };
    (m.adsConfig.debug as { geography: string | null }).geography = 'EEA';
    m.startAds();
    await flush();
    expect(m.consent.gatherConsent).toHaveBeenLastCalledWith(expect.objectContaining({ debugGeography: 1 }));

    g.__DEV__ = false;
    try {
      m = load();
      (m.adsConfig.debug as { geography: string | null }).geography = 'EEA';
      m.startAds();
      await flush();
      expect(m.consent.gatherConsent.mock.lastCall?.[0]).not.toHaveProperty('debugGeography');
    } finally {
      g.__DEV__ = true;
    }
  });
});
