"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Users, Building2, Settings, type LucideIcon } from "lucide-react";

type Tab = {
  href: string;
  Icon: LucideIcon;
  activeFor?: string[];
};

const TABS_LEFT: Tab[] = [
  { href: "/dashboard", Icon: Home },
  { href: "/people", Icon: Users, activeFor: ["/clients", "/inbox", "/pipeline"] },
];

const TABS_RIGHT: Tab[] = [
  { href: "/properties", Icon: Building2, activeFor: ["/listings", "/property-search"] },
  { href: "/settings", Icon: Settings, activeFor: ["/more", "/voice", "/referrals", "/market-pulse"] },
];

function isTabActive(tab: Tab, pathname: string): boolean {
  if (pathname === tab.href) return true;
  if (pathname.startsWith(tab.href + "/")) return true;
  return (tab.activeFor ?? []).some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {
    // never break on haptic failure
  }
}

function NavTab({ tab, pathname }: { tab: Tab; pathname: string }) {
  const router = useRouter();
  const active = isTabActive(tab, pathname);
  return (
    <button
      type="button"
      aria-label={tab.href.replace("/", "")}
      onClick={() => { triggerHaptic(); router.push(tab.href); }}
      style={{ padding: "4px 8px", background: "transparent", border: "none" }}
    >
      <tab.Icon
        size={20}
        strokeWidth={active ? 2.2 : 1.6}
        style={{ color: active ? "#ffffff" : "#6B7280" }}
      />
    </button>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Soft fade gradient above the nav — lets content scroll behind cleanly */}
      <div
        className="fixed bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: 140,
          background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, transparent)",
          zIndex: 40,
        }}
      />

      {/* Floating pill nav */}
      <div
        className="fixed left-1/2 z-50 flex items-center justify-around"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 12px)",
          transform: "translateX(-50%)",
          width: "calc(100% - 32px)",
          maxWidth: 340,
          borderRadius: 999,
          padding: "10px 14px",
          background: "rgba(20,20,22,0.55)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: "0.5px solid rgba(255,255,255,0.10)",
          boxShadow: "0 0 40px rgba(59,130,246,0.18), 0 10px 30px rgba(0,0,0,0.5)",
          pointerEvents: "auto",
          overflow: "visible",
        }}
      >
        {/* Left tabs */}
        {TABS_LEFT.map((tab) => (
          <NavTab key={tab.href} tab={tab} pathname={pathname} />
        ))}

        {/* Center Aria button */}
        <button
          type="button"
          aria-label="Ask Aria"
          onClick={() => { console.log('aria button tapped'); triggerHaptic(); router.push("/voice"); }}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 48,
            height: 48,
            background: "linear-gradient(135deg, #1a1a1d, #0a0a0c)",
            boxShadow: "0 0 24px rgba(59,130,246,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)",
            flexShrink: 0,
            pointerEvents: "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Aria "A" logo inline SVG at 22px */}
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="22" height="22">
            <defs>
              <linearGradient id="nav-aria-grad" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
            </defs>
            <path
              d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z"
              fill="url(#nav-aria-grad)"
            />
          </svg>
        </button>

        {/* Right tabs */}
        {TABS_RIGHT.map((tab) => (
          <NavTab key={tab.href} tab={tab} pathname={pathname} />
        ))}
      </div>
    </>
  );
}
