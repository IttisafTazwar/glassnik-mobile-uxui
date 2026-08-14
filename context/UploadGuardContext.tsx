import React, { createContext, useContext, useRef, useState } from 'react';

interface UploadGuardContextValue {
  /** True while an upload is actively in progress on the Upload screen. */
  isGuardActive: boolean;
  setGuardActive: (active: boolean) => void;
  /**
   * Call this to cancel the active upload (resume state stays in AsyncStorage).
   * Set by the Upload screen; called by the tab layout when the user confirms leaving.
   */
  cancelUploadRef: React.MutableRefObject<(() => void) | null>;
  /**
   * Set to true by the ClassicTabLayout's GuardedTabButton just before triggering
   * navigation after the user confirms "Leave". The blur listener in upload.tsx
   * checks this flag to avoid double-prompting.
   */
  intentionalLeaveRef: React.MutableRefObject<boolean>;
}

const UploadGuardContext = createContext<UploadGuardContextValue>({
  isGuardActive: false,
  setGuardActive: () => {},
  cancelUploadRef: { current: null },
  intentionalLeaveRef: { current: false },
});

export function UploadGuardProvider({ children }: { children: React.ReactNode }) {
  const [isGuardActive, setGuardActive] = useState(false);
  const cancelUploadRef = useRef<(() => void) | null>(null);
  const intentionalLeaveRef = useRef(false);

  return (
    <UploadGuardContext.Provider
      value={{ isGuardActive, setGuardActive, cancelUploadRef, intentionalLeaveRef }}
    >
      {children}
    </UploadGuardContext.Provider>
  );
}

export function useUploadGuard() {
  return useContext(UploadGuardContext);
}
