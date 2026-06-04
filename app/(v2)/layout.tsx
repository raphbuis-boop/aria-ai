import * as React from "react";
import { V2Providers } from "./providers";
import { V2Shell } from "./shell";

/**
 * v2 route-group layout.
 *
 * app/(v2)/ wraps ONLY the v2 prototype routes. The existing
 * app/(dashboard)/ layout is untouched and continues to serve the live app.
 *
 * Phase 1: providers + nav shell only. No auth gate — v2 routes are
 * development-only scaffolding until Phase 3.
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <V2Providers>
      <V2Shell>{children}</V2Shell>
    </V2Providers>
  );
}
