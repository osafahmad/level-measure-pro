import { Platform } from 'react-native';
import { create } from 'zustand';
import { launchInfo } from '../ads';

/**
 * Splash hold per platform, counted from bundle load. Aim: ~3.0 s from tap to fade start (tune on
 * device). Android loads the bundle later after the tap (~1.1 s on a Redmi 13 release build), so
 * its hold is shorter.
 */
export const SPLASH_HOLD_MS_BY_OS = { ios: 2600, android: 1450 } as const;
export const SPLASH_HOLD_MS = Platform.OS === 'android' ? SPLASH_HOLD_MS_BY_OS.android : SPLASH_HOLD_MS_BY_OS.ios;
/** Cross-fade from the splash to the (already mounted) Level screen. */
export const SPLASH_FADE_MS = 250;
/**
 * Give up waiting for the splash icon to load after this long; never block startup on it. iOS
 * removes the native launch view 3 s after the first JS mount (SceneDelegate), so keep this well
 * below that.
 */
export const SPLASH_ICON_TIMEOUT_MS = 1000;

/** Evaluated with the bundle (App.tsx imports this module), the earliest moment JS can see. */
export const bootAt = Date.now();

/**
 * off: no splash this runtime, or it has ended (its fade may still be running).
 * loading: see-through over the identical native splash until the JS icon has loaded.
 * holding: opaque, app mounted underneath, waiting for the hold time and an active app.
 */
export type SplashPhase = 'off' | 'loading' | 'holding';

type SplashState = {
  phase: SplashPhase;
  /** The app went to the background (or the splash was torn down) before the splash ended. */
  interrupted: boolean;
};

export const useSplash = create<SplashState>(() => ({ phase: 'off', interrupted: false }));

let used = false;

/**
 * Once per JS runtime and only on a cold launch: not after a react-native-restart reload, and not
 * when Android re-creates the Activity while this runtime lives on.
 */
export function beginSplash() {
  if (used) return;
  used = true;
  if (launchInfo().kind !== 'cold') return;
  useSplash.setState({ phase: 'loading', interrupted: false });
}

export function splashIconReady() {
  if (useSplash.getState().phase === 'loading') useSplash.setState({ phase: 'holding' });
}

export function endSplash() {
  if (useSplash.getState().phase !== 'off') useSplash.setState({ phase: 'off' });
}

/** While true: no consent / ATT, no App Open, no Level haptics or announcements. */
export const isSplashBlocking = (phase: SplashPhase) => phase !== 'off';
