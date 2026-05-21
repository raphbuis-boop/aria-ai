"use client";

type Props = {
  activities: Record<string, unknown>[];
};

type PulseState = "active" | "cooling" | "atrisk" | "none";

function computePulse(activities: Record<string, unknown>[]): {
  state: PulseState;
  days: number;
} {
  if (!activities.length) return { state: "none", days: 0 };

  const latest = activities
    .map((a) => (a.created_at ? new Date(String(a.created_at)).getTime() : 0))
    .filter(Boolean)
    .sort((a, b) => b - a)[0];

  if (!latest) return { state: "none", days: 0 };

  const days = Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24));

  if (days <= 7) return { state: "active", days };
  if (days <= 21) return { state: "cooling", days };
  return { state: "atrisk", days };
}

const CONFIG = {
  active: {
    icon: "🟢",
    border: "border-green-500/30",
    bg: "bg-green-500/8",
    text: "text-green-400",
    label: (days: number) => `Active — last contact ${days} day${days === 1 ? "" : "s"} ago`,
  },
  cooling: {
    icon: "🟡",
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/8",
    text: "text-yellow-400",
    label: (days: number) =>
      `Cooling — last contact ${days} days ago. Recommend follow-up.`,
  },
  atrisk: {
    icon: "🔴",
    border: "border-red-500/30",
    bg: "bg-red-500/8",
    text: "text-red-400",
    label: (days: number) => `At risk — no contact in ${days} days`,
  },
  none: {
    icon: "⚪",
    border: "border-[#2a2e40]",
    bg: "bg-[#12121e]",
    text: "text-[#9498b0]",
    label: () => "No activity yet — log your first interaction",
  },
} as const;

export function EngagementPulse({ activities }: Props) {
  const { state, days } = computePulse(activities);
  const cfg = CONFIG[state];

  return (
    <div
      className={`mb-3 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 ${cfg.border} ${cfg.bg}`}
    >
      <span className="text-[13px] leading-none">{cfg.icon}</span>
      <p className={`text-[12.5px] font-medium ${cfg.text}`}>
        {cfg.label(days)}
      </p>
    </div>
  );
}
