"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/NotificationPanel";

const TITLE_BY_PATH: Record<string, string> = {
  "/clients":      "Clients",
  "/people":       "Clients",
  "/properties":   "Properties",
  "/mls":          "MLS Search",
  "/listings":     "MLS Search",
  "/inbox":        "Inbox",
  "/pipeline":     "Pipeline",
  "/showings":     "Showings",
  "/transactions": "Transactions",
  "/cma":          "CMA",
  "/market-pulse": "Market",
  "/referrals":    "Referrals",
  "/voice":        "Ask Aria",
  "/settings":     "Settings",
};

function getTitle(pathname: string): string {
  // Exact match first
  if (TITLE_BY_PATH[pathname]) return TITLE_BY_PATH[pathname];
  // Prefix match for detail routes — /clients/abc123 → "Clients"
  for (const [path, title] of Object.entries(TITLE_BY_PATH)) {
    if (pathname.startsWith(path + "/")) return title;
  }
  return "";
}

export function AppHeader() {
  const pathname = usePathname();

  // Today screen has its own custom greeting header
  if (pathname === "/dashboard") return null;

  const title = getTitle(pathname);

  return (
    <header
      className="sticky top-0 z-30 flex items-center px-3"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 14px)",
        paddingBottom: "14px",
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      <Image src="/aria-logo.svg" alt="Aria" width={28} height={28} priority />
      {title ? (
        <span
          className="ml-3 text-[14px] font-medium"
          style={{ color: "#ffffff" }}
        >
          {title}
        </span>
      ) : null}
      <div className="ml-auto">
        <NotificationBell />
      </div>
    </header>
  );
}
