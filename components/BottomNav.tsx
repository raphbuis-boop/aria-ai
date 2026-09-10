"use client";

// BottomNav — floating pill tab bar, warm ivory/green design system.
//
// 5 slots, left to right: Today / Clients / Aria (raised center) / Follow-ups / Properties
// Icon-only, rounded pill, elevated with margin off the screen edges — not
// anchored full-width. Cream/white surface (bg-card) with a soft shadow,
// matching the warm canvas rather than the app's old dark glass nav.
// Active = primary green, inactive = muted. The center Aria button is a
// raised, filled green circle that pokes above the pill's top edge.
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
      whileTap={{ scale: 0.88 }}
      transition={TAP_SPRING}
      onClick={() => {
        triggerHaptic();
        if (pathname === tab.href || pending) return;
        startTransition(() => router.push(tab.href));
      }}
      className="relative flex items-center justify-center"
      style={{ width: 44, height: 44 }}
    >
      {active && (
        <motion.span
          layoutId="nav-glass"
          className="absolute inset-0 overflow-hidden rounded-full"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          style={{
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.9) 0%, rgba(31,92,70,0.18) 48%, rgba(31,92,70,0.06) 100%)",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow:
              "inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -2px 5px rgba(31,92,70,0.14), 0 5px 12px -2px rgba(31,92,70,0.28)",
          }}
        >
          <span
            aria-hidden
            className="absolute left-1/2 top-[3px] h-1/3 w-2/3 -translate-x-1/2 rounded-full"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.78), transparent)" }}
          />
        </motion.span>
      )}
      <span className="relative z-10">
        {pending ? (
          <LoaderCircle className="size-6 animate-spin text-primary" aria-label={`Opening ${tab.label}`} />
        ) : (
          <tab.Icon
            className={active ? "size-6 text-primary" : "size-6 text-muted-foreground"}
            strokeWidth={active ? 2.2 : 1.7}
          />
        )}
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
        bottom: "calc(env(safe-area-inset-bottom) + 18px)",
        transform: "translateX(-50%)",
      }}
    >
      <div
        className="relative flex items-center gap-1 rounded-full px-3"
        style={{
          height: 64,
          background: "rgba(255, 253, 249, 0.55)",
          backdropFilter: "blur(32px) saturate(200%)",
          WebkitBackdropFilter: "blur(32px) saturate(200%)",
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 3px rgba(43,36,25,0.06), 0 2px 4px rgba(43,36,25,0.05), 0 20px 40px -14px rgba(43,36,25,0.30)",
        }}
      >
        {/* Glass overlays — clipped to the pill so they never touch the raised Aria button */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          {/* curved top specular gloss */}
          <div
            className="absolute inset-x-0 top-0 h-1/2"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)" }}
          />
          {/* slow liquid shimmer sweep */}
          <motion.div
            className="absolute inset-y-0 w-24"
            initial={{ x: -140 }}
            animate={{ x: 380 }}
            transition={{ duration: 6, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
            style={{
              background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.38), transparent)",
              filter: "blur(6px)",
            }}
          />
        </div>
        {TABS_LEFT.map((tab) => (
          <TabButton key={tab.key} tab={tab} pathname={pathname} />
        ))}

        {/* Center spacer — reserves room for the raised Aria button */}
        <div style={{ width: 60 }} aria-hidden="true" />

        {TABS_RIGHT.map((tab) => (
          <TabButton key={tab.key} tab={tab} pathname={pathname} />
        ))}

        {/* Raised center Aria button — overlaps the top edge of the pill.
            Centering lives on a static wrapper so the whileTap scale transform
            can't clobber translateX(-50%) and make the button lurch sideways. */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: -18 }}
        >
        <motion.button
          type="button"
          aria-label="Aria"
          aria-busy={pending}
          whileTap={{ scale: 0.9 }}
          transition={TAP_SPRING}
          onClick={() => {
            triggerHaptic();
            if (pathname === "/voice" || pending) return;
            startTransition(() => router.push("/voice"));
          }}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 56,
            height: 56,
            background: "linear-gradient(160deg, #2b8060 0%, var(--primary) 62%)",
            boxShadow: ariaActive
              ? "inset 0 1px 1px rgba(255,255,255,0.35), 0 6px 18px rgba(31,92,70,0.5), 0 0 0 4px var(--background), 0 0 0 5px var(--primary)"
              : "inset 0 1px 1px rgba(255,255,255,0.35), 0 6px 18px rgba(31,92,70,0.4), 0 0 0 4px var(--background)",
          }}
        >
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="22" height="22" aria-hidden="true">
            <path
              d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z"
              fill="var(--primary-foreground)"
            />
          </svg>
        </motion.button>
        </div>
      </div>
    </div>
  );
}
