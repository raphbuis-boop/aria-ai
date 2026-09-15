"use client";

// BottomNav — floating tab bar, WhatsApp-style dark glass pill.
//
// 5 slots, left to right: Today / Clients / Aria (raised center orb) / Follow-ups / Properties
// Icon + label per tab (WhatsApp layout). The active tab gets a filled,
// rounded highlight that slides between tabs (shared layoutId). The pill is a
// dark charcoal glass surface that floats over the ivory app content. The
// center Aria button is a raised, breathing blue orb (matching the landing
// page) with the white "A" mark on top.
//
// Safe-area contract: bottom offset includes env(safe-area-inset-bottom).

import { motion } from "framer-motion";
import { Home, Users, MessageSquare, Building2, LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

type Tab = {
  key: string;
  label: string;
  href: string;
  Icon: React.ElementType;
  activeFor?: string[];
};

const TABS_LEFT: Tab[] = [
  { key: "today", label: "Today", href: "/dashboard", Icon: Home },
  { key: "clients", label: "Clients", href: "/clients", Icon: Users, activeFor: ["/people", "/pipeline"] },
];

const TABS_RIGHT: Tab[] = [
  { key: "followups", label: "Follow-ups", href: "/inbox", Icon: MessageSquare, activeFor: ["/inbox"] },
  { key: "properties", label: "Properties", href: "/properties", Icon: Building2, activeFor: ["/properties", "/mls", "/listings"] },
];

const TAP_SPRING = { type: "spring", stiffness: 500, damping: 28 } as const;

function isActive(href: string, activeFor: string[] | undefined, pathname: string): boolean {
  if (pathname === href) return true;
  if (pathname.startsWith(href + "/")) return true;
  return (activeFor ?? []).some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  } catch {
    /* never break */
  }
}

function TabButton({ tab, pathname }: { tab: Tab; pathname: string }) {
  const router = useRouter();
  const active = isActive(tab.href, tab.activeFor, pathname);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch(tab.href);
  }, [router, tab.href, pathname]);

  return (
    <motion.button
      type="button"
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
      aria-busy={pending}
      whileTap={{ scale: 0.9 }}
      transition={TAP_SPRING}
      onClick={() => {
        triggerHaptic();
        if (pathname === tab.href || pending) return;
        startTransition(() => router.push(tab.href));
      }}
      className="relative flex flex-col items-center justify-center gap-0.5 rounded-2xl"
      style={{ width: 60, height: 50 }}
    >
      {/* Sliding filled highlight behind the active tab (WhatsApp style) */}
      {active && (
        <motion.span
          layoutId="nav-glass"
          className="absolute inset-0 rounded-2xl"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          style={{
            background: "rgba(120,120,128,0.26)",
            boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.12)",
          }}
        />
      )}
      <span className="relative z-10 flex flex-col items-center gap-0.5">
        {pending ? (
          <LoaderCircle className="size-[22px] animate-spin" style={{ color: "#fff" }} aria-label={`Opening ${tab.label}`} />
        ) : (
          <tab.Icon
            className="size-[22px]"
            style={{ color: active ? "#ffffff" : "#8e8e93" }}
            strokeWidth={active ? 2.2 : 1.9}
          />
        )}
        <span
          className="text-[10px] font-medium leading-none tracking-tight"
          style={{ color: active ? "#ffffff" : "#8e8e93" }}
        >
          {tab.label}
        </span>
      </span>
    </motion.button>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const ariaActive = pathname === "/voice" || pathname.startsWith("/voice/") || pathname === "/ai";

  return (
    <div
      className="fixed left-1/2 z-50"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 16px)",
        transform: "translateX(-50%)",
      }}
    >
      <div
        className="relative flex items-center gap-1 rounded-[30px] px-2.5"
        style={{
          height: 66,
          background: "rgba(28, 28, 30, 0.72)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 2px rgba(0,0,0,0.30), 0 18px 40px -12px rgba(0,0,0,0.55)",
        }}
      >
        {/* Subtle top specular gloss, clipped to the pill */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
          <div
            className="absolute inset-x-0 top-0 h-1/2"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 100%)" }}
          />
        </div>

        {TABS_LEFT.map((tab) => (
          <TabButton key={tab.key} tab={tab} pathname={pathname} />
        ))}

        {/* Center spacer — reserves room for the raised Aria orb */}
        <div style={{ width: 62 }} aria-hidden="true" />

        {TABS_RIGHT.map((tab) => (
          <TabButton key={tab.key} tab={tab} pathname={pathname} />
        ))}

        {/* Raised center Aria orb — overlaps the top edge of the pill.
            Centering lives on a static wrapper so the whileTap scale transform
            can't clobber translateX(-50%) and make the button lurch sideways. */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -20 }}>
          <motion.button
            type="button"
            aria-label="Aria"
            aria-busy={pending}
            whileTap={{ scale: 0.9 }}
            animate={{
              scale: [1, 1.06, 1],
              boxShadow: [
                "0 0 0 3px var(--background), 0 0 0 8px rgba(79,123,255,0.06), 0 0 0 16px rgba(79,123,255,0.03), 0 10px 30px rgba(79,123,255,0.35)",
                "0 0 0 3px var(--background), 0 0 0 11px rgba(79,123,255,0.08), 0 0 0 22px rgba(79,123,255,0.04), 0 12px 40px rgba(79,123,255,0.45)",
                "0 0 0 3px var(--background), 0 0 0 8px rgba(79,123,255,0.06), 0 0 0 16px rgba(79,123,255,0.03), 0 10px 30px rgba(79,123,255,0.35)",
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            onClick={() => {
              triggerHaptic();
              if (pathname === "/voice" || pending) return;
              startTransition(() => router.push("/voice"));
            }}
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: 56,
              height: 56,
              background: "radial-gradient(circle at 38% 35%, #6f9bff, #4f7bff 50%, #2a4acc)",
            }}
          >
            {/* Pulsing halo ring — matches the landing orb's ::after */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute rounded-full"
              style={{
                inset: -6,
                border: ariaActive
                  ? "1px solid rgba(107,143,255,0.55)"
                  : "0.5px solid rgba(79,123,255,0.28)",
              }}
              animate={{ scale: [1, 1.14, 1], opacity: [0.9, 0.4, 0.9] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Glossy top-left highlight — gives the sphere its 3D read */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[5px] h-1/3 w-1/2 -translate-x-1/2 rounded-full"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.6), transparent)" }}
            />
            <svg
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              aria-hidden="true"
              className="relative z-10"
            >
              <path
                d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z"
                fill="#ffffff"
              />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
