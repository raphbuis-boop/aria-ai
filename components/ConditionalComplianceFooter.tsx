"use client";

import { ComplianceFooter } from "@/components/ComplianceFooter";
import { usePathname } from "next/navigation";

/** Only public / marketing routes get the brokerage footer — not the authenticated CRM (`BottomNav`). */
export function ConditionalComplianceFooter() {
  const pathname = usePathname();

  const publicPrefixes = [
    "/property-search",
    "/login",
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

  const isPublic =
    pathname === "/" ||
    pathname === "/landing" ||
    publicPrefixes.some((p) => pathname.startsWith(p));

  if (!isPublic) return null;

  const idxNoticeOff = pathname.startsWith("/property-search");
  return <ComplianceFooter includeIdxNotice={!idxNoticeOff} />;
}
