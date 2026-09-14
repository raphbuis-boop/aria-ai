"use client";

import { useEffect, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { ArrowDown, ArrowUp, WifiOff } from "lucide-react";

type TownPulse = {
  town: string;
  activeCount: number;
  medianPrice: number | null;
  avgDaysOnMarket: number | null;
  momentumPct: number | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "ready"; towns: TownPulse[] };

function fmtMoney(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export default function MarketPulsePage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/market-pulse", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 503) {
          setState({ status: "unconfigured" });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setState({ status: "ready", towns: (json.towns ?? []) as TownPulse[] });
      } catch {
        if (!cancelled) setState({ status: "unconfigured" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-[100dvh] pb-28" style={{ color: "var(--oc-text-1)" }}>
      <div className="px-5 pt-6">
        <BackButton className="mb-4" />
        <h1 className="mt-1 text-[26px] font-semibold leading-tight">
          Market Pulse
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "#636366" }}>
          New Jersey snapshot · live MLS data
        </p>
      </div>

      {state.status === "loading" && (
        <div className="mt-10 px-5 text-center text-[13px]" style={{ color: "#636366" }}>
          Loading market data…
        </div>
      )}

      {state.status === "unconfigured" && (
        <div className="mt-10 px-5">
          <div className="rounded-[18px] border border-border bg-card p-6 text-center">
            <WifiOff size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-display text-[15px] font-semibold text-foreground">
              Market data isn&apos;t connected yet
            </p>
            <p className="mt-1.5 font-display text-[13px] leading-[1.55] text-muted-foreground">
              Once your MLS feed is connected, this screen will show live
              prices and days-on-market for your towns.
            </p>
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <div className="mt-6 px-5">
            <p className="mb-2.5 text-[12px]" style={{ color: "#636366" }}>
              By town · active listings
            </p>
            <div className="overflow-hidden rounded-[18px]" style={{ background: "#1c1c1e" }}>
              {state.towns.map((t, i) => (
                <div
                  key={t.town}
                  className="flex items-center justify-between px-4 py-[14px]"
                  style={i > 0 ? { borderTop: "0.5px solid rgba(255,255,255,0.06)" } : {}}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold" style={{ color: "#f0f0f5" }}>
                      {t.town}
                    </div>
                    <div className="text-[11px]" style={{ color: "#636366" }}>
                      {t.avgDaysOnMarket != null
                        ? `${Math.round(t.avgDaysOnMarket)} days avg on market`
                        : "—"}
                      {" · "}
                      {t.activeCount} active
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[14px] font-semibold" style={{ color: "#f0f0f5" }}>
                        {fmtMoney(t.medianPrice)}
                      </div>
                      {t.momentumPct != null && (
                        <div
                          className={`flex items-center justify-end gap-0.5 text-[11px] font-medium ${
                            t.momentumPct >= 0 ? "text-[#1a9b5e]" : "text-[#c43838]"
                          }`}
                        >
                          {t.momentumPct >= 0 ? (
                            <ArrowUp size={11} />
                          ) : (
                            <ArrowDown size={11} />
                          )}
                          {t.momentumPct >= 0 ? "+" : ""}
                          {t.momentumPct}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-5 px-5 text-[11px]" style={{ color: "#636366" }}>
            Live data from your MLS feed. Momentum compares median prices of
            newer vs. older active listings.
          </p>
        </>
      )}
    </div>
  );
}
