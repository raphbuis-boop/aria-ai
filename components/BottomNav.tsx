"use client";

import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  CalendarClock,
  FileSignature,
  Gauge,
  Grid3x3,
  House,
  Inbox,
  LayoutGrid,
  LineChart,
  MessageSquare,
  Mic,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = {
  href: string;
  label: string;
  Icon: LucideIcon;
  badge?: boolean;
};

const moreLinks: { href: string; label: string; Icon: LucideIcon; desc: string }[] = [
  {
    href: "/pipeline",
    label: "Pipeline",
    Icon: LayoutGrid,
    desc: "Kanban board — drag clients between stages",
  },
  {
    href: "/listings",
    label: "Properties",
    Icon: Building2,
    desc: "Live NJ property search and matches",
  },
  {
    href: "/market-pulse",
    label: "Market Pulse",
    Icon: Gauge,
    desc: "Median price, DOM & momentum by town",
  },
  {
    href: "/showings",
    label: "Showings",
    Icon: CalendarClock,
    desc: "Upcoming and past property tours",
  },
  {
    href: "/transactions",
    label: "Transactions",
    Icon: FileSignature,
    desc: "Deals under contract — milestones & dates",
  },
  {
    href: "/ai",
    label: "Ask Aria",
    Icon: Sparkles,
    desc: "Open the Aria AI chat",
  },
  {
    href: "/inquiries",
    label: "Inquiries",
    Icon: Inbox,
    desc: "Property inquiry leads from public search",
  },
  {
    href: "/referrals",
    label: "Referrals",
    Icon: LineChart,
    desc: "Referrals in and out",
  },
  {
    href: "/settings",
    label: "Settings",
    Icon: Settings,
    desc: "Voice samples, automation, account",
  },
];


function PillItem({
  href,
  label,
  Icon,
  active,
  unread,
  onClick,
}: Item & { active: boolean; unread?: number; onClick?: () => void }) {
  const content = (
    <>
      <span className="relative flex items-center justify-center">
        <Icon
          size={active ? 18 : 20}
          strokeWidth={2}
          className="transition-all"
        />
        {unread && unread > 0 ? (
          <span className="absolute -right-1.5 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-md bg-[#ff4d4d] px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </span>
      {active ? (
        <span className="text-[12px] font-semibold whitespace-nowrap">
          {label}
        </span>
      ) : null}
    </>
  );

  const classes = active
    ? "flex items-center justify-center gap-[7px] h-10 rounded-[20px] bg-[#1e1e38] text-white pl-3 pr-4 flex-shrink-0 transition-all"
    : "flex items-center justify-center h-10 w-11 rounded-[20px] text-[#3a3a52] flex-shrink-0 transition-all";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} aria-label={label}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={classes} aria-label={label}>
      {content}
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

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // Exclude /listings from moreActive since it has its own pill
  const moreActive =
    isActive("/more") ||
    moreLinks.some((m) => m.href !== "/listings" && isActive(m.href));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center bg-[#06060c]/95 px-5 pt-2 backdrop-blur-xl" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex w-full max-w-[420px] items-center justify-around gap-1 rounded-[26px] border-[0.5px] border-[#1a1a2e] bg-[#0f0f1c] p-1">
          <PillItem
            href="/dashboard"
            label="Home"
            Icon={House}
            active={isActive("/dashboard")}
          />
          <PillItem
            href="/inbox"
            label="Inbox"
            Icon={MessageSquare}
            active={isActive("/inbox")}
            unread={inboxUnread}
            badge
          />

          <div className="flex flex-shrink-0 items-center justify-center px-1">
            <Link
              href="/voice"
              aria-label="Voice assistant"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#4f7bff] text-white shadow-[0_0_20px_rgba(79,123,255,0.45),0_0_40px_rgba(79,123,255,0.15)] transition-transform active:scale-95"
            >
              <Mic size={18} strokeWidth={2} />
            </Link>
          </div>

          <PillItem
            href="/clients"
            label="Clients"
            Icon={Users}
            active={isActive("/clients")}
          />
          <PillItem
            href="/listings"
            label="Search"
            Icon={Building2}
            active={isActive("/listings") || isActive("/mls") || isActive("/properties")}
          />
          <PillItem
            href="/more"
            label="More"
            Icon={Grid3x3}
            active={moreActive}
          />
        </div>
      </nav>

    </>
  );
}


