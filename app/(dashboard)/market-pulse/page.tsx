"use client";

import { fmtMoney } from "@/lib/utils";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type TownPulse = {
  town: string;
  activeCount: number;
  medianPrice: number | null;
  avgDaysOnMarket: number | null;
  momentumPct: number | null;
};

export default function MarketPulsePage() {
  const [towns, setTowns] = useState<TownPulse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/market-pulse");
      const data = (await res.json()) as {
        towns?: TownPulse[];
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? "Could not load");
        setTowns([]);
        return;
      }
      setTowns(data.towns ?? []);
    } catch {
      setErr("Network error");
      setTowns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-28">
      <div className="px-5 pt-6 pb-4 flex items-start justify-between gap-2">
        <div>
          <div className="text-[26px] font-semibold mb-1">Market Pulse</div>
          <div className="text-xs text-[#444460]">
            Active NJ listings (SimplyRETS)
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1e1e2e] text-[#666680] hover:text-[#4f7bff] disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {err ? (
        <div className="mx-5 bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4 text-sm text-[#666680]">
          {err}
        </div>
      ) : null}

      {loading && !towns.length ? (
        <div className="px-5 text-sm text-[#444460]">Loading…</div>
      ) : null}

      <div className="px-5 space-y-2 mt-2">
        {towns.map((t) => {
          const pct = t.momentumPct;
          const momentumClass =
            pct != null && pct >= 0
              ? "text-xs text-green-400 flex items-center gap-1"
              : "text-xs text-red-400 flex items-center gap-1";
          return (
            <div
              key={t.town}
              className="flex items-center justify-between py-3 border-b border-[#141420]"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#d0d0e0]">
                  {t.town}
                </div>
                <div className="text-[11px] text-[#555570] mt-0.5">
                  {t.activeCount} active
                  {t.avgDaysOnMarket != null
                    ? ` · ${Math.round(t.avgDaysOnMarket)}d avg`
                    : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-[#4f7bff]">
                  {t.medianPrice != null ? fmtMoney(t.medianPrice) : "—"}
                </div>
                {pct != null ? (
                  <div className={`${momentumClass} justify-end`}>
                    {pct >= 0 ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )}
                    {pct > 0 ? "+" : ""}
                    {pct}%
                  </div>
                ) : (
                  <div className="text-xs text-[#555570]">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
