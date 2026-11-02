import React, { useEffect, useRef } from 'react';
import { createAppOpenController } from './appOpen';
import { adsConfig } from './config';
import { startAds } from './consent';
import { registerAdsStrings } from './i18n';
import { launchInfo } from './session';

type Props = {
  /** Name of the focused route, used to keep App Open ads to the screens in adsConfig. */
  getRoute: () => string | undefined;
  children: React.ReactNode;
};

/**
 * Starts consent + SDK after the first render and runs the App Open controller. Children render
 * immediately: nothing here ever waits for consent or an ad.
 */
export function AdsProvider({ getRoute, children }: Props) {
  registerAdsStrings();
  const getRouteRef = useRef(getRoute);
  getRouteRef.current = getRoute;

  useEffect(() => {
    if (!adsConfig.enabled) return;
    launchInfo(); // stamp the launch (cold start vs JS reload, session count) as early as possible
    let controller: ReturnType<typeof createAppOpenController> | null = null;
    try {
      controller = createAppOpenController({ getRoute: () => getRouteRef.current() });
      startAds();
    } catch (e) {
      if (__DEV__) console.warn('[ads] start failed', e);
    }
    return () => controller?.stop();
  }, []);

  return <>{children}</>;
}
