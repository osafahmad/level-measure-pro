import { useAdsStore } from './adsStore';
import { openPrivacyOptions } from './consent';

/** UMP requires a way back into the consent form when privacy options are REQUIRED. */
export function usePrivacyOptions() {
  const required = useAdsStore(s => s.privacyOptionsRequired);
  return { required, open: openPrivacyOptions };
}
