"use client";

import { BackButton } from "@/components/BackButton";
import { ArrowDown, ArrowUp } from "lucide-react";

type TownRow = {
  town: string;
  median: number;
  changePct: number;
  dom: number;
};

// Hardcoded realistic NJ market data for April 2026 — investor demo.
const overall = {
  median: 612_000,
  changePct: 4.2,
  avgDom: 18,
  listToSale: 103,
  monthLabel: "April 2026",
};

const towns: TownRow[] = [
  { town: "Ridgewood", median: 842_000, changePct: 6.1, dom: 14 },
  { town: "Westfield", median: 895_000, changePct: 3.8, dom: 16 },
  { town: "Montclair", median: 634_000, changePct: 1.2, dom: 22 },
  { town: "Hoboken", median: 715_000, changePct: 5.0, dom: 12 },
  { town: "Summit", median: 1_100_000, changePct: 8.3, dom: 11 },
];

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export default function MarketPulsePage() {
  return (
    <div className="min-h-[100dvh] pb-28" style={{ color: "var(--oc-text-1)" }}>
      <div className="px-5 pt-6">
        <BackButton className="mb-4" />
        <p className="text-[12px]" style={{ color: "#636366" }}>
          {overall.monthLabel}
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight">
          Market Pulse
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "#636366" }}>
          New Jersey snapshot · updated weekly
        </p>
      </div>

      {/* Headline stats */}
      <div className="mt-5 px-5 grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Stat label="Median" value={fmtMoney(overall.median)} tone="plain" />
        </div>
        <Stat label="Avg DOM" value={`${overall.avgDom}d`} tone="plain" />
        <Stat label="List / Sale" value={`${overall.listToSale}%`} tone="green" />
      </div>

      <div className="mt-5 px-5">
        <div className="rounded-[18px] p-4" style={{ background: "#1c1c1e" }}>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#636366" }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "#0a7cff" }} />
            Momentum read
          </div>
          <p className="mt-2 text-[13px] leading-[1.55]" style={{ color: "#aeaeb2" }}>
            Median up <span className="font-medium text-[#1a9b5e]">+{overall.changePct}%</span> YoY.
            Inventory tight across Summit, Ridgewood, and Hoboken — expect bidding wars under DOM 15.
          </p>
        </div>
      </div>

      <div className="mt-6 px-5">
        <p className="mb-2.5 text-[12px]" style={{ color: "#636366" }}>
          By town
        </p>
        <div className="overflow-hidden rounded-[18px]" style={{ background: "#1c1c1e" }}>
          {towns.map((t, i) => (
            <div
              key={t.town}
              className="flex items-center justify-between px-4 py-[14px]"
              style={i > 0 ? { borderTop: "0.5px solid rgba(255,255,255,0.06)" } : {}}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold" style={{ color: "#f0f0f5" }}>
                  {t.town}
                </div>
                <div className="text-[11px]" style={{ color: "#636366" }}>{t.dom} days avg on market</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[14px] font-semibold" style={{ color: "#f0f0f5" }}>
                    {fmtMoney(t.median)}
                  </div>
                  <div
                    className={`flex items-center justify-end gap-0.5 text-[11px] font-medium ${
                      t.changePct >= 0 ? "text-[#1a9b5e]" : "text-[#c43838]"
                    }`}
                  >
                    {t.changePct >= 0 ? (
                      <ArrowUp size={11} />
                    ) : (
                      <ArrowDown size={11} />
                    )}
                    {t.changePct >= 0 ? "+" : ""}
                    {t.changePct}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 px-5 text-[11px]" style={{ color: "#636366" }}>
        Market estimates compiled for {overall.monthLabel} · NJ Bergen, Essex &amp; Union counties. Not sourced from live MLS data. For actual listing data, see the MLS search.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "plain";
}) {
  const valueColor = tone === "green" ? "#1a9b5e" : "#f0f0f5";
  return (
    <div className="rounded-[18px] p-3.5" style={{ background: "#1c1c1e" }}>
      <p className="mb-1 text-[11px] font-medium" style={{ color: "#636366" }}>
        {label}
      </p>
      <p className="text-[18px] font-semibold leading-none" style={{ color: valueColor }}>
        {value}
      </p>
    </div>
  );
}
