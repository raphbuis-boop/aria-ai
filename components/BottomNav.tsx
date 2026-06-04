"use client";

// BottomNav — floating glass pill navigation.
//
// 5 tabs: Today / Clients / Aria (center) / Conversations / Profile
// Icons only — no labels. Active = white, inactive = #5A5A6E.
// Icon size 26px on regular tabs, center Aria button 48px circle.
//
// Safe-area contract:
//   bottom = env(safe-area-inset-bottom) + 16px
//   Nothing else inside this component touches safe areas.

import { motion } from "framer-motion";
import { Home, Users, MessageSquare, UserCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type Tab = {
  key: string;
  href: string;
  Icon: React.ElementType;
  activeFor?: string[];
};

const TABS_LEFT: Tab[] = [
  { key: "today",   href: "/dashboard", Icon: Home  },
  { key: "clients", href: "/people",    Icon: Users, activeFor: ["/clients", "/pipeline"] },
];

const TABS_RIGHT: Tab[] = [
  { key: "conversations", href: "/inbox",   Icon: MessageSquare, activeFor: ["/inbox"] },
  { key: "profile",       href: "/profile", Icon: UserCircle,    activeFor: ["/more", "/settings", "/referrals", "/market-pulse"] },
];

function isActive(href: string, activeFor: string[] | undefined, pathname: string): boolean {
  if (pathname === href) return true;
  if (pathname.startsWith(href + "/")) return true;
  return (activeFor ?? []).some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  } catch { /* never break */ }
}

function NavIcon({ tab, pathname }: { tab: Tab; pathname: string }) {
  const router = useRouter();
  const active = isActive(tab.href, tab.activeFor, pathname);

  return (
    <motion.button
      type="button"
      aria-label={tab.key}
      whileTap={{ scale: 0.82 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      onClick={() => { triggerHaptic(); router.push(tab.href); }}
      className="flex items-center justify-center"
      style={{ padding: "6px 10px", background: "none", border: "none" }}
    >
      <tab.Icon
        size={26}
        strokeWidth={active ? 2.1 : 1.6}
        color={active ? "#ffffff" : "#5A5A6E"}
      />
    </motion.button>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Conversations → /voice
  const ariaActive = pathname === "/voice" || pathname.startsWith("/voice/") || pathname === "/ai";

  return (
    <div
      className="fixed left-1/2 z-50"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 16px)",
        transform: "translateX(-50%)",
        width: "87%",
        maxWidth: 360,
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{
          borderRadius: 999,
          padding: "10px 16px",
          background: "rgba(18, 18, 20, 0.72)",
          backdropFilter: "blur(32px) saturate(200%)",
          WebkitBackdropFilter: "blur(32px) saturate(200%)",
          border: "0.5px solid rgba(255,255,255,0.09)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.06) inset",
        }}
      >
        {/* Left tabs */}
        {TABS_LEFT.map((tab) => (
          <NavIcon key={tab.key} tab={tab} pathname={pathname} />
        ))}

        {/* Center — Aria button */}
        <motion.button
          type="button"
          aria-label="Aria"
          whileTap={{ scale: 0.86 }}
          transition={{ type: "spring", stiffness: 460, damping: 24 }}
          onClick={() => { triggerHaptic(); router.push("/voice"); }}
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: 48,
            height: 48,
            background: "linear-gradient(145deg, #1c2333, #0e1420)",
            boxShadow: ariaActive
              ? "0 0 20px rgba(59,130,246,0.65), 0 0 6px rgba(59,130,246,0.4), inset 0 0 0 1px rgba(59,130,246,0.35)"
              : "0 0 16px rgba(59,130,246,0.30), 0 4px 12px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.09)",
          }}
        >
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="22" height="22" aria-hidden="true">
            <defs>
              <linearGradient id="aria-nav-grad" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={ariaActive ? "#93C5FD" : "#60A5FA"} />
                <stop offset="100%" stopColor={ariaActive ? "#3B82F6" : "#1D4ED8"} />
              </linearGradient>
            </defs>
            <path
              d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z"
              fill="url(#aria-nav-grad)"
            />
          </svg>
        </motion.button>

        {/* Right tabs */}
        {TABS_RIGHT.map((tab) => (
          <NavIcon key={tab.key} tab={tab} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}
