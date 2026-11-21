import { createContext, useContext } from "react";

/** Whether the Amplify backend is configured. Without it RateLama runs in the local draft mode. */
export const AppModeContext = createContext<{ cloud: boolean }>({ cloud: false });

export function useAppMode() {
  return useContext(AppModeContext);
}
