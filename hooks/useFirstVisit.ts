import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_VISIT_KEY = 'glassnik:hasVisitedBefore';

/**
 * Tracks whether this device has opened the app before, persisted locally
 * (matches items 8–9 of the Homepage checklist: show a welcome experience
 * only on first visit; returning users skip straight in).
 *
 * NOTE: no actual "Welcome Screen" content/design has been provided yet —
 * this hook only answers the yes/no question. What to show on a first
 * visit (if anything, beyond landing on Explore as normal) is still open.
 */
export function useFirstVisit() {
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null); // null = still checking

  useEffect(() => {
    AsyncStorage.getItem(FIRST_VISIT_KEY).then((value) => {
      setIsFirstVisit(value == null);
    });
  }, []);

  function markVisited() {
    AsyncStorage.setItem(FIRST_VISIT_KEY, 'true').catch(() => {});
    setIsFirstVisit(false);
  }

  return { isFirstVisit, markVisited };
}