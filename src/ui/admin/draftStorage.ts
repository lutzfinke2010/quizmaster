import { createContext, useContext } from "react";

/**
 * Local draft mode only: drafts are read from / written to localStorage only after the explicit opt-in.
 * The switch lives in App so it survives navigation between overview and editor; it is never persisted.
 */
export const DraftStorageContext = createContext<{ enabled: boolean; setEnabled: (enabled: boolean) => void }>({
  enabled: false,
  setEnabled: () => undefined,
});

export function useDraftStorage() {
  return useContext(DraftStorageContext);
}
