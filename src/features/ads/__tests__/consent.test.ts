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
  const RN = require('react-native');
  RN.AppState.currentState = 'active';
  const appStateListeners = new Set<(s: string) => void>();
  jest.spyOn(RN.AppState, 'addEventListener').mockImplementation((...args: unknown[]) => {
    const fn = args[1] as (s: string) => void;
    appStateListeners.add(fn);
    return { remove: () => appStateListeners.delete(fn) };
  });
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
    createForAdRequest: ads.AppOpenAd.createForAdRequest as jest.Mock,
    setAppState: (next: string) => {
      RN.AppState.currentState = next;
      [...appStateListeners].forEach(fn => fn(next));
    },
    adsConfig: require('../config').adsConfig,
    ...(require('../consent') as typeof import('../consent')),
  };
}

let m: ReturnType<typeof load>;
const phase = () => m.useAdsStore.getState().phase;

beforeEach(() => {
  m = load();
});

afterEach(() => {
  jest.restoreAllMocks();
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

describe('prewarmAds (runs under the splash)', () => {
  it('does nothing on a fresh install, when no previous consent allows ads', async () => {
    m.consent.getConsentInfo.mockResolvedValue(info(false));
    m.prewarmAds();
    await flush();
    expect(m.sdk.initialize).not.toHaveBeenCalled();
    expect(phase()).toBe('idle');
  });

  it('only starts the SDK from previous consent: no UI, no ad request, never marks ads ready', async () => {
    m.prewarmAds();
    await flush();
    expect(m.sdk.initialize).toHaveBeenCalledTimes(1);
    expect(m.consent.gatherConsent).not.toHaveBeenCalled();
    expect(m.request).not.toHaveBeenCalled();
    expect(m.createForAdRequest).not.toHaveBeenCalled();
    expect(phase()).toBe('idle');
    expect(m.useAdsStore.getState().sdkInitialized).toBe(true);
  });

  it('never initializes the SDK twice once startAds runs after it', async () => {
    m.prewarmAds();
    await flush();
    m.startAds();
    await flush();
    expect(m.sdk.initialize).toHaveBeenCalledTimes(1);
    expect(m.consent.getConsentInfo).toHaveBeenCalledTimes(2); // prewarm + settle, not a second prewarm
    expect(phase()).toBe('ready');
  });

  it('retries once in settle when the prewarm init failed', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    m.sdk.initialize.mockRejectedValueOnce(new Error('init failed'));
    m.prewarmAds();
    await flush();
    m.startAds();
    await flush();
    expect(m.sdk.initialize).toHaveBeenCalledTimes(2);
    expect(phase()).toBe('ready');
    warn.mockRestore();
  });

  it('swallows a consent read failure', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    m.consent.getConsentInfo.mockRejectedValue(new Error('broken'));
    expect(() => m.prewarmAds()).not.toThrow();
    await flush();
    expect(m.sdk.initialize).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does nothing when ads are disabled', async () => {
    (m.adsConfig as { enabled: boolean }).enabled = false;
    m.prewarmAds();
    await flush();
    expect(m.consent.getConsentInfo).not.toHaveBeenCalled();
    expect(m.sdk.initialize).not.toHaveBeenCalled();
  });
});

describe('ATT timing', () => {
  it('requests ATT only once the app is active', async () => {
    m.setAppState('inactive');
    m.startAds();
    await flush();
    expect(m.request).not.toHaveBeenCalled();
    m.setAppState('active');
    await flush();
    expect(m.request).toHaveBeenCalledTimes(1);
    expect(phase()).toBe('ready');
  });
});
