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
  badge?: boolean;
};

const LEFT_TABS: Tab[] = [
  { href: "/dashboard", label: "Today", Icon: House, exact: true },
  { href: "/clients", label: "Leads", Icon: Users },
];

const RIGHT_TABS: Tab[] = [
  { href: "/showings", label: "Timeline", Icon: CalendarClock },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function TabItem({
  tab,
  active,
  badge,
}: {
  tab: Tab;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={tab.href}
      className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
      aria-label={tab.label}
    >
      <span className="relative flex items-center justify-center">
        <tab.Icon
          size={22}
          strokeWidth={active ? 2.2 : 1.7}
          className={active ? "text-[#3a65f0]" : "text-[#3e4058]"}
        />
        {badge && badge > 0 ? (
          <span className="absolute -right-2 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#c43838] px-1 text-[9px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className={`text-[10px] font-medium tracking-wide ${active ? "text-[#3a65f0]" : "text-[#3e4058]"}`}>
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
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#06060d]/95 backdrop-blur-2xl"
      style={{
        borderTop: "0.5px solid #1a1d2a",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="relative flex w-full items-end">
        {/* Left tabs */}
        {LEFT_TABS.map((tab) => (
          <TabItem
            key={tab.href}
            tab={tab}
            active={isActive(tab)}
            badge={tab.badge ? inboxUnread : undefined}
          />
        ))}

        {/* Center floating mic */}
        <div className="flex flex-1 flex-col items-center pb-1">
          <Link
            href="/voice"
            aria-label="Voice assistant"
            className="mb-1 flex items-center justify-center rounded-full transition-transform active:scale-90"
            style={{
              width: 56,
              height: 56,
              marginTop: -20,
              background: "linear-gradient(145deg, #4a72ff 0%, #2040c8 100%)",
              boxShadow: voiceActive
                ? "0 0 0 6px rgba(58,101,240,0.15), 0 0 32px rgba(58,101,240,0.6), 0 0 64px rgba(58,101,240,0.25), 0 4px 24px rgba(0,0,0,0.6)"
                : "0 0 0 1px rgba(58,101,240,0.2), 0 0 20px rgba(58,101,240,0.35), 0 0 48px rgba(58,101,240,0.12), 0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <Mic size={22} strokeWidth={2} className="text-white" />
          </Link>
          <span className={`text-[10px] font-medium tracking-wide ${voiceActive ? "text-[#3a65f0]" : "text-[#3e4058]"}`}>
            Voice
          </span>
        </div>

        {/* Right tabs */}
        {RIGHT_TABS.map((tab) => (
          <TabItem
            key={tab.href}
            tab={tab}
            active={isActive(tab)}
          />
        ))}
      </div>
    </nav>
  );
}
