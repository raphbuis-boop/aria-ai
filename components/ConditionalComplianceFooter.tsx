"use client";

import { ComplianceFooter } from "@/components/ComplianceFooter";
import { usePathname } from "next/navigation";

/** Only public / marketing routes get the brokerage footer — not the authenticated CRM (`BottomNav`). */
export function ConditionalComplianceFooter() {
  const pathname = usePathname();

  /** Full-screen auth + marketing HTML — avoid IDX/chrome/stacking clashes. */
  const hideComplianceFooter =
    pathname === "/" ||
    pathname === "/landing" ||
    pathname === "/signup" ||
    pathname.startsWith("/login");

  if (hideComplianceFooter) return null;

  const publicPrefixes = [
    "/property-search",
    "/setup",
    "/privacy",
    "/terms",
    "/about",
    "/contact",
    "/dmca",
    "/accessibility",
    "/fair-housing",
    "/demo",
    "/portal",
    "/bba/sign",
  ] as const;

  const isPublic = publicPrefixes.some((p) => pathname.startsWith(p));

  if (!isPublic) return null;

  const idxNoticeOff = pathname.startsWith("/property-search");
  return <ComplianceFooter includeIdxNotice={!idxNoticeOff} />;
}
