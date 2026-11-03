// GDPR debug settings (scripts/gdpr-debug.sh) must only ever affect __DEV__ builds.
export {};

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

function load(dev: boolean) {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = dev;
  jest.resetModules();
  require('react-native').AppState.currentState = 'active';
  const ads = require('react-native-google-mobile-ads');
  const { adsConfig } = require('../config');
  Object.assign(adsConfig.debug, { geography: 'EEA', resetConsentOnLaunch: true });
  return { consent: ads.AdsConsent as Record<string, jest.Mock>, ...(require('../consent') as typeof import('../consent')) };
}

afterEach(() => {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;
});

describe('GDPR debug settings', () => {
  it('apply in __DEV__: EEA geography is sent to UMP and consent is reset on launch', async () => {
    const m = load(true);
    m.startAds();
    await flush();
    expect(m.consent.reset).toHaveBeenCalledTimes(1);
    expect(m.consent.gatherConsent).toHaveBeenLastCalledWith(expect.objectContaining({ debugGeography: 1 }));
  });

  it('are ignored in a release build even when left on', async () => {
    const m = load(false);
    m.startAds();
    await flush();
    expect(m.consent.reset).not.toHaveBeenCalled();
    expect(m.consent.gatherConsent.mock.lastCall?.[0]).not.toHaveProperty('debugGeography');
    expect(m.consent.gatherConsent.mock.lastCall?.[0]).not.toHaveProperty('testDeviceIdentifiers');
  });
});
