"use client";

import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  House,
  MessageSquare,
  Mic,
  Sparkles,
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

const TABS: Tab[] = [
  { href: "/dashboard", label: "Today", Icon: House, exact: true },
  { href: "/clients", label: "Leads", Icon: Users },
  { href: "/inbox", label: "Inbox", Icon: MessageSquare },
  { href: "/listings", label: "MLS", Icon: Building2 },
  { href: "/ai", label: "Aria AI", Icon: Sparkles },
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
          size={24}
          strokeWidth={active ? 2.2 : 1.8}
          className={active ? "text-[#3a65f0]" : "text-[#48485e]"}
        />
        {badge && badge > 0 ? (
          <span className="absolute -right-1.5 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-md bg-[#c43838] px-1 text-[9px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span
        className={`text-[10px] font-medium ${active ? "text-[#3a65f0]" : "text-[#48485e]"}`}
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [supabase]);

  function isActive(tab: Tab) {
    if (tab.exact) return pathname === tab.href;
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1e2230] bg-[#060709]/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex w-full items-stretch">
        {TABS.map((tab) => {
          const active = isActive(tab);
          const badge = tab.href === "/inbox" ? inboxUnread : undefined;
          return <TabItem key={tab.href} tab={tab} active={active} badge={badge} />;
        })}
      </div>
      <Link
        href="/voice"
        aria-label="Voice"
        className="absolute -top-6 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#3a65f0] shadow-[0_0_20px_rgba(58,101,240,0.5)] active:scale-95 transition-transform"
      >
        <Mic size={20} strokeWidth={2} className="text-white" />
      </Link>
    </nav>
  );
}
