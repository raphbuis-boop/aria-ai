"use client";

import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  CalendarClock,
  FileSignature,
  Gauge,
  Grid3x3,
  House,
  LayoutGrid,
  LineChart,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserPlus,
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
    href: "/mls",
    label: "Properties",
    Icon: Building2,
    desc: "Live NJ MLS search and matches",
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

const quickActions: { href: string; label: string; Icon: LucideIcon; hint: string }[] = [
  {
    href: "/clients?new=1",
    label: "Add Client",
    Icon: UserPlus,
    hint: "Capture a new lead",
  },
  {
    href: "/mls",
    label: "Search MLS",
    Icon: Search,
    hint: "Live NJ listings",
  },
  {
    href: "/showings?new=1",
    label: "New Showing",
    Icon: CalendarClock,
    hint: "Log a property tour",
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
  const [unread, setUnread] = useState(0);
  const [quickOpen, setQuickOpen] = useState(false);

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
      if (!cancelled) setUnread(count ?? 0);
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [supabase]);

  useEffect(() => {
    setQuickOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const moreActive =
    isActive("/more") || moreLinks.some((m) => isActive(m.href));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center bg-[#06060c]/95 px-3 pt-2 pb-6 backdrop-blur-xl">
        <div className="flex w-full max-w-lg items-center gap-0.5 rounded-[26px] border-[0.5px] border-[#1a1a2e] bg-[#0f0f1c] p-1">
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
            unread={unread}
            badge
          />

          <div className="flex flex-shrink-0 items-center justify-center px-1">
            <button
              type="button"
              onClick={() => setQuickOpen((v) => !v)}
              aria-label="Quick actions"
              aria-expanded={quickOpen}
              className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#4f7bff] to-[#7c5cfc] text-white shadow-[0_0_16px_rgba(79,123,255,0.5),0_3px_8px_rgba(0,0,0,0.4)] transition-transform active:scale-95"
            >
              <Plus
                size={18}
                strokeWidth={2.5}
                className={`transition-transform duration-150 ${
                  quickOpen ? "rotate-45" : ""
                }`}
              />
            </button>
          </div>

          <PillItem
            href="/clients"
            label="Clients"
            Icon={Users}
            active={isActive("/clients")}
          />
          <PillItem
            href="/more"
            label="More"
            Icon={Grid3x3}
            active={moreActive}
          />
        </div>
      </nav>

      {quickOpen ? (
        <QuickActionsSheet onClose={() => setQuickOpen(false)} />
      ) : null}
    </>
  );
}

function QuickActionsSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close quick actions"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="menu"
        className="relative z-10 mb-24 w-full max-w-lg rounded-t-[24px] border-[0.5px] border-b-0 border-[#1e1e2e] bg-[#0f0f1a] px-5 pb-8 pt-4"
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#2a2a3e]" />
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460]">
          Quick actions
        </div>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map(({ href, label, Icon, hint }) => (
            <Link
              key={label}
              href={href}
              onClick={onClose}
              className="flex flex-col items-center gap-2 rounded-[18px] border-[0.5px] border-[#1c1c2e] bg-[#0f0f1e] px-3 py-4 text-center transition active:border-[#4f7bff]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#4f7bff]/12 text-[#6f9bff]">
                <Icon size={18} />
              </span>
              <span className="text-[12px] font-semibold text-[#d0d0e0]">
                {label}
              </span>
              <span className="text-[10px] leading-tight text-[#555570]">
                {hint}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

