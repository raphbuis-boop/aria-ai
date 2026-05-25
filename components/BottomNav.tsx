"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  Ellipsis,
  House,
  Mic,
  Users,
  type LucideIcon,
} from "lucide-react";

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  // Additional hrefs that should count as "active" for this tab
  activeFor?: string[];
};

const TABS: Tab[] = [
  { href: "/dashboard", label: "Today", Icon: House },
  { href: "/people", label: "People", Icon: Users, activeFor: ["/clients", "/inbox", "/pipeline"] },
  { href: "/properties", label: "Properties", Icon: Building2, activeFor: ["/listings", "/properties"] },
  { href: "/deals", label: "Deals", Icon: Briefcase, activeFor: ["/transactions", "/showings", "/cma"] },
  { href: "/more", label: "More", Icon: Ellipsis, activeFor: ["/settings", "/voice", "/referrals", "/market-pulse"] },
];

function isTabActive(tab: Tab, pathname: string): boolean {
  if (pathname === tab.href) return true;
  if (pathname.startsWith(tab.href + "/")) return true;
  return (tab.activeFor ?? []).some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Floating voice button — centered, 96px above nav */}
      <div
        className="fixed z-50 left-1/2"
        style={{ bottom: "calc(max(12px, env(safe-area-inset-bottom)) + 64px + 96px)", transform: "translateX(-50%)" }}
      >
        <button
          type="button"
          aria-label="Voice assistant"
          onClick={() => router.push("/voice")}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 56,
            height: 56,
            background: "#3B82F6",
            boxShadow: "0 4px 24px rgba(59,130,246,0.5), 0 2px 8px rgba(0,0,0,0.6)",
          }}
        >
          <Mic size={22} strokeWidth={1.8} color="#ffffff" />
        </button>
      </div>

      {/* Bottom tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: "#000000",
          borderTop: "1px solid #222222",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <nav className="flex items-stretch">
          {TABS.map((tab) => {
            const active = isTabActive(tab, pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-1 flex-col items-center justify-center gap-[5px] pt-2.5 pb-1 active:opacity-60"
                style={{ transition: "opacity 80ms ease" }}
                aria-label={tab.label}
              >
                <tab.Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.6}
                  style={{ color: active ? "#ffffff" : "#6B7280" }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: active ? 600 : 400,
                    color: active ? "#ffffff" : "#6B7280",
                    letterSpacing: "0.01em",
                  }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
