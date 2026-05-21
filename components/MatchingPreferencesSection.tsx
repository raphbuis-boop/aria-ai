"use client";

import { useToast } from "@/components/ToastProvider";
import { NJ_TOWN_OPTIONS } from "@/lib/nj-towns";
import { createClient } from "@/lib/supabase/client";
import { SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Prefs = {
  preferred_towns: string[];
  nearby_towns_ok: boolean;
  budget_flex_pct: number;
  bed_flex: number;
  bath_flex: number;
};

const DEFAULTS: Prefs = {
  preferred_towns: [],
  nearby_towns_ok: false,
  budget_flex_pct: 10,
  bed_flex: 1,
  bath_flex: 0.5,
};

function parseList(raw: unknown, fallbackTown?: string | null): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (fallbackTown) return [fallbackTown];
  return [];
}

export function MatchingPreferencesSection({
  clientId,
  initial,
  primaryTown,
}: {
  clientId: string;
  initial: Record<string, unknown>;
  primaryTown: string | null;
}) {
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>({
    preferred_towns: parseList(initial.preferred_towns, primaryTown),
    nearby_towns_ok: Boolean(initial.nearby_towns_ok ?? false),
    budget_flex_pct: Number(initial.budget_flex_pct ?? DEFAULTS.budget_flex_pct),
    bed_flex: Number(initial.bed_flex ?? DEFAULTS.bed_flex),
    bath_flex: Number(initial.bath_flex ?? DEFAULTS.bath_flex),
  });
  const [townInput, setTownInput] = useState("");
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => {
    const q = townInput.trim().toLowerCase();
    if (!q) return [];
    return NJ_TOWN_OPTIONS.filter(
      (t) =>
        t.toLowerCase().includes(q) &&
        !prefs.preferred_towns
          .map((x) => x.toLowerCase())
          .includes(t.toLowerCase()),
    ).slice(0, 6);
  }, [townInput, prefs.preferred_towns]);

  function addTown(value: string) {
    const v = value.trim();
    if (!v) return;
    if (
      prefs.preferred_towns.some((t) => t.toLowerCase() === v.toLowerCase())
    ) {
      setTownInput("");
      return;
    }
    setPrefs((p) => ({ ...p, preferred_towns: [...p.preferred_towns, v] }));
    setTownInput("");
  }

  function removeTown(town: string) {
    setPrefs((p) => ({
      ...p,
      preferred_towns: p.preferred_towns.filter((t) => t !== town),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          preferred_towns: prefs.preferred_towns,
          nearby_towns_ok: prefs.nearby_towns_ok,
          budget_flex_pct: prefs.budget_flex_pct,
          bed_flex: prefs.bed_flex,
          bath_flex: prefs.bath_flex,
        })
        .eq("id", clientId);
      if (error) {
        toast.toast(error.message, "warn");
      } else {
        toast.toast("Matching preferences saved", "success");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-[#1e2230] bg-[#12121e] p-4">
        <div className="mb-3 flex items-center gap-2 text-[12px] text-[#9090a8]">
          <SlidersHorizontal size={13} />
          Properties are matched against these criteria. Looser = more results.
        </div>

        {/* Preferred towns */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#6b7090]">
            Preferred towns
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {prefs.preferred_towns.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-[#3a65f0]/12 px-2.5 py-1 text-[11px] font-medium text-[#9fb8ff]"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTown(t)}
                  className="text-[#6b8fff]"
                  aria-label={`Remove ${t}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {prefs.preferred_towns.length === 0 ? (
              <span className="text-[11px] text-[#9498b0]">
                None set — matching will fall back to {primaryTown ?? "any town"}.
              </span>
            ) : null}
          </div>
          <div className="relative mt-2">
            <input
              value={townInput}
              onChange={(e) => setTownInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTown(townInput);
                }
              }}
              placeholder="Add a town and hit Enter"
              className="w-full rounded-[10px] border border-[#1e2230] bg-[#0a0a15] px-3 py-2 text-[13px] text-[#e8eaf2] outline-none placeholder:text-[#6b7090]"
            />
            {suggestions.length > 0 ? (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[10px] border border-[#1e2230] bg-[#0a0a15] shadow-lg">
                {suggestions.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => addTown(s)}
                    className="block w-full px-3 py-1.5 text-left text-[12px] text-[#e8eaf2] hover:bg-[#3a65f0]/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Nearby towns toggle */}
        <label className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-[#1e2230] bg-[#0a0a15] px-3 py-2.5">
          <div>
            <p className="text-[13px] font-medium text-[#e8eaf2]">
              Include nearby towns
            </p>
            <p className="text-[11px] text-[#9498b0]">
              Match adjacent towns (e.g. Glen Rock, Ho-Ho-Kus for Ridgewood).
            </p>
          </div>
          <input
            type="checkbox"
            checked={prefs.nearby_towns_ok}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, nearby_towns_ok: e.target.checked }))
            }
            className="h-4 w-4 accent-[#3a65f0]"
          />
        </label>

        {/* Budget flex slider */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-bold uppercase tracking-[1.2px] text-[#6b7090]">
              Budget flexibility
            </span>
            <span className="font-medium text-[#e8eaf2]">
              ±{prefs.budget_flex_pct}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={25}
            step={1}
            value={prefs.budget_flex_pct}
            onChange={(e) =>
              setPrefs((p) => ({
                ...p,
                budget_flex_pct: Number(e.target.value),
              }))
            }
            className="w-full accent-[#3a65f0]"
          />
          <p className="text-[11px] text-[#9498b0]">
            Listings up to {prefs.budget_flex_pct}% over or under budget will
            still surface.
          </p>
        </div>

        {/* Bed flex */}
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#6b7090]">
            Beds flexibility
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {[
              { v: 0, label: "Exact" },
              { v: 1, label: "±1" },
              { v: 2, label: "±2" },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, bed_flex: opt.v }))}
                className={`rounded-[10px] border px-3 py-2 text-[12px] font-medium ${
                  prefs.bed_flex === opt.v
                    ? "border-[#3a65f0] bg-[#3a65f0]/10 text-[#6b8fff]"
                    : "border-[#1e2230] text-[#9090a8]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bath flex */}
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#6b7090]">
            Baths flexibility
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {[
              { v: 0, label: "Exact" },
              { v: 0.5, label: "±0.5" },
              { v: 1, label: "±1" },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, bath_flex: opt.v }))}
                className={`rounded-[10px] border px-3 py-2 text-[12px] font-medium ${
                  prefs.bath_flex === opt.v
                    ? "border-[#3a65f0] bg-[#3a65f0]/10 text-[#6b8fff]"
                    : "border-[#1e2230] text-[#9090a8]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 w-full rounded-[12px] bg-gradient-to-br from-[#3a65f0] to-[#7c5cfc] py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}
