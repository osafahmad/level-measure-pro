import { AppState } from 'react-native';
import { AdEventType, AppOpenAd } from 'react-native-google-mobile-ads';
import { useAdsStore } from './adsStore';
import { adsConfig, unitId } from './config';
import { appOpenShownAt, launchInfo, setAppOpenShownAt } from './session';
import { isAppOpenSuppressed } from './suppress';

/** On Android closing the ad's own Activity reads as a return to the foreground; ignore that. */
const AFTER_CLOSE_IGNORE_MS = 2_000;

type Deps = { getRoute: () => string | undefined; now?: () => number };
type ShowKind = 'cold' | 'warm';

// One cold-launch attempt per JS runtime. Android can destroy and recreate the Activity while the
// process (and this runtime) lives on, which remounts AdsProvider and creates a new controller;
// that is a warm start, so the attempt must not be offered again.
let coldAttemptUsed = false;

/**
 * App Open ads without useAppOpenAdManager (docs, "Without hooks"), because the hook always
 * auto-shows on warm foreground and cannot honour our launch rules or screen and modal blockers.
 *
 * - Cold launch: one attempt per launch, no cooldown. The window opens when ads become ready
 *   (consent + ATT settled), so a first-launch consent flow does not use it up. A JS reload
 *   (react-native-restart) is not a cold launch.
 * - Warm start (background → active): only when warmStartEnabled, and then with the cooldown.
 * One ad is held at a time and discarded once older than maxAdAgeMs. Nothing here throws: a failed
 * load or show only means no ad this time.
 */
export function createAppOpenController({ getRoute, now = Date.now }: Deps) {
  const config = adsConfig.appOpen;
  let ad: AppOpenAd | null = null;
  let loadedAt: number | null = null;
  let loading = false;
  let showing = false;
  let closedAt = 0;
  let readyAt: number | null = null;
  // The cold-launch attempt is used up (shown, blocked, too late), was used by an earlier controller
  // in this runtime, or does not apply (JS reload).
  let coldDone = coldAttemptUsed || launchInfo().kind !== 'cold';
  let appState: string | null | undefined = AppState.currentState;
  let stopped = false;

  const ready = () => adsConfig.enabled && !stopped && useAdsStore.getState().phase === 'ready';
  // No requests once nothing could show them.
  const wantAd = () => !coldDone || config.warmStartEnabled;

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
    if (!ready() || !wantAd() || loading || showing || (ad && loadedAt != null)) return;
    discard();
    try {
      const next = AppOpenAd.createForAdRequest(unitId('appOpen'));
      ad = next;
      loading = true;
      next.addAdEventListener(AdEventType.LOADED, () => {
        if (ad !== next) return;
        loading = false;
        loadedAt = now();
        if (!coldDone) tryColdStart();
        else if (!config.warmStartEnabled) discard();
      });
      next.addAdEventListener(AdEventType.OPENED, () => setAppOpenShownAt(now()));
      next.addAdEventListener(AdEventType.CLOSED, () => {
        if (ad !== next) return;
        showing = false;
        closedAt = now();
        discard();
        load(); // preload the next one (warm starts only)
      });
      next.addAdEventListener(AdEventType.ERROR, () => {
        if (ad !== next) return;
        const failedShow = showing;
        showing = false;
        discard();
        // A failed load is retried on the next warm start, not in a loop; a failed show reloads.
        if (failedShow) load();
      });
      next.load();
    } catch {
      discard();
    }
  }

  function isFresh() {
    return loadedAt != null && now() - loadedAt < config.maxAdAgeMs;
  }

  function canShow(kind: ShowKind) {
    if (!ready() || showing || !ad || !isFresh()) return false;
    if (config.skipFirstSession && launchInfo().sessions <= 1) return false;
    if (kind === 'warm') {
      const last = appOpenShownAt();
      if (last != null && now() - last < config.cooldownMs) return false;
    }
    const route = getRoute();
    if (!route || !(config.screens as readonly string[]).includes(route)) return false;
    if (isAppOpenSuppressed() || useAdsStore.getState().privacyFormOpen) return false;
    return appState === 'active';
  }

  function show(kind: ShowKind) {
    if (!canShow(kind) || !ad) return false;
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

  /** The single cold-launch attempt: inside the window it shows if nothing blocks it. */
  function tryColdStart() {
    if (coldDone || readyAt == null) return;
    const inWindow = now() - readyAt <= config.coldStartWindowMs;
    coldDone = true;
    coldAttemptUsed = true;
    if (inWindow && show('cold')) return;
    if (!config.warmStartEnabled) discard();
  }

  function onForeground() {
    if (!config.warmStartEnabled) return;
    if (showing || now() - closedAt < AFTER_CLOSE_IGNORE_MS) return;
    if (ad && loadedAt != null && !isFresh()) discard();
    if (!show('warm')) load();
  }

  function onReady() {
    if (readyAt == null) readyAt = now(); // first time this launch only
    load();
  }

  const appStateSub = AppState.addEventListener('change', next => {
    const prev = appState;
    appState = next;
    if (prev === 'background' && next === 'active') onForeground();
  });

  const storeUnsub = useAdsStore.subscribe((s, prev) => {
    if (s.phase === prev.phase) return;
    if (s.phase === 'ready') onReady();
    else if (!showing) discard();
  });

  if (ready()) onReady();

  return {
    /** Give up this launch's cold attempt (the app went to the background during the splash). */
    skipColdStart() {
      coldDone = true;
      coldAttemptUsed = true;
      if (!showing && !config.warmStartEnabled) discard();
    },
    /** Unmount: stop listening and drop the held ad. */
    stop() {
      stopped = true;
      appStateSub.remove();
      storeUnsub();
      if (!showing) discard();
    },
  };
}

export type AppOpenController = ReturnType<typeof createAppOpenController>;
