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

function TabItem({ tab, active, badge }: { tab: Tab; active: boolean; badge?: number }) {
  return (
    <Link
      href={tab.href}
      className="flex flex-1 flex-col items-center justify-end gap-1 pb-1 pt-2"
      aria-label={tab.label}
    >
      <span className="relative flex items-center justify-center">
        <tab.Icon
          size={22}
          strokeWidth={active ? 2.2 : 1.6}
          className={active ? "text-white" : "text-[#3a3d52]"}
        />
        {badge && badge > 0 ? (
          <span className="absolute -right-2 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#c43838] px-1 text-[9px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className={`text-[9px] font-medium tracking-wide ${active ? "text-white" : "text-[#3a3d52]"}`}>
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

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <nav
        className="flex w-full max-w-sm items-end overflow-hidden rounded-[28px]"
        style={{
          background: "rgba(10, 11, 18, 0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "0.5px solid rgba(255,255,255,0.07)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        {LEFT_TABS.map((tab) => (
          <TabItem key={tab.href} tab={tab} active={isActive(tab)} badge={tab.href === "/inbox" ? inboxUnread : undefined} />
        ))}

        {/* Center mic */}
        <div className="flex flex-col items-center justify-end pb-1 px-2 pt-1">
          <Link
            href="/voice"
            aria-label="Voice assistant"
            className="flex items-center justify-center rounded-full transition-transform active:scale-90"
            style={{
              width: 52,
              height: 52,
              marginTop: -16,
              background: "rgba(12, 14, 22, 0.95)",
              border: voiceActive
                ? "1px solid rgba(100, 140, 255, 0.5)"
                : "1px solid rgba(255,255,255,0.08)",
              boxShadow: voiceActive
                ? "0 0 0 4px rgba(58,101,240,0.12), 0 0 24px rgba(58,101,240,0.55), 0 0 48px rgba(58,101,240,0.2)"
                : "0 0 0 1px rgba(58,101,240,0.08), 0 0 16px rgba(58,101,240,0.25), 0 4px 16px rgba(0,0,0,0.6)",
            }}
          >
            <Mic
              size={20}
              strokeWidth={1.8}
              className={voiceActive ? "text-[#6b8fff]" : "text-[#4a6ae8]"}
            />
          </Link>
          <span className={`mt-1 text-[9px] font-medium tracking-wide ${voiceActive ? "text-white" : "text-[#3a3d52]"}`}>
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
