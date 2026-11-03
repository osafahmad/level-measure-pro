import type * as RNTL from '@testing-library/react-native/pure';
import type * as SplashStore from '../splashStore';

// MMKV survives a "relaunch" (jest.resetModules) like the real file does; in-memory state does not.
const mockStorage = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    set: (k: string, v: string) => mockStorage.set(k, v),
    getString: (k: string) => mockStorage.get(k),
    remove: (k: string) => mockStorage.delete(k),
    clearAll: () => mockStorage.clear(),
  }),
}));

// The real provider renders nothing until native insets arrive, which never happens in Jest.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// The real Level screen needs live Reanimated sensors, which Jest cannot provide. These tests cover
// the splash and ads gating, so a stand-in Level screen renders the real banner slot.
jest.mock('../../level/LevelStack', () => {
  const { AdBannerSlot } = require('../../ads');
  return { LevelStack: () => require('react').createElement(AdBannerSlot, { placement: 'Level' }) };
});

// Each test boots the whole app module graph; the first one also pays for transforming it.
jest.setTimeout(20_000);

const T0 = 1_700_000_000_000;

/** A fresh JS runtime (cold launch, or a reload after markJsReload): every module reloads. */
function boot(os: 'ios' | 'android' = 'ios') {
  jest.resetModules();
  const RN = require('react-native');
  RN.Platform.OS = os;
  RN.AppState.currentState = 'active';
  const listeners = new Set<(s: string) => void>();
  jest.spyOn(RN.AppState, 'addEventListener').mockImplementation((...args: unknown[]) => {
    const fn = args[1] as (s: string) => void;
    listeners.add(fn);
    return { remove: () => listeners.delete(fn) };
  });
  const ads = require('react-native-google-mobile-ads');
  const splash = require('../splashStore') as typeof SplashStore;
  const React = require('react');
  const App = require('../../../../App').default;
  // pure: no auto-cleanup hooks (they cannot be registered from inside a test); see afterEach.
  const tl = require('@testing-library/react-native/pure') as typeof RNTL;
  // Something in the app's module graph switches Jest back to real timers when required.
  jest.useFakeTimers({ now: T0 });
  return {
    ...splash,
    tl,
    gatherConsent: ads.AdsConsent.gatherConsent as jest.Mock,
    initialize: ads.default().initialize as jest.Mock,
    createForAdRequest: ads.AppOpenAd.createForAdRequest as jest.Mock,
    markJsReload: () => require('../../ads/session').markJsReload(),
    render: () => tl.render(React.createElement(App)),
    setAppState: (next: string) =>
      tl.act(() => {
        RN.AppState.currentState = next;
        [...listeners].forEach(fn => fn(next));
      }),
  };
}

let m: ReturnType<typeof boot>;
const phase = () => m.useSplash.getState().phase;
const splash = () => m.tl.screen.queryByTestId('splash');
const banner = () => m.tl.screen.queryByTestId('BannerAd');

/** Let promise chains (consent → ATT → SDK init) settle. */
async function flush() {
  await m.tl.act(async () => {
    for (let i = 0; i < 40; i++) await Promise.resolve();
  });
}

async function advance(ms: number) {
  await m.tl.act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
}

/** Advance the clock to `at` ms after bundle load. */
const advanceTo = (at: number) => advance(at - (Date.now() - T0));

async function coldLaunch(os?: 'ios' | 'android') {
  m = boot(os);
  await m.render();
  await m.tl.fireEvent(m.tl.screen.getByTestId('splash-icon'), 'load');
  await flush();
}

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
  mockStorage.clear();
});

afterEach(async () => {
  await m?.tl.cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Splash: cold launch', () => {
  it('stays see-through with the app unmounted until its icon has loaded', async () => {
    m = boot();
    await m.render();
    expect(phase()).toBe('loading');
    expect(splash()).not.toBeNull();
    expect(m.tl.screen.queryByText('Level Measure Pro')).toBeNull(); // the native layer shows the text
    expect(m.initialize).not.toHaveBeenCalled(); // AdsProvider not mounted yet
    await m.tl.fireEvent(m.tl.screen.getByTestId('splash-icon'), 'load');
    await flush();
    expect(phase()).toBe('holding');
    expect(m.tl.screen.getByText('Level Measure Pro')).toBeTruthy();
  });

  it('never waits on the icon longer than SPLASH_ICON_TIMEOUT_MS', async () => {
    m = boot();
    await m.render();
    await advance(m.SPLASH_ICON_TIMEOUT_MS);
    expect(phase()).toBe('holding');
  });

  it('holds for SPLASH_HOLD_MS after bundle load, then fades out and starts consent', async () => {
    await coldLaunch();
    expect(m.initialize).toHaveBeenCalledTimes(1); // prewarm from previous consent (mocked as allowed)
    await advanceTo(m.SPLASH_HOLD_MS - 1);
    expect(phase()).toBe('holding');
    expect(m.gatherConsent).not.toHaveBeenCalled(); // no UMP / ATT over the splash
    await advanceTo(m.SPLASH_HOLD_MS);
    expect(phase()).toBe('off');
    expect(m.gatherConsent).toHaveBeenCalledTimes(1);
    expect(m.initialize).toHaveBeenCalledTimes(1); // memoised: no second init
    await advance(m.SPLASH_FADE_MS + 50);
    expect(splash()).toBeNull();
  });

  it('loads no banner and no App Open ad while it covers Level, even after the prewarm', async () => {
    await coldLaunch();
    await advanceTo(m.SPLASH_HOLD_MS - 1);
    expect(m.initialize).toHaveBeenCalled();
    expect(banner()).toBeNull();
    expect(m.createForAdRequest).not.toHaveBeenCalled();
    await advanceTo(m.SPLASH_HOLD_MS);
    expect(banner()).not.toBeNull(); // consent settled after the splash: ads ready
    expect(m.createForAdRequest).toHaveBeenCalledTimes(1);
  });
});

describe('Splash: hold time per platform', () => {
  it.each(['ios', 'android'] as const)('%s holds for its own SPLASH_HOLD_MS_BY_OS value', async os => {
    await coldLaunch(os);
    expect(m.SPLASH_HOLD_MS).toBe(m.SPLASH_HOLD_MS_BY_OS[os]);
    await advanceTo(m.SPLASH_HOLD_MS_BY_OS[os] - 1);
    expect(phase()).toBe('holding');
    await advanceTo(m.SPLASH_HOLD_MS_BY_OS[os]);
    expect(phase()).toBe('off');
  });
});

describe('Splash: not shown', () => {
  it('after a react-native-restart reload (language change)', async () => {
    m = boot();
    m.markJsReload();
    m = boot();
    await m.render();
    expect(phase()).toBe('off');
    expect(splash()).toBeNull();
    await flush();
    expect(m.gatherConsent).toHaveBeenCalledTimes(1); // ads start at mount, as before
  });

  it('when Android re-creates the Activity in the same JS runtime', async () => {
    await coldLaunch();
    await advanceTo(m.SPLASH_HOLD_MS + m.SPLASH_FADE_MS + 50);
    await m.tl.screen.unmount();
    await m.render();
    expect(splash()).toBeNull();
    expect(phase()).toBe('off');
  });
});

describe('Splash: app leaves the foreground during the hold', () => {
  it('ends on return, starts consent only then, and shows no App Open ad this launch', async () => {
    await coldLaunch();
    await advanceTo(m.SPLASH_HOLD_MS / 2);
    await m.setAppState('background');
    await advanceTo(m.SPLASH_HOLD_MS * 2);
    expect(phase()).toBe('holding'); // the hold elapsed in the background
    expect(m.gatherConsent).not.toHaveBeenCalled();
    await m.setAppState('active');
    await flush();
    expect(phase()).toBe('off');
    expect(m.useSplash.getState().interrupted).toBe(true);
    expect(m.gatherConsent).toHaveBeenCalledTimes(1);
    expect(banner()).not.toBeNull(); // the banner is unaffected
    expect(m.createForAdRequest).not.toHaveBeenCalled();
  });

  it('a short trip to the background still ends at SPLASH_HOLD_MS and still skips App Open', async () => {
    await coldLaunch();
    await advanceTo(m.SPLASH_HOLD_MS / 2);
    await m.setAppState('background');
    await advanceTo(m.SPLASH_HOLD_MS * 0.75);
    await m.setAppState('active');
    await advanceTo(m.SPLASH_HOLD_MS - 1);
    expect(phase()).toBe('holding');
    await advanceTo(m.SPLASH_HOLD_MS);
    expect(phase()).toBe('off');
    expect(m.createForAdRequest).not.toHaveBeenCalled();
  });

  it('inactive (not background) when the hold ends: waits for active, keeps the App Open attempt', async () => {
    await coldLaunch();
    await advanceTo(m.SPLASH_HOLD_MS - 100);
    await m.setAppState('inactive');
    await advanceTo(m.SPLASH_HOLD_MS + 500);
    expect(phase()).toBe('holding');
    expect(m.gatherConsent).not.toHaveBeenCalled();
    await m.setAppState('active');
    await flush();
    expect(phase()).toBe('off');
    expect(m.useSplash.getState().interrupted).toBe(false);
    expect(m.gatherConsent).toHaveBeenCalledTimes(1);
    expect(m.createForAdRequest).toHaveBeenCalledTimes(1);
  });
});
