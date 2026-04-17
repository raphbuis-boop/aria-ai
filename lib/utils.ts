import { format, formatDistanceToNow } from "date-fns";

export function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatPhoneE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }
  return null;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

/** e.g. $500k, $1.2M — avoids "$8000k" for large numbers */
export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    const rounded = Math.round(m * 10) / 10;
    const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `$${s}M`;
  }
  if (abs >= 1_000) {
    const k = n / 1000;
    const s = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, "");
    return `$${s}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "MMM d, yyyy h:mm a");
  } catch {
    return "—";
  }
}
