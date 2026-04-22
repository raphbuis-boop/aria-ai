"use client";

import Link from "next/link";
import {
  Building2,
  CalendarClock,
  FileSignature,
  Gauge,
  LayoutGrid,
  LineChart,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type Entry = {
  href: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
};

const sections: { title: string; items: Entry[] }[] = [
  {
    title: "Properties",
    items: [
      {
        href: "/mls",
        label: "MLS Search",
        desc: "Live NJ MLS listings — search, match, share",
        Icon: Search,
      },
      {
        href: "/properties",
        label: "My Properties",
        desc: "Saved listings + auto client matches",
        Icon: Building2,
      },
    ],
  },
  {
    title: "Workflow",
    items: [
      {
        href: "/pipeline",
        label: "Pipeline",
        desc: "Kanban board — drag clients between stages",
        Icon: LayoutGrid,
      },
      {
        href: "/showings",
        label: "Showings",
        desc: "Upcoming + past property tours",
        Icon: CalendarClock,
      },
      {
        href: "/transactions",
        label: "Transactions",
        desc: "Deals under contract — milestones & dates",
        Icon: FileSignature,
      },
    ],
  },
  {
    title: "Intelligence",
    items: [
      {
        href: "/ai",
        label: "Ask Aria",
        desc: "Open the Aria AI chat",
        Icon: Sparkles,
      },
      {
        href: "/market-pulse",
        label: "Market Pulse",
        desc: "NJ medians, DOM and momentum by town",
        Icon: Gauge,
      },
      {
        href: "/referrals",
        label: "Referrals",
        desc: "Agent-to-agent referral marketplace",
        Icon: LineChart,
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        href: "/settings",
        label: "Settings",
        desc: "Voice samples, automation, account",
        Icon: Settings,
      },
    ],
  },
];

export default function MorePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0eee8] pb-28">
      <div className="px-5 pt-6">
        <h1 className="text-[26px] font-semibold leading-tight">More</h1>
        <p className="mt-1 text-[13px] text-[#666680]">
          Everything outside the main Home · Inbox · Clients flow.
        </p>
      </div>

      <div className="mt-6 space-y-6 px-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[1.4px] text-[#444460]">
              {section.title}
            </p>
            <div className="space-y-2">
              {section.items.map(({ href, label, desc, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-[14px] rounded-[18px] border-[0.5px] border-[#1c1c2e] bg-[#0f0f1e] px-4 py-[14px] transition active:border-[#4f7bff]"
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px] bg-[#4f7bff]/12 text-[#6f9bff]">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-[#d0d0e0]">
                      {label}
                    </div>
                    <div className="truncate text-[12px] text-[#555570]">
                      {desc}
                    </div>
                  </div>
                  <svg
                    className="ml-auto flex-shrink-0 text-[#333350]"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
