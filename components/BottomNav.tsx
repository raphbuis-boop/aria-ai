"use client";

import { createClient } from "@/lib/supabase/client";
import {
  CalendarClock,
  House,
  Mic,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
};

const LEFT_TABS: Tab[] = [
  { href: "/dashboard", label: "Today", Icon: House, exact: true },
  { href: "/clients", label: "Leads", Icon: Users },
];

const RIGHT_TABS: Tab[] = [
  { href: "/showings", label: "Timeline", Icon: CalendarClock },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function TabItem({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      className="flex flex-1 flex-col items-center justify-center gap-[5px] py-2.5 active:opacity-60"
      aria-label={tab.label}
      style={{ transition: "opacity 80ms ease" }}
    >
      <tab.Icon
        size={21}
        strokeWidth={active ? 2.2 : 1.5}
        style={{
          color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.28)",
          transition: "color 150ms ease",
        }}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: active ? 600 : 400,
          letterSpacing: "0.01em",
          color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.28)",
          transition: "color 150ms ease",
        }}
      >
        {tab.label}
      </span>
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const supabase = createClient();
  const [inboxUnread, setInboxUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", user.id)
        .eq("ai_draft", true)
        .eq("approved", false);
      if (!cancelled) setInboxUnread(count ?? 0);
    }
    load();
    const id = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [supabase]);

  function isActive(tab: Tab) {
    if (tab.exact) return pathname === tab.href;
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  }

  const voiceActive = pathname === "/voice";

  // suppress unused warning — badge logic kept for future inbox tab
  void inboxUnread;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      }}
    >
      <nav
        className="flex w-full max-w-[380px] items-end"
        style={{
          background: "rgba(8, 9, 18, 0.88)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          borderRadius: 26,
          border: "0.5px solid rgba(255,255,255,0.06)",
          boxShadow:
            "0 12px 40px rgba(0,0,0,0.65), 0 0 0 0.5px rgba(255,255,255,0.03) inset",
        }}
      >
        {LEFT_TABS.map((tab) => (
          <TabItem key={tab.href} tab={tab} active={isActive(tab)} />
        ))}

        {/* Center mic bubble */}
        <div className="flex flex-col items-center justify-end pb-2.5 px-3">
          <Link
            href="/voice"
            aria-label="Voice assistant"
            className="flex items-center justify-center rounded-full"
            style={{
              width: 48,
              height: 48,
              marginTop: -14,
              background: voiceActive
                ? "rgba(76, 122, 255, 0.15)"
                : "rgba(14, 17, 35, 0.98)",
              border: voiceActive
                ? "0.5px solid rgba(76, 122, 255, 0.4)"
                : "0.5px solid rgba(255,255,255,0.07)",
              boxShadow: voiceActive
                ? "0 0 0 6px rgba(76,122,255,0.08), 0 0 20px rgba(76,122,255,0.35)"
                : "0 0 0 1px rgba(76,122,255,0.06), 0 0 14px rgba(76,122,255,0.18), 0 4px 20px rgba(0,0,0,0.7)",
              transition: "all 250ms ease",
            }}
          >
            <Mic
              size={18}
              strokeWidth={1.6}
              style={{
                color: voiceActive ? "rgba(76,122,255,0.9)" : "rgba(76,122,255,0.65)",
                transition: "color 250ms ease",
              }}
            />
          </Link>
          <span
            style={{
              fontSize: 10,
              fontWeight: voiceActive ? 600 : 400,
              marginTop: 5,
              color: voiceActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.22)",
              transition: "color 200ms ease",
            }}
          >
            Voice
          </span>
        </div>

        {RIGHT_TABS.map((tab) => (
          <TabItem key={tab.href} tab={tab} active={isActive(tab)} />
        ))}
      </nav>
    </div>
  );
}
