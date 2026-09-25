"use client";

// BottomNav — floating tab bar on the ivory canvas.
//
// 5 slots, left to right: Today / Clients / Aria (raised center button) / Follow-ups / Properties
// The active tab gets a soft green highlight that slides between tabs
// (shared layoutId). Colors come from the theme tokens, so it follows dark mode.
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
  { key: "clients", label: "Clients", href: "/clients", Icon: Users, activeFor: ["/showings", "/transactions"] },
];

const TABS_RIGHT: Tab[] = [
  { key: "followups", label: "Follow-ups", href: "/inbox", Icon: MessageSquare, activeFor: ["/emails", "/inquiries"] },
  { key: "properties", label: "Properties", href: "/properties", Icon: Building2, activeFor: ["/listings"] },
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
          className="absolute inset-0 rounded-2xl bg-primary/10"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <span className="relative z-10 flex flex-col items-center gap-0.5">
        {pending ? (
          <LoaderCircle className="size-[22px] animate-spin text-primary" aria-label={`Opening ${tab.label}`} />
        ) : (
          <tab.Icon
            className={active ? "size-[22px] text-primary" : "size-[22px] text-muted-foreground"}
            strokeWidth={active ? 2.2 : 1.9}
          />
        )}
        <span
          className={`text-[10px] font-medium leading-none tracking-tight ${active ? "text-primary" : "text-muted-foreground"}`}
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

  const ariaActive = pathname === "/voice" || pathname.startsWith("/voice/");

  return (
    <div
      className="fixed left-1/2 z-50"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 16px)",
        transform: "translateX(-50%)",
      }}
    >
      <nav
        aria-label="Main"
        className="relative flex items-center gap-1 rounded-[30px] border border-border bg-card/90 px-2.5 shadow-float backdrop-blur-xl"
        style={{ height: 66 }}
      >

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
            aria-label="Ask Aria"
            aria-current={ariaActive ? "page" : undefined}
            aria-busy={pending}
            whileTap={{ scale: 0.9 }}
            transition={TAP_SPRING}
            onClick={() => {
              triggerHaptic();
              if (pathname === "/voice" || pending) return;
              startTransition(() => router.push("/voice"));
            }}
            className="relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_4px_var(--background),0_10px_24px_-6px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
          >
            {pending ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <svg viewBox="0 0 200 200" width="22" height="22" aria-hidden="true">
                <path d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z" fill="currentColor" />
              </svg>
            )}
          </motion.button>
        </div>
      </nav>
    </div>
  );
}
