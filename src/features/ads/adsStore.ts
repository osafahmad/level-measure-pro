import { create } from 'zustand';

/**
 * idle → consent (UMP form / ATT may be on screen) → ready (ads may load and show) | blocked.
 * Consent is re-read every launch and never persisted (react-native-google-mobile-ads docs).
 */
export type AdsPhase = 'idle' | 'consent' | 'ready' | 'blocked';

type AdsState = {
  phase: AdsPhase;
  sdkInitialized: boolean;
  privacyOptionsRequired: boolean;
  privacyFormOpen: boolean;
  set: (patch: Partial<Omit<AdsState, 'set'>>) => void;
};

export const useAdsStore = create<AdsState>(set => ({
  phase: 'idle',
  sdkInitialized: false,
  privacyOptionsRequired: false,
  privacyFormOpen: false,
  set: patch => set(patch),
}));
