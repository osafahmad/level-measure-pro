import type { AppOpenController } from '../appOpen';

type MockAd = {
  adUnitId: string;
  load: jest.Mock;
  show: jest.Mock;
  destroy: jest.Mock;
  emit: (type: string, payload?: unknown) => void;
};
type AppOpenConfig = {
  coldStartWindowMs: number;
  warmStartEnabled: boolean;
  cooldownMs: number;
  maxAdAgeMs: number;
  skipFirstSession: boolean;
};

// MMKV survives a "relaunch" (jest.resetModules) like the real file does; in-memory state does not.
const mockStorage = new Map<string, string>();
let mockSuppressCount = 0;

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    set: (k: string, v: string) => mockStorage.set(k, v),
    getString: (k: string) => mockStorage.get(k),
    remove: (k: string) => mockStorage.delete(k),
    clearAll: () => mockStorage.clear(),
  }),
}));
jest.mock('../suppress', () => ({ isAppOpenSuppressed: () => mockSuppressCount > 0 }));

const HOUR = 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

/**
 * A fresh JS runtime: every module (and its in-memory state) reloads; MMKV storage persists.
 * `config` overrides adsConfig.appOpen for this launch.
 */
function launch(config: Partial<AppOpenConfig> = {}) {
  jest.resetModules();
  const RN = require('react-native');
  RN.AppState.currentState = 'active';
  let appStateListener: ((s: string) => void) | null = null;
  jest.spyOn(RN.AppState, 'addEventListener').mockImplementation((...args: unknown[]) => {
    appStateListener = args[1] as (s: string) => void;
    return { remove: jest.fn() };
  });
  const ads = require('react-native-google-mobile-ads');
  const { useAdsStore } = require('../adsStore');
  const session = require('../session');
  const { createAppOpenController } = require('../appOpen');
  const { adsConfig } = require('../config');
  Object.assign(adsConfig.appOpen as AppOpenConfig, config);
  useAdsStore.setState({ phase: 'ready', privacyFormOpen: false });
  session.launchInfo();
  const Mock = ads.AppOpenAd as { instances: MockAd[]; createForAdRequest: jest.Mock };
  return {
    AdEventType: ads.AdEventType,
    Mock,
    useAdsStore,
    session,
    appOpen: adsConfig.appOpen as AppOpenConfig,
    createAppOpenController,
    lastAd: () => Mock.instances[Mock.instances.length - 1],
    returnFromBackground: () => {
      appStateListener?.('background');
      appStateListener?.('active');
    },
  };
}

let m: ReturnType<typeof launch>;
let route = 'Level';
let controller: AppOpenController | null = null;

function start() {
  controller?.stop();
  controller = m.createAppOpenController({ getRoute: () => route });
}

/** Cold launch with a fresh install: start, let the ad load, and return it. */
function coldLaunchAndLoad(config?: Partial<AppOpenConfig>) {
  m = launch(config);
  start();
  const ad = m.lastAd();
  ad.emit(m.AdEventType.LOADED);
  return ad;
}

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
  route = 'Level';
  mockSuppressCount = 0;
  mockStorage.clear();
});

afterEach(() => {
  controller?.stop();
  controller = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('App Open: cold launch', () => {
  it('shows on the very first launch', () => {
    const ad = coldLaunchAndLoad();
    expect(m.session.launchInfo().sessions).toBe(1);
    expect(ad.adUnitId).toBe('test/app-open'); // __DEV__ → TestIds
    expect(ad.show).toHaveBeenCalledTimes(1);
  });

  it('shows on every cold launch, with no cooldown between them', () => {
    const first = coldLaunchAndLoad();
    first.emit(m.AdEventType.OPENED);
    first.emit(m.AdEventType.CLOSED);
    jest.setSystemTime(T0 + 60_000);
    const second = coldLaunchAndLoad();
    expect(second.show).toHaveBeenCalledTimes(1);
  });

  it('still honours skipFirstSession when it is turned back on', () => {
    expect(coldLaunchAndLoad({ skipFirstSession: true }).show).not.toHaveBeenCalled();
  });

  it('does not request ads until consent made ads ready', () => {
    m = launch();
    m.useAdsStore.setState({ phase: 'consent' });
    start();
    expect(m.Mock.createForAdRequest).not.toHaveBeenCalled();
    m.useAdsStore.setState({ phase: 'ready' });
    expect(m.Mock.createForAdRequest).toHaveBeenCalledTimes(1);
  });

  it('starts the launch window when ads become ready, so consent and ATT do not use it up', () => {
    m = launch();
    m.useAdsStore.setState({ phase: 'consent' });
    start();
    jest.setSystemTime(T0 + 90_000); // a long first-launch consent + ATT flow
    m.useAdsStore.setState({ phase: 'ready' });
    jest.setSystemTime(T0 + 90_000 + m.appOpen.coldStartWindowMs - 1);
    m.lastAd().emit(m.AdEventType.LOADED);
    expect(m.lastAd().show).toHaveBeenCalledTimes(1);
  });

  it('drops an ad that arrives after the window instead of interrupting, and requests no more', () => {
    m = launch();
    start();
    const ad = m.lastAd();
    jest.setSystemTime(T0 + m.appOpen.coldStartWindowMs + 1);
    ad.emit(m.AdEventType.LOADED);
    expect(ad.show).not.toHaveBeenCalled();
    expect(ad.destroy).toHaveBeenCalled();
    m.returnFromBackground();
    expect(m.Mock.createForAdRequest).toHaveBeenCalledTimes(1);
  });

  it('does not treat a JS reload (react-native-restart) as a cold launch', () => {
    m = launch();
    m.session.markJsReload();
    m = launch();
    expect(m.session.launchInfo().kind).toBe('reload');
    start();
    expect(m.Mock.createForAdRequest).not.toHaveBeenCalled();
  });

  it.each([
    ['calibration (another route)', () => (route = 'Calibrate')],
    ['Hold / Save (suppressed)', () => (mockSuppressCount = 1)],
    ['the privacy options form', () => m.useAdsStore.setState({ privacyFormOpen: true })],
  ])('does not show over %s, and uses up the launch attempt', (_label, block) => {
    m = launch();
    start();
    const ad = m.lastAd();
    block();
    ad.emit(m.AdEventType.LOADED);
    expect(ad.show).not.toHaveBeenCalled();
    expect(ad.destroy).toHaveBeenCalled();
  });

  it('survives a show() that rejects', async () => {
    m = launch();
    start();
    const ad = m.lastAd();
    ad.show.mockReturnValueOnce(Promise.reject(new Error('declined')));
    ad.emit(m.AdEventType.LOADED);
    await Promise.resolve();
    await Promise.resolve();
    expect(ad.destroy).toHaveBeenCalled();
  });

  it('drops the held ad and stops loading when consent no longer allows ads', () => {
    m = launch();
    route = 'Calibrate'; // keep the cold attempt from showing it
    start();
    const ad = m.lastAd();
    m.useAdsStore.setState({ phase: 'blocked' });
    expect(ad.destroy).toHaveBeenCalled();
    m.useAdsStore.setState({ phase: 'ready' });
    m.lastAd().emit(m.AdEventType.LOADED);
    expect(m.Mock.createForAdRequest).toHaveBeenCalledTimes(2);
  });
});

describe('App Open: warm start', () => {
  it('never shows when returning from the background while warmStartEnabled is false', () => {
    const ad = coldLaunchAndLoad();
    ad.emit(m.AdEventType.CLOSED);
    jest.setSystemTime(T0 + 5 * HOUR);
    m.returnFromBackground();
    expect(m.Mock.createForAdRequest).toHaveBeenCalledTimes(1); // nothing preloaded or requested
  });

  describe('when enabled', () => {
    const warm = { warmStartEnabled: true };

    it('applies the cooldown, then shows a fresh ad', () => {
      const first = coldLaunchAndLoad(warm);
      first.emit(m.AdEventType.OPENED);
      first.emit(m.AdEventType.CLOSED);
      const second = m.lastAd();
      expect(second).not.toBe(first); // preloaded for the next warm start
      second.emit(m.AdEventType.LOADED);

      jest.setSystemTime(T0 + 3 * HOUR + 59 * 60 * 1000);
      m.returnFromBackground();
      expect(second.show).not.toHaveBeenCalled();

      jest.setSystemTime(T0 + 4 * HOUR + 1); // cooldown over; the held ad is now too old
      m.returnFromBackground();
      expect(second.show).not.toHaveBeenCalled();
      expect(second.destroy).toHaveBeenCalled();
      const third = m.lastAd();
      third.emit(m.AdEventType.LOADED);
      m.returnFromBackground();
      expect(third.show).toHaveBeenCalledTimes(1);
    });

    it('after a relaunch the cold launch ignores the cooldown; only the warm start respects it', () => {
      const first = coldLaunchAndLoad(warm);
      first.emit(m.AdEventType.OPENED);
      first.emit(m.AdEventType.CLOSED);

      jest.setSystemTime(T0 + HOUR); // well inside the 4 h cooldown
      const cold = coldLaunchAndLoad(warm);
      expect(cold.show).toHaveBeenCalledTimes(1); // cold launches have no cooldown
      cold.emit(m.AdEventType.OPENED);
      cold.emit(m.AdEventType.CLOSED);
      const next = m.lastAd();
      next.emit(m.AdEventType.LOADED);

      jest.setSystemTime(T0 + 2 * HOUR);
      m.returnFromBackground();
      expect(next.show).not.toHaveBeenCalled(); // warm start: still inside the cooldown
    });

    it('ignores the foreground event caused by closing the ad itself (Android)', () => {
      const first = coldLaunchAndLoad({ ...warm, cooldownMs: 0 });
      first.emit(m.AdEventType.CLOSED);
      m.lastAd().emit(m.AdEventType.LOADED);
      m.returnFromBackground();
      expect(m.lastAd().show).not.toHaveBeenCalled();
    });

    it('retries a failed load on the next warm start, not in a loop', () => {
      m = launch(warm);
      start();
      m.lastAd().emit(m.AdEventType.ERROR, new Error('no-fill'));
      expect(m.Mock.createForAdRequest).toHaveBeenCalledTimes(1);
      m.returnFromBackground();
      expect(m.Mock.createForAdRequest).toHaveBeenCalledTimes(2);
    });
  });
});
