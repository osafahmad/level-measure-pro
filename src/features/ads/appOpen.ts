import { AppState } from 'react-native';
import { AdEventType, AppOpenAd } from 'react-native-google-mobile-ads';
import { useAdsStore } from './adsStore';
import { adsConfig, unitId } from './config';
import { appOpenShownAt, launchInfo, setAppOpenShownAt } from './session';
import { isAppOpenSuppressed } from './suppress';

/** On Android closing the ad's own Activity reads as a return to the foreground; ignore that. */
const AFTER_CLOSE_IGNORE_MS = 2_000;

type Deps = { getRoute: () => string | undefined; now?: () => number };

/**
 * App Open ads without useAppOpenAdManager (docs, "Without hooks"): we need a cooldown, screen and
 * modal blockers and a first-session skip, which the hook's warm-foreground auto-show cannot honour.
 * One ad is held at a time; it is discarded once older than maxAdAgeMs and replaced after it
 * closes. Nothing here throws: a failed load or show only means no ad this time.
 */
export function createAppOpenController({ getRoute, now = Date.now }: Deps) {
  let ad: AppOpenAd | null = null;
  let loadedAt: number | null = null;
  let loading = false;
  let showing = false;
  let closedAt = 0;
  let coldOffered = false;
  let appState: string | null | undefined = AppState.currentState;
  let stopped = false;

  const ready = () => adsConfig.enabled && !stopped && useAdsStore.getState().phase === 'ready';

  function discard() {
    const old = ad;
    ad = null;
    loadedAt = null;
    loading = false;
    try {
      old?.destroy();
    } catch {}
  }

  function load() {
    if (!ready() || loading || showing || (ad && loadedAt != null)) return;
    discard();
    try {
      const next = AppOpenAd.createForAdRequest(unitId('appOpen'));
      ad = next;
      loading = true;
      next.addAdEventListener(AdEventType.LOADED, () => {
        if (ad !== next) return;
        loading = false;
        loadedAt = now();
        tryShowColdStart();
      });
      next.addAdEventListener(AdEventType.OPENED, () => setAppOpenShownAt(now()));
      next.addAdEventListener(AdEventType.CLOSED, () => {
        if (ad !== next) return;
        showing = false;
        closedAt = now();
        discard();
        load(); // preload the next one
      });
      next.addAdEventListener(AdEventType.ERROR, () => {
        if (ad !== next) return;
        const failedShow = showing;
        showing = false;
        discard();
        // A failed load is retried on the next foreground, not in a loop; a failed show reloads.
        if (failedShow) load();
      });
      next.load();
    } catch {
      discard();
    }
  }

  function isFresh() {
    return loadedAt != null && now() - loadedAt < adsConfig.appOpen.maxAdAgeMs;
  }

  function canShow() {
    if (!ready() || showing || !ad || !isFresh()) return false;
    if (adsConfig.appOpen.skipFirstSession && launchInfo().sessions <= 1) return false;
    const last = appOpenShownAt();
    if (last != null && now() - last < adsConfig.appOpen.cooldownMs) return false;
    const route = getRoute();
    if (!route || !(adsConfig.appOpen.screens as readonly string[]).includes(route)) return false;
    if (isAppOpenSuppressed() || useAdsStore.getState().privacyFormOpen) return false;
    return appState === 'active';
  }

  function show() {
    if (!canShow() || !ad) return false;
    const current = ad;
    showing = true;
    try {
      current.show().catch(() => {
        if (ad !== current) return;
        showing = false;
        discard();
        load();
      });
    } catch {
      showing = false;
      discard();
      load();
    }
    return true;
  }

  function tryShowColdStart() {
    if (coldOffered) return;
    const launch = launchInfo();
    if (launch.kind !== 'cold' || now() - launch.at > adsConfig.appOpen.coldStartWindowMs) {
      coldOffered = true; // too late (or a JS reload): keep the ad for the next foreground
      return;
    }
    if (show()) coldOffered = true;
  }

  function onForeground() {
    if (showing || now() - closedAt < AFTER_CLOSE_IGNORE_MS) return;
    if (ad && loadedAt != null && !isFresh()) discard();
    if (!show()) load();
  }

  const appStateSub = AppState.addEventListener('change', next => {
    const prev = appState;
    appState = next;
    if (prev === 'background' && next === 'active') onForeground();
  });

  const storeUnsub = useAdsStore.subscribe((s, prev) => {
    if (s.phase === prev.phase) return;
    if (s.phase === 'ready') load();
    else if (!showing) discard();
  });

  load();

  return {
    /** Unmount: stop listening and drop the held ad. */
    stop() {
      stopped = true;
      appStateSub.remove();
      storeUnsub();
      if (!showing) discard();
    },
    /** For tests and diagnostics. */
    get state() {
      return { loaded: ad != null && loadedAt != null, loading, showing, loadedAt };
    },
  };
}

export type AppOpenController = ReturnType<typeof createAppOpenController>;
