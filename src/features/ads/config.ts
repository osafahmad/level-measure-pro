import { Platform } from 'react-native';
import { AdsConsentDebugGeography, TestIds } from 'react-native-google-mobile-ads';

/**
 * Every ads setting lives here. The AdMob *App* IDs, SKAdNetwork items and the ATT purpose string
 * are native build inputs: per the react-native-google-mobile-ads docs they live in the
 * `react-native-google-mobile-ads` block of the root app.json (the only source for bare RN).
 */

const HOUR = 60 * 60 * 1000;

/** Route names from the Level stack that may show ads. */
export type AdScreen = 'Level' | 'Calibrate' | 'Readings' | 'Settings';
export type AdUnitKind = 'banner' | 'appOpen';

export const adsConfig = {
  /** Master switch. false = no consent flow, no SDK init, no ad requests. */
  enabled: true,

  /** Production ad units. Used only in release builds (see useTestAds below). */
  units: {
    ios: {
      banner: 'ca-app-pub-4778063590683599/5451895391',
      appOpen: 'ca-app-pub-4778063590683599/5930445534',
    },
    android: {
      banner: 'ca-app-pub-4778063590683599/4261017394',
      appOpen: 'ca-app-pub-4778063590683599/1421111961',
    },
  },

  /** Screens that render a bottom banner. */
  bannerScreens: ['Level'] as readonly AdScreen[],

  banner: {
    /** Wait before asking again after a load fails with nothing on screen. */
    retryDelayMs: 60_000,
    /** Height animation when the slot opens or is reclaimed. */
    animationMs: 220,
  },

  appOpen: {
    /** Minimum time between two App Open ads (persisted across launches). */
    cooldownMs: 4 * HOUR,
    /** Google: an App Open ad older than four hours must not be shown. */
    maxAdAgeMs: 4 * HOUR,
    /** On a cold start, show only if an ad is ready this soon after launch; otherwise keep it. */
    coldStartWindowMs: 8_000,
    /** Screens an App Open ad may cover. Calibration and Settings (alerts) are excluded. */
    screens: ['Level'] as readonly AdScreen[],
    /** Google recommends not showing App Open ads on a user's very first session. */
    skipFirstSession: true,
  },

  /**
   * Internal / TestFlight builds only: true makes a release build use Google's test units and the
   * test devices below. Must stay false for App Store builds (enforced by config.test.ts).
   */
  testAdsInRelease: false,

  /**
   * Hashed test-device IDs, applied only when test ads are on. Copy them from the Xcode console /
   * logcat: the Mobile Ads SDK and UMP each log their own hash for the device.
   */
  testDeviceIds: {
    mobileAds: [] as string[],
    ump: [] as string[],
  },

  /** GDPR testing. Honoured in __DEV__ builds only; ignored in release. */
  debug: {
    geography: null as 'EEA' | 'NOT_EEA' | null,
    resetConsentOnLaunch: false,
  },
} as const;

export const useTestAds = __DEV__ || adsConfig.testAdsInRelease;

const TEST_UNITS: Record<AdUnitKind, string> = {
  banner: TestIds.ADAPTIVE_BANNER,
  appOpen: TestIds.APP_OPEN,
};

export function unitId(kind: AdUnitKind): string {
  if (useTestAds) return TEST_UNITS[kind];
  return Platform.OS === 'ios' ? adsConfig.units.ios[kind] : adsConfig.units.android[kind];
}

export function testDeviceIds(kind: 'mobileAds' | 'ump'): string[] {
  return useTestAds ? [...adsConfig.testDeviceIds[kind]] : [];
}

export function debugGeography(): AdsConsentDebugGeography | undefined {
  if (!__DEV__ || adsConfig.debug.geography == null) return undefined;
  return adsConfig.debug.geography === 'EEA' ? AdsConsentDebugGeography.EEA : AdsConsentDebugGeography.NOT_EEA;
}
