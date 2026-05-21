"use client";

import { createClient } from "@/lib/supabase/client";
import {
  Building2,
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
  { href: "/listings", label: "MLS", Icon: Building2 },
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
      className="flex flex-1 flex-col items-center justify-center gap-[3px] py-2"
      aria-label={tab.label}
    >
      <span className="relative">
        <tab.Icon
          size={23}
          strokeWidth={active ? 2.2 : 1.7}
          className={active ? "text-[#3a65f0]" : "text-[#464760]"}
        />
        {badge && badge > 0 ? (
          <span className="absolute -right-1.5 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-md bg-[#c43838] px-1 text-[9px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className={`text-[10px] font-medium ${active ? "text-[#3a65f0]" : "text-[#464760]"}`}>
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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#181b24] bg-[#060709]/96 backdrop-blur-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex w-full items-center">
        {/* Left two tabs */}
        {LEFT_TABS.map((tab) => (
          <TabItem
            key={tab.href}
            tab={tab}
            active={isActive(tab)}
            badge={tab.href === "/inbox" ? inboxUnread : undefined}
          />
        ))}

        {/* Center glowing mic bubble */}
        <div className="flex flex-1 flex-col items-center justify-center py-1">
          <Link
            href="/voice"
            aria-label="Voice assistant"
            className="flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full transition-transform active:scale-90"
            style={{
              background: "radial-gradient(circle at 35% 35%, #5577ff, #2a45d0)",
              boxShadow: voiceActive
                ? "0 0 0 4px #3a65f020, 0 0 28px rgba(58,101,240,0.7), 0 0 56px rgba(58,101,240,0.3)"
                : "0 0 0 1px #3a65f030, 0 0 20px rgba(58,101,240,0.45), 0 0 40px rgba(58,101,240,0.15)",
            }}
          >
            <Mic size={22} strokeWidth={2} className="text-white" />
          </Link>
          <span className={`-mt-1 text-[10px] font-medium ${voiceActive ? "text-[#3a65f0]" : "text-[#464760]"}`}>
            Voice
          </span>
        </div>

        {/* Right two tabs */}
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
