import { AppState } from 'react-native';
import { AdEventType, AppOpenAd } from 'react-native-google-mobile-ads';
import { useAdsStore } from '../adsStore';
import { createAppOpenController, type AppOpenController } from '../appOpen';
import { adsConfig } from '../config';
import { __resetSessionForTests, appOpenShownAt, launchInfo, markJsReload } from '../session';

type MockAd = {
  adUnitId: string;
  load: jest.Mock;
  show: jest.Mock;
  destroy: jest.Mock;
  emit: (type: string, payload?: unknown) => void;
};
const Mock = AppOpenAd as unknown as { instances: MockAd[]; createForAdRequest: jest.Mock };

const HOUR = 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

let appStateListener: ((s: string) => void) | null = null;
let route = 'Level';
let controller: AppOpenController | null = null;
let mockSuppressCount = 0;

jest.mock('../suppress', () => ({ isAppOpenSuppressed: () => mockSuppressCount > 0 }));

const lastAd = () => Mock.instances[Mock.instances.length - 1];
const goBackground = () => appStateListener?.('background');
const goForeground = () => appStateListener?.('active');

/** A second (or later) cold launch, so the first-session skip does not apply. */
function secondLaunch() {
  __resetSessionForTests();
  launchInfo();
  __resetSessionForTests(false);
  launchInfo();
}

function start() {
  controller = createAppOpenController({ getRoute: () => route });
}

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
  Mock.instances.length = 0;
  Mock.createForAdRequest.mockClear();
  route = 'Level';
  mockSuppressCount = 0;
  (AppState as { currentState: string }).currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
    appStateListener = fn as (s: string) => void;
    return { remove: jest.fn() } as never;
  });
  useAdsStore.setState({ phase: 'ready', privacyFormOpen: false });
  secondLaunch();
});

afterEach(() => {
  controller?.stop();
  controller = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('App Open controller', () => {
  it('does not request ads until consent made ads ready', () => {
    useAdsStore.setState({ phase: 'consent' });
    start();
    expect(Mock.createForAdRequest).not.toHaveBeenCalled();
    useAdsStore.setState({ phase: 'ready' });
    expect(Mock.createForAdRequest).toHaveBeenCalledTimes(1);
    expect(lastAd().adUnitId).toBe('test/app-open'); // __DEV__ → TestIds
  });

  it('shows on a cold start when the ad is ready inside the launch window', () => {
    start();
    lastAd().emit(AdEventType.LOADED);
    expect(lastAd().show).toHaveBeenCalledTimes(1);
  });

  it('keeps a late cold-start ad for the next foreground instead of interrupting', () => {
    start();
    jest.setSystemTime(T0 + adsConfig.appOpen.coldStartWindowMs + 1);
    const ad = lastAd();
    ad.emit(AdEventType.LOADED);
    expect(ad.show).not.toHaveBeenCalled();
    goBackground();
    goForeground();
    expect(ad.show).toHaveBeenCalledTimes(1);
  });

  it('never shows during the first session', () => {
    __resetSessionForTests();
    launchInfo();
    start();
    lastAd().emit(AdEventType.LOADED);
    goBackground();
    goForeground();
    expect(lastAd().show).not.toHaveBeenCalled();
  });

  it('does not treat a JS reload (react-native-restart) as a cold start', () => {
    markJsReload();
    __resetSessionForTests(false);
    expect(launchInfo().kind).toBe('reload');
    expect(launchInfo().sessions).toBe(2); // the reload did not count as a new session
    start();
    lastAd().emit(AdEventType.LOADED);
    expect(lastAd().show).not.toHaveBeenCalled();
  });

  it('enforces the cooldown and preloads the next ad after closing', () => {
    start();
    const first = lastAd();
    first.emit(AdEventType.LOADED);
    first.emit(AdEventType.OPENED);
    expect(appOpenShownAt()).toBe(T0);
    first.emit(AdEventType.CLOSED);
    expect(first.destroy).toHaveBeenCalled();
    const second = lastAd();
    expect(second).not.toBe(first);
    second.emit(AdEventType.LOADED);

    jest.setSystemTime(T0 + 3 * HOUR);
    goBackground();
    goForeground();
    expect(second.show).not.toHaveBeenCalled();

    jest.setSystemTime(T0 + 3 * HOUR + 59 * 60 * 1000); // ad is still < 4 h old
    goBackground();
    goForeground();
    expect(second.show).not.toHaveBeenCalled();

    // Cooldown over: the now-expired ad is replaced, and the fresh one shows on the next return.
    jest.setSystemTime(T0 + 4 * HOUR + 1);
    goBackground();
    goForeground();
    expect(second.show).not.toHaveBeenCalled();
    const third = lastAd();
    expect(third).not.toBe(second);
    third.emit(AdEventType.LOADED);
    goBackground();
    goForeground();
    expect(third.show).toHaveBeenCalledTimes(1);
  });

  it('discards an ad older than four hours and loads a fresh one', () => {
    jest.setSystemTime(T0 + adsConfig.appOpen.coldStartWindowMs + 1);
    start();
    const stale = lastAd();
    stale.emit(AdEventType.LOADED);
    jest.setSystemTime(T0 + 5 * HOUR);
    goBackground();
    goForeground();
    expect(stale.show).not.toHaveBeenCalled();
    expect(stale.destroy).toHaveBeenCalled();
    expect(lastAd()).not.toBe(stale);
    expect(lastAd().load).toHaveBeenCalled();
  });

  it.each([
    ['calibration (another route)', () => (route = 'Calibrate')],
    ['Hold / Save (suppressed)', () => (mockSuppressCount = 1)],
    ['the privacy options form', () => useAdsStore.setState({ privacyFormOpen: true })],
  ])('does not show over %s', (_label, block) => {
    jest.setSystemTime(T0 + adsConfig.appOpen.coldStartWindowMs + 1);
    start();
    const ad = lastAd();
    ad.emit(AdEventType.LOADED);
    block();
    goBackground();
    goForeground();
    expect(ad.show).not.toHaveBeenCalled();
  });

  it('ignores the foreground event caused by closing the ad itself (Android)', () => {
    start();
    const first = lastAd();
    first.emit(AdEventType.LOADED);
    first.emit(AdEventType.CLOSED);
    lastAd().emit(AdEventType.LOADED);
    goBackground();
    goForeground();
    expect(lastAd().show).not.toHaveBeenCalled();
  });

  it('drops the held ad and stops loading when consent no longer allows ads', () => {
    jest.setSystemTime(T0 + adsConfig.appOpen.coldStartWindowMs + 1);
    start();
    const ad = lastAd();
    ad.emit(AdEventType.LOADED);
    useAdsStore.setState({ phase: 'blocked' });
    expect(ad.destroy).toHaveBeenCalled();
    const created = Mock.createForAdRequest.mock.calls.length;
    goBackground();
    goForeground();
    expect(Mock.createForAdRequest).toHaveBeenCalledTimes(created);
  });

  it('does not retry a failed load in a loop, only on the next foreground', () => {
    start();
    lastAd().emit(AdEventType.ERROR, new Error('no-fill'));
    expect(Mock.createForAdRequest).toHaveBeenCalledTimes(1);
    goBackground();
    goForeground();
    expect(Mock.createForAdRequest).toHaveBeenCalledTimes(2);
  });

  it('survives a show() that rejects', async () => {
    start();
    const ad = lastAd();
    ad.show.mockReturnValueOnce(Promise.reject(new Error('declined')));
    ad.emit(AdEventType.LOADED);
    await Promise.resolve();
    await Promise.resolve();
    expect(ad.destroy).toHaveBeenCalled();
    expect(lastAd()).not.toBe(ad);
  });
});
