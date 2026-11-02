import { useEffect } from 'react';

// Ref-counted: any mounted screen state (Hold, Save sheet, …) can veto App Open ads.
let count = 0;

export const isAppOpenSuppressed = () => count > 0;

/** Keep App Open ads away while `active` is true (e.g. a held reading or an open modal). */
export function useSuppressAppOpen(active: boolean) {
  useEffect(() => {
    if (!active) return;
    count += 1;
    return () => {
      count -= 1;
    };
  }, [active]);
}
