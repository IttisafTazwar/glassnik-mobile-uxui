import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MuteContextValue {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
}

const MuteContext = createContext<MuteContextValue>({
  isMuted: false,
  toggleMute: () => {},
  setMuted: () => {},
});

const STORAGE_KEY = '@glassnik/muted';

export function MuteProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState(false);

  // Restore preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => { if (val === 'true') setIsMuted(true); })
      .catch(() => {});
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  // Runtime synchronisation for cases such as browser autoplay policy.
  // Unlike toggleMute(), this does not persist a forced browser state.
  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted);
  }, []);

  return (
    <MuteContext.Provider value={{ isMuted, toggleMute, setMuted }}>
      {children}
    </MuteContext.Provider>
  );
}

export function useMute() {
  return useContext(MuteContext);
}
