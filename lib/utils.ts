import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"
import { formatDistanceToNow } from "date-fns"

// The ivory type scale (tailwind.config.ts fontSize) must be registered, or
// twMerge reads `text-caption` as a text color and drops `text-primary-foreground`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["caption", "body", "body-lg", "title", "section", "display"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "+12015550142" → "(201) 555-0142"; anything else is returned as-is. */
export function fmtPhone(raw: string | null | undefined): string {
  if (!raw) return ""
  const d = raw.replace(/\D/g, "")
  const ten = d.length === 11 && d[0] === "1" ? d.slice(1) : d
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : raw
}

/** Normalizes a US phone number to E.164 (+1XXXXXXXXXX). Returns null if unparseable. */
export function formatPhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return raw;
  return null;
}

/** "Marcus Holloway" → "MH". Falls back to "?" for empty/missing names. */
export function initials(name: string | null | undefined): string {
  return (
    (name ?? "")
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/** "6 days ago" / "in 2 days" — relative time from an ISO timestamp. */
export function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

/** Compact currency: 1_400_000 → "$1.4M", 825_000 → "$825k", 500 → "$500". */
export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

/** Short date only: "Jun 20". */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

const SOURCE_LABELS: Record<string, string> = {
  zillow: "Zillow",
  google: "Google",
  referral: "Referral",
  manual: "Manually added",
  website: "Website",
  facebook: "Facebook",
  instagram: "Instagram",
  open_house: "Open house",
  sign_call: "Sign call",
  past_client: "Past client",
  sphere: "Sphere of influence",
  realtor: "Realtor.com",
  meta: "Meta ad",
  sms: "Texted in",
};

/** Raw DB lead-source enum → display label: "google" → "Google". */
export function humanizeSource(source: string | null | undefined): string | null {
  if (!source) return null;
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Date + time: "Jun 20, 2:45 PM". */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
