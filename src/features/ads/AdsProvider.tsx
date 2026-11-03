import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { createAppOpenController, type AppOpenController } from './appOpen';
import { adsConfig } from './config';
import { prewarmAds, startAds } from './consent';
import { registerAdsStrings } from './i18n';
import { launchInfo } from './session';
import { useSuppressAppOpen } from './suppress';

type Props = {
  /** Name of the focused route, used to keep App Open ads to the screens in adsConfig. */
  getRoute: () => string | undefined;
  /** While true (the launch splash), no consent / ATT UI starts and no App Open ad may show. */
  deferStart?: boolean;
  /** The app went to the background during the splash: no App Open ad this launch. */
  skipColdStart?: boolean;
  children: React.ReactNode;
};

/** Runs `fn` now if the app is active, else on the next change to active. Returns a cancel. */
function whenActive(fn: () => void): () => void {
  if (AppState.currentState === 'active') {
    fn();
    return () => {};
  }
  const sub = AppState.addEventListener('change', s => {
    if (s !== 'active') return;
    sub.remove();
    fn();
  });
  return () => sub.remove();
}

/**
 * Runs the App Open controller and starts the SDK from previous consent at mount (no UI, no ad
 * requests); consent + ATT start once deferStart is false and the app is active. Children render
 * immediately: nothing here ever waits for consent or an ad.
 */
export function AdsProvider({ getRoute, deferStart = false, skipColdStart = false, children }: Props) {
  registerAdsStrings();
  useSuppressAppOpen(deferStart);
  const getRouteRef = useRef(getRoute);
  getRouteRef.current = getRoute;
  const controllerRef = useRef<AppOpenController | null>(null);

  useEffect(() => {
    if (!adsConfig.enabled) return;
    launchInfo(); // stamp the launch (cold start vs JS reload, session count) as early as possible
    try {
      controllerRef.current = createAppOpenController({ getRoute: () => getRouteRef.current() });
      prewarmAds();
    } catch (e) {
      if (__DEV__) console.warn('[ads] start failed', e);
    }
    return () => {
      controllerRef.current?.stop();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!adsConfig.enabled || deferStart) return;
    if (skipColdStart) controllerRef.current?.skipColdStart();
    return whenActive(() => {
      try {
        startAds();
      } catch (e) {
        if (__DEV__) console.warn('[ads] start failed', e);
      }
    });
  }, [deferStart, skipColdStart]);

  return <>{children}</>;
}
