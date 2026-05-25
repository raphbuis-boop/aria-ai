"use client";

import Link from "next/link";
import {
  Gauge,
  LineChart,
  Mic,
  Settings,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

type Entry = {
  href: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
  external?: boolean;
};

const items: Entry[] = [
  {
    href: "/settings",
    label: "Settings",
    desc: "Account, automation, notifications",
    Icon: Settings,
  },
  {
    href: "/voice",
    label: "Voice & Mirror My Voice",
    desc: "Record samples, train your AI tone",
    Icon: Mic,
  },
  {
    href: "/referrals",
    label: "Referrals",
    desc: "Agent-to-agent referral marketplace",
    Icon: LineChart,
  },
  {
    href: "/market-pulse",
    label: "Market Pulse",
    desc: "NJ medians, DOM and momentum by town",
    Icon: Gauge,
  },
  {
    href: "/portal",
    label: "Client Portal",
    desc: "Share listings and updates with clients",
    Icon: ExternalLink,
  },
];

export default function MorePage() {
  return (
    <div className="min-h-screen pb-28" style={{ background: "#000000", color: "#ffffff" }}>
      <div className="px-5 pt-8">
        <h1 className="text-[28px] font-bold leading-tight">More</h1>
        <p className="mt-1 text-[14px]" style={{ color: "#6B7280" }}>
          Settings and tools
        </p>
      </div>

      <div className="mt-8 px-5 space-y-2">
        {items.map(({ href, label, desc, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-[12px] px-4 py-4 active:opacity-70"
            style={{ background: "#111111", border: "1px solid #222222" }}
          >
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: "rgba(255,255,255,0.07)", color: "#9CA3AF" }}
            >
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold" style={{ color: "#ffffff" }}>
                {label}
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>
                {desc}
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: "#374151", flexShrink: 0 }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
