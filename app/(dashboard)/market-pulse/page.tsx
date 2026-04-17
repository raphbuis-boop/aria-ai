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
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[20px] font-medium text-text-primary">
            Market Pulse
          </div>
          <div className="text-[13px] text-text-dim">
            Active NJ listings (SimplyRETS)
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border-card text-text-dim hover:text-accent-blue disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw
            size={18}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </header>

      {err ? (
        <div className="mt-4 rounded-[14px] border border-border-card bg-bg-card p-4 text-[13px] text-text-muted">
          {err}
        </div>
      ) : null}

      {loading && !towns.length ? (
        <div className="mt-6 text-[13px] text-text-dim">Loading…</div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {towns.map((t) => (
          <div
            key={t.town}
            className="rounded-[14px] border border-border-card bg-bg-card p-4"
          >
            <div className="text-[15px] font-semibold text-text-primary">
              {t.town}
            </div>
            <div className="mt-3 space-y-2 text-[13px] text-text-secondary">
              <div className="flex justify-between gap-2">
                <span className="text-text-dim">Active listings</span>
                <span className="font-medium text-text-primary">
                  {t.activeCount}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-text-dim">Median price</span>
                <span className="font-medium text-accent-blue">
                  {t.medianPrice != null ? fmtMoney(t.medianPrice) : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-text-dim">Avg. days on market</span>
                <span className="font-medium">
                  {t.avgDaysOnMarket != null
                    ? Math.round(t.avgDaysOnMarket)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border-card pt-2 text-[11px] text-text-dim">
                <span>Momentum (fresh vs aged)</span>
                <span className="flex items-center gap-1 font-medium text-text-primary">
                  {t.momentumPct != null ? (
                    <>
                      {t.momentumPct >= 0 ? (
                        <ArrowUp className="text-accent-green" size={14} />
                      ) : (
                        <ArrowDown className="text-accent-amber" size={14} />
                      )}
                      {t.momentumPct > 0 ? "+" : ""}
                      {t.momentumPct}%
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
