describe('ads config', () => {
  it('ships with production ads (test ads only in __DEV__)', () => {
    const { adsConfig } = require('../config');
    // Flip only for an internal/TestFlight build, never commit it as true.
    expect(adsConfig.testAdsInRelease).toBe(false);
  });

  it('uses production units and no test devices in a release build', () => {
    const g = globalThis as unknown as { __DEV__: boolean };
    g.__DEV__ = false;
    try {
      jest.isolateModules(() => {
        const { unitId, testDeviceIds, debugGeography } = require('../config');
        expect(unitId('banner')).toBe('ca-app-pub-4778063590683599/5451895391');
        expect(unitId('appOpen')).toBe('ca-app-pub-4778063590683599/5930445534');
        expect(testDeviceIds('mobileAds')).toEqual([]);
        expect(debugGeography()).toBeUndefined();
      });
    } finally {
      g.__DEV__ = true;
    }
  });

  it('uses Google test units in development', () => {
    const { unitId } = require('../config');
    expect(unitId('banner')).toBe('test/banner');
    expect(unitId('appOpen')).toBe('test/app-open');
  });
});
