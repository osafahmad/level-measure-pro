import { AppState, Platform } from 'react-native';
import mobileAds, {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  type AdsConsentInfo,
  type AdsConsentInfoOptions,
} from 'react-native-google-mobile-ads';
import { check, PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import RNRestart from 'react-native-restart';
import { adsConfig, debugGeography, testDeviceIds } from './config';
import { useAdsStore } from './adsStore';
import { markJsReload } from './session';

/**
 * Consent → ATT → SDK init, following the react-native-google-mobile-ads consent docs:
 * - gatherConsent() runs every launch; when it settles (resolved or rejected) the current consent
 *   decides whether ads may be requested, then ATT is asked, then the SDK starts and phase = ready.
 * - In parallel the SDK may start from the previous session's consent, but that path never asks
 *   for ATT and never marks ads ready, so nothing loads or shows while a prompt can be on screen.
 * Every failure is swallowed: ads stay off, the rest of the app is unaffected.
 */

const log = (msg: string, err?: unknown) => {
  if (__DEV__) console.warn(`[ads] ${msg}`, err ?? '');
};

const setState = (patch: Parameters<ReturnType<typeof useAdsStore.getState>['set']>[0]) =>
  useAdsStore.getState().set(patch);

function umpOptions(): AdsConsentInfoOptions {
  const options: AdsConsentInfoOptions = {};
  const ids = testDeviceIds('ump');
  if (ids.length) options.testDeviceIdentifiers = ids;
  const geography = debugGeography();
  if (geography !== undefined) options.debugGeography = geography;
  return options;
}

function applyInfo(info: AdsConsentInfo) {
  setState({
    privacyOptionsRequired:
      info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  });
}

async function readConsentInfo(): Promise<AdsConsentInfo | null> {
  try {
    const info = await AdsConsent.getConsentInfo();
    applyInfo(info);
    return info;
  } catch (e) {
    log('getConsentInfo failed', e);
    return null;
  }
}

// Memoised promise, assigned only once init actually starts: an early call made while consent
// does not allow ads leaves it unset, so the start after consent completes still runs.
let initPromise: Promise<boolean> | null = null;

export function ensureSdkInitialized(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const ids = testDeviceIds('mobileAds');
      if (ids.length) await mobileAds().setRequestConfiguration({ testDeviceIdentifiers: ids });
      await mobileAds().initialize();
      setState({ sdkInitialized: true });
      return true;
    } catch (e) {
      log('initialize failed', e);
      initPromise = null; // allow a later retry
      return false;
    }
  })();
  return initPromise;
}

function whenActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise(resolve => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        sub.remove();
        resolve();
      }
    });
  });
}

/** iOS only. Asks once, after UMP, if GDPR does not apply or purpose 1 was consented (docs sample). */
async function maybeRequestATT() {
  if (Platform.OS !== 'ios') return;
  try {
    const gdprApplies = await AdsConsent.getGdprApplies();
    const purposeOne = gdprApplies && (await AdsConsent.getPurposeConsents()).startsWith('1');
    if (gdprApplies && !purposeOne) return;
    // UMP's own IDFA message may already have asked; DENIED here means "not asked yet".
    if ((await check(PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY)) !== RESULTS.DENIED) return;
    await whenActive(); // the system ignores ATT requests while the app is not active
    await request(PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY);
  } catch (e) {
    log('ATT request failed', e);
  }
}

/** Consent has settled: decide ready vs blocked. */
async function settle() {
  const info = await readConsentInfo();
  if (!info?.canRequestAds) {
    setState({ phase: 'blocked' });
    return;
  }
  setState({ phase: 'consent' });
  await maybeRequestATT();
  const ok = await ensureSdkInitialized();
  setState({ phase: ok ? 'ready' : 'blocked' });
}

async function startFromPreviousSession() {
  try {
    const info = await AdsConsent.getConsentInfo();
    if (info.canRequestAds) await ensureSdkInitialized();
  } catch (e) {
    log('previous-session start failed', e);
  }
}

let started = false;

/** Runs once per JS runtime. Never awaited by the UI. */
export function startAds() {
  if (started || !adsConfig.enabled) return;
  started = true;
  setState({ phase: 'consent' });
  try {
    if (__DEV__ && adsConfig.debug.resetConsentOnLaunch) AdsConsent.reset();
  } catch (e) {
    log('reset failed', e);
  }
  startFromPreviousSession();
  AdsConsent.gatherConsent(umpOptions())
    .catch(e => log('gatherConsent failed; using existing consent', e))
    .then(settle)
    .catch(e => {
      log('consent flow failed', e);
      setState({ phase: 'blocked' });
    });
}

/** Settings → Privacy choices. App Open stays suppressed while the form is up. */
export async function openPrivacyOptions() {
  setState({ privacyFormOpen: true });
  try {
    await AdsConsent.showPrivacyOptionsForm();
  } catch (e) {
    log('privacy options form failed', e);
  } finally {
    setState({ privacyFormOpen: false });
  }
  const info = await readConsentInfo();
  if (!info) return;
  if (!info.canRequestAds) {
    setState({ phase: 'blocked' });
  } else if (useAdsStore.getState().phase !== 'ready') {
    await settle().catch(e => log('settle after privacy options failed', e));
  }
}

/** __DEV__ only: forget UMP consent and reload JS so the flow runs again. */
export function resetConsentForTesting() {
  if (!__DEV__) return;
  try {
    AdsConsent.reset();
  } catch (e) {
    log('reset failed', e);
  }
  markJsReload();
  RNRestart.restart();
}
