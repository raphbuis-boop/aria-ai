"use client";

import { createContext, useContext } from "react";

/**
 * Whether a real MLS feed is configured (SimplyRETS credentials set), decided
 * on the server in the root layout. NJMLS IDX branding (logo, disclaimer,
 * photo marks) only renders when it's true.
 */
const MlsLiveContext = createContext(false);

export function MlsStatusProvider({ live, children }: { live: boolean; children: React.ReactNode }) {
  return <MlsLiveContext.Provider value={live}>{children}</MlsLiveContext.Provider>;
}

export function useMlsLive(): boolean {
  return useContext(MlsLiveContext);
}
