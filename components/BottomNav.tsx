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

const primary: Item[] = [
  { href: "/dashboard", label: "Home", Icon: House },
  { href: "/inbox", label: "Inbox", Icon: MessageSquare, badge: true },
];

const tail: Item[] = [
  { href: "/clients", label: "Clients", Icon: Users },
];

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
    Icon: LineChart,
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

export function BottomNav() {
  const pathname = usePathname();
  const supabase = createClient();
  const [unread, setUnread] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
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
    setMoreOpen(false);
    setQuickOpen(false);
  }, [pathname]);

  const moreActive = moreLinks.some(
    (m) => pathname === m.href || pathname.startsWith(m.href + "/"),
  );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1e1e2e] bg-[#0a0a0f]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-lg items-end justify-between px-2 pb-2 pt-1">
          {primary.map(({ href, label, Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex w-[60px] flex-col items-center gap-[5px] pb-1"
              >
                <span className="relative">
                  <Icon
                    className={active ? "text-[#4f7bff]" : "text-[#555566]"}
                    size={22}
                    strokeWidth={2}
                  />
                  {badge && unread > 0 ? (
                    <span className="absolute -right-1.5 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`text-[10px] font-medium ${
                    active ? "text-[#4f7bff]" : "text-[#555566]"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          <div className="relative flex w-[72px] flex-col items-center">
            <button
              type="button"
              onClick={() => {
                setQuickOpen((v) => !v);
                setMoreOpen(false);
              }}
              aria-label="Quick actions"
              aria-expanded={quickOpen}
              className="-mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-gradient-to-br from-[#4f7bff] to-[#7c5cfc] text-white transition-transform active:scale-95"
            >
              <Plus
                size={28}
                strokeWidth={2.5}
                className={`transition-transform duration-150 ${
                  quickOpen ? "rotate-45" : ""
                }`}
              />
            </button>
          </div>

          {tail.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex w-[60px] flex-col items-center gap-[5px] pb-1"
              >
                <Icon
                  className={active ? "text-[#4f7bff]" : "text-[#555566]"}
                  size={22}
                  strokeWidth={2}
                />
                <span
                  className={`text-[10px] font-medium ${
                    active ? "text-[#4f7bff]" : "text-[#555566]"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setMoreOpen((v) => !v);
              setQuickOpen(false);
            }}
            aria-label="More"
            aria-expanded={moreOpen}
            className="flex w-[60px] flex-col items-center gap-[5px] pb-1"
          >
            <Grid3x3
              className={
                moreActive || moreOpen ? "text-[#4f7bff]" : "text-[#555566]"
              }
              size={22}
              strokeWidth={2}
            />
            <span
              className={`text-[10px] font-medium ${
                moreActive || moreOpen ? "text-[#4f7bff]" : "text-[#555566]"
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {quickOpen ? (
        <QuickActionsSheet onClose={() => setQuickOpen(false)} />
      ) : null}
      {moreOpen ? <MoreSheet onClose={() => setMoreOpen(false)} /> : null}
    </>
  );
}

function QuickActionsSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70">
      <button
        type="button"
        aria-label="Close quick actions"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="menu"
        className="relative z-10 mb-16 w-full max-w-lg rounded-t-[24px] border border-[#1e1e2e] border-b-0 bg-[#0f0f1a] px-5 pb-6 pt-4"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#2a2a3e]" />
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#555566]">
          Quick actions
        </div>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map(({ href, label, Icon, hint }) => (
            <Link
              key={label}
              href={href}
              onClick={onClose}
              className="flex flex-col items-center gap-2 rounded-[16px] border border-[#1e1e2e] bg-[#12121e] px-3 py-4 text-center active:border-[#4f7bff]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4f7bff]/15 text-[#6f9bff]">
                <Icon size={20} />
              </span>
              <span className="text-[12px] font-medium text-white">
                {label}
              </span>
              <span className="text-[10px] leading-tight text-[#666680]">
                {hint}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="menu"
        className="relative z-10 mb-16 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border border-[#1e1e2e] border-b-0 bg-[#0f0f1a] px-5 pb-8 pt-4"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#2a2a3e]" />
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#555566]">
          More
        </div>
        <div className="space-y-1.5">
          {moreLinks.map(({ href, label, Icon, desc }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-[14px] border border-[#1e1e2e] bg-[#12121e] px-4 py-3.5 transition hover:border-[#4f7bff] active:border-[#4f7bff]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4f7bff]/15 text-[#6f9bff]">
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-white">
                  {label}
                </div>
                <div className="truncate text-[11px] text-[#666680]">{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
