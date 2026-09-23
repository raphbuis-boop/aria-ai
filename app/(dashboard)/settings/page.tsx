"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Copy,
  Download,
  FileSignature,
  Inbox,
  KeyRound,
  LogOut,
  Mail,
  MessageSquare,
  Mic,
  PenLine as Pen,
  Monitor,
  Moon,
  Search,
  Sun,
  Trash2,
  Upload,
  Webhook,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BbaTemplatesSection } from "@/components/BbaTemplatesSection";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "@/components/ui/sonner";
import { applyThemePref, readThemePref, type ThemePref } from "@/lib/theme";
import { cn, fmtPhone } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

type Health = {
  aiConfigured: boolean;
  emailConfigured: boolean;
  mlsConfigured: boolean;
  googleConfigured: boolean;
  calendarWriteEnabled: boolean;
  sms: { configured: boolean; fromNumber: string | null; messagingService: boolean; dryRun: boolean };
  leads: { webhookConfigured: boolean; defaultAgent: boolean; metaConfigured: boolean };
};
type Google = { connected: boolean; email?: string; calendarRead?: boolean; calendarWrite?: boolean };
type DraftTone = "warm" | "professional" | "direct" | "casual";

const TONES: { value: DraftTone; label: string }[] = [
  { value: "warm", label: "Warm & friendly" },
  { value: "professional", label: "Professional" },
  { value: "direct", label: "Direct" },
  { value: "casual", label: "Casual" },
];

// ── Primitives ────────────────────────────────────────────────────────────

function Group({ title, footer, children }: { title: string; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 px-4 font-display text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">{children}</div>
      {footer ? <div className="mt-2 px-4 font-display text-caption text-muted-foreground">{footer}</div> : null}
    </section>
  );
}

type Tone = "ok" | "warn" | "off";
function Status({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-display text-caption font-medium",
        tone === "ok" ? "text-primary" : tone === "warn" ? "text-warm" : "text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone === "ok" ? "bg-primary" : tone === "warn" ? "bg-warm" : "bg-muted-foreground/50")} />
      {children}
    </span>
  );
}

function RowIcon({ Icon, danger }: { Icon: React.ElementType; danger?: boolean }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", danger ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground")}>
      <Icon className="size-4" />
    </span>
  );
}

function Row({
  Icon,
  label,
  detail,
  right,
  href,
  onPress,
  danger,
}: {
  Icon: React.ElementType;
  label: string;
  detail?: React.ReactNode;
  right?: React.ReactNode;
  href?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const body = (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
      <RowIcon Icon={Icon} danger={danger} />
      <div className="min-w-0 flex-1">
        <p className={cn("font-display text-body-lg", danger ? "font-medium text-destructive" : "text-foreground")}>{label}</p>
        {detail ? <div className="mt-0.5 font-display text-caption text-muted-foreground">{detail}</div> : null}
      </div>
      {right}
      {href || onPress ? <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" /> : null}
    </div>
  );
  if (href) return <Link href={href} className="block hover:bg-secondary/40">{body}</Link>;
  if (onPress)
    return (
      <button type="button" onClick={onPress} className="block w-full text-left hover:bg-secondary/40">
        {body}
      </button>
    );
  return body;
}

function EditRow({
  Icon,
  label,
  value,
  placeholder,
  inputMode,
  onSave,
}: {
  Icon: React.ElementType;
  label: string;
  value: string;
  placeholder: string;
  inputMode?: "text" | "tel";
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex min-h-[56px] items-center gap-3 px-4 py-3">
      <RowIcon Icon={Icon} />
      <span className="shrink-0 font-display text-body-lg text-foreground">{label}</span>
      <input
        value={draft}
        placeholder={placeholder}
        inputMode={inputMode}
        type={inputMode === "tel" ? "tel" : "text"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() !== value.trim() && onSave(draft.trim())}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="min-w-0 flex-1 bg-transparent text-right font-display text-body text-muted-foreground outline-none placeholder:text-muted-foreground/50 focus:text-foreground"
      />
    </label>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-input")}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

function CopyValue({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard?.writeText(value).then(
          () => toast.success("Copied"),
          () => toast.error("Couldn't copy"),
        )
      }
      className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 font-mono text-[11px] text-foreground"
    >
      <span className="truncate">{value}</span>
      <Copy className="size-3 shrink-0" />
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [profile, setProfile] = useState({ fullName: "", email: "", phone: "", brokerageName: "" });
  const [health, setHealth] = useState<Health | null>(null);
  const [google, setGoogle] = useState<Google | null>(null);
  const [notify, setNotify] = useState({ notifyFollowups: true });
  const [drafts, setDrafts] = useState<{ draftTone: DraftTone; signature: string }>({ draftTone: "warm", signature: "" });
  const [theme, setTheme] = useState<ThemePref>("system");
  const [exporting, setExporting] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setTheme(readThemePref());
    const get = <T,>(url: string, set: (d: T) => void) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && set(d as T))
        .catch(() => {});
    void get<typeof profile>("/api/settings/profile", (d) =>
      setProfile({ fullName: d.fullName ?? "", email: d.email ?? "", phone: d.phone ?? "", brokerageName: d.brokerageName ?? "" }),
    );
    void get<Health>("/api/health/env", setHealth);
    void get<Google>("/api/gmail/status", setGoogle);
    void get<typeof notify>("/api/settings/notifications", setNotify);
    void get<typeof drafts>("/api/settings/drafts", (d) => setDrafts({ draftTone: d.draftTone ?? "warm", signature: d.signature ?? "" }));

    const params = new URLSearchParams(window.location.search);
    const g = params.get("gmail");
    if (g === "connected") toast.success("Google account connected");
    if (g === "error") toast.error("Google connection failed — try again");
    if (g) window.history.replaceState({}, "", "/settings");
  }, []);

  async function patch(url: string, body: Record<string, unknown>, ok = "Saved") {
    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't save — try again");
      return false;
    }
    toast.success(ok);
    return true;
  }

  async function saveProfile(field: "fullName" | "phone" | "brokerageName", value: string) {
    if (field !== "phone" && !value) return;
    if (await patch("/api/settings/profile", { [field]: value })) setProfile((p) => ({ ...p, [field]: value }));
  }

  async function disconnectGoogle() {
    const res = await fetch("/api/gmail/disconnect", { method: "POST" });
    if (res.ok) {
      setGoogle({ connected: false });
      toast.success("Google disconnected");
    } else toast.error("Couldn't disconnect");
  }

  async function exportClients() {
    setExporting(true);
    try {
      const res = await fetch("/api/clients/export");
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `aria-clients-${new Date().toISOString().slice(0, 10)}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't export — try again");
    } finally {
      setExporting(false);
    }
  }

  async function changePassword() {
    if (password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    const { error } = await createClient().auth.updateUser({ password });
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      setPassword("");
      setPwOpen(false);
    }
  }

  async function signOut(scope: "local" | "global") {
    await createClient().auth.signOut({ scope });
    router.push("/login");
    router.refresh();
  }

  async function deleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: deleteText }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDeleting(false);
      toast.error(data.error ?? "Couldn't delete account");
      return;
    }
    await createClient().auth.signOut().catch(() => {});
    window.location.href = "/";
  }

  const sms = health?.sms;
  const smsTone: Tone = !health ? "off" : sms?.configured ? (sms.dryRun ? "warn" : "ok") : "warn";
  const smsLabel = !health ? "Checking…" : !sms?.configured ? "Not configured" : sms.dryRun ? "Test mode" : "Connected";
  const calendarTone: Tone = !google?.connected ? "off" : google.calendarWrite ? "ok" : google.calendarRead ? "ok" : "warn";
  const calendarLabel = !google?.connected
    ? "Not connected"
    : google.calendarWrite
      ? "Adds showings"
      : google.calendarRead
        ? "Conflict checks"
        : "No calendar access";

  return (
    <div className="min-h-[100dvh] bg-background pb-32 text-foreground">
      <div className="mx-auto max-w-2xl px-5 pt-10 sm:px-8">
        <h1 className="mb-6 font-heading text-[34px] leading-tight">Settings</h1>

        {/* Account card */}
        <div className="mb-8 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-[22px] text-primary-foreground">
            {(profile.fullName.trim()[0] ?? "?").toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-title text-foreground">{profile.fullName || "Your name"}</p>
            <p className="truncate font-display text-body text-muted-foreground">{profile.email}</p>
          </div>
        </div>

        <Group title="Account">
          <EditRow Icon={KeyRound} label="Name" value={profile.fullName} placeholder="Your name" onSave={(v) => void saveProfile("fullName", v)} />
          <EditRow Icon={MessageSquare} label="Mobile" value={profile.phone} placeholder="(201) 555-0100" inputMode="tel" onSave={(v) => void saveProfile("phone", v)} />
          <Row Icon={Mail} label="Email" right={<span className="truncate font-display text-body text-muted-foreground">{profile.email}</span>} />
        </Group>

        <Group title="Brokerage">
          <EditRow Icon={Building2} label="Brokerage" value={profile.brokerageName} placeholder="Your brokerage" onSave={(v) => void saveProfile("brokerageName", v)} />
        </Group>

        <Group
          title="Integrations"
          footer="Status is read live from the server. Keys and secrets are set in the deployment's environment, never here."
        >
          <Row
            Icon={MessageSquare}
            label="Twilio SMS"
            detail={
              !health ? null : sms?.configured ? (
                <>
                  {sms.fromNumber ? `Texting from ${fmtPhone(sms.fromNumber)}` : "Texting via messaging service"}
                  {sms.dryRun ? " · texts are logged, not sent (SMS_DRY_RUN)" : ""}
                  {origin ? (
                    <div>
                      Inbound webhook: <CopyValue value={`${origin}/api/webhooks/twilio/sms`} />
                    </div>
                  ) : null}
                </>
              ) : (
                "Aria can't text leads until Twilio credentials and a sending number are set."
              )
            }
            right={<Status tone={smsTone}>{smsLabel}</Status>}
          />
          <Row
            Icon={Mail}
            label="Gmail"
            detail={google?.connected ? google.email : health && !health.googleConfigured ? "Google sign-in isn't configured on the server." : "Read and reply to client email."}
            right={<Status tone={google?.connected ? "ok" : "off"}>{google === null ? "Checking…" : google.connected ? "Connected" : "Not connected"}</Status>}
          />
          <Row
            Icon={CalendarDays}
            label="Google Calendar"
            detail={
              !google?.connected
                ? "Connect Google to check showing conflicts."
                : google.calendarWrite
                  ? "Checks conflicts and adds approved showings to your calendar."
                  : health?.calendarWriteEnabled
                    ? "Checks conflicts. Reconnect Google to let Aria add approved showings."
                    : "Checks conflicts before you approve a showing."
            }
            right={<Status tone={calendarTone}>{calendarLabel}</Status>}
          />
          {google?.connected ? (
            <>
              <Row Icon={Inbox} label="Open email inbox" href="/emails" />
              {health?.calendarWriteEnabled && !google.calendarWrite ? (
                <Row Icon={CalendarDays} label="Reconnect Google" onPress={() => (window.location.href = "/api/auth/google/connect")} />
              ) : null}
              <Row Icon={LogOut} label="Disconnect Google" onPress={() => void disconnectGoogle()} />
            </>
          ) : health?.googleConfigured !== false ? (
            <Row Icon={Mail} label="Connect Google" onPress={() => (window.location.href = "/api/auth/google/connect")} />
          ) : null}
          <Row
            Icon={Search}
            label="MLS / IDX"
            detail={health?.mlsConfigured ? "NJMLS listings via SimplyRETS. IDX disclaimer shown wherever listings appear." : "MLS search is off until the board's SimplyRETS credentials are set."}
            right={<Status tone={health?.mlsConfigured ? "ok" : "off"}>{!health ? "Checking…" : health.mlsConfigured ? "Connected" : "Not configured"}</Status>}
            href={health?.mlsConfigured ? "/listings" : undefined}
          />
          <Row
            Icon={Webhook}
            label="Lead intake"
            detail={
              health?.leads.webhookConfigured ? (
                <>
                  Send leads with the lead secret as a Bearer token:
                  {origin ? <CopyValue value={`${origin}/api/leads`} /> : null}
                  {health.leads.metaConfigured ? <div>Meta lead ads connected.</div> : null}
                  {!health.leads.defaultAgent ? <div>Website/Meta leads route to another agent account.</div> : null}
                </>
              ) : (
                "External lead sources are off until LEAD_WEBHOOK_SECRET is set. Leads you add by hand still work."
              )
            }
            right={<Status tone={health?.leads.webhookConfigured ? "ok" : "off"}>{!health ? "Checking…" : health.leads.webhookConfigured ? "On" : "Off"}</Status>}
          />
        </Group>

        <section className="mb-8">
          <h2 className="mb-2 px-4 font-display text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            BBA template
          </h2>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-3">
              <RowIcon Icon={FileSignature} />
              <p className="font-display text-caption text-muted-foreground">
                The default template is what clients sign from the link Aria texts after you approve a showing.
              </p>
            </div>
            <BbaTemplatesSection />
          </div>
        </section>

        <Group
          title="Aria automation"
          footer="Aria texts new leads, answers replies, recommends available homes and asks you before booking any showing. Pause Aria for one client from their Messages thread."
        >
          <Row
            Icon={MessageSquare}
            label="AI replies"
            detail={health && !health.aiConfigured ? "Claude isn't configured on the server — Aria can't draft or reply." : "Claude drafts the first text and replies to leads."}
            right={<Status tone={health?.aiConfigured ? "ok" : "warn"}>{!health ? "Checking…" : health.aiConfigured ? "On" : "Off"}</Status>}
          />
          <label className="flex min-h-[56px] items-center gap-3 px-4 py-3">
            <RowIcon Icon={MessageSquare} />
            <span className="flex-1 font-display text-body-lg text-foreground">Draft tone</span>
            <select
              value={drafts.draftTone}
              onChange={(e) => {
                const draftTone = e.target.value as DraftTone;
                setDrafts((d) => ({ ...d, draftTone }));
                void patch("/api/settings/drafts", { draftTone });
              }}
              className="bg-transparent text-right font-display text-body text-muted-foreground outline-none"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <EditRow
            Icon={Pen}
            label="Signature"
            value={drafts.signature}
            placeholder="– Sarah, ABC Realty"
            onSave={(signature) => void patch("/api/settings/drafts", { signature }).then((ok) => ok && setDrafts((d) => ({ ...d, signature })))}
          />
          <Row Icon={Mic} label="Train Aria on your voice" detail="Paste a few of your own texts so drafts sound like you." href="/settings/voice" />
        </Group>

        <Group title="Notifications">
          <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
            <RowIcon Icon={Mail} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-body-lg text-foreground">Daily follow-up email</p>
              <p className="font-display text-caption text-muted-foreground">
                {health && !health.emailConfigured
                  ? "Email isn't configured on the server — alerts still appear in the app."
                  : "Clients going quiet, each morning around 8 AM ET."}
              </p>
            </div>
            <Toggle
              label="Daily follow-up email"
              on={notify.notifyFollowups}
              onChange={(notifyFollowups) => {
                setNotify((n) => ({ ...n, notifyFollowups }));
                void patch("/api/settings/notifications", { notifyFollowups });
              }}
            />
          </div>
          <Row Icon={Inbox} label="In-app alerts" detail="New leads, showing requests, handoffs and signed BBAs appear in the bell on Today." />
        </Group>

        <Group title="Appearance">
          <div className="grid grid-cols-3 gap-1.5 p-2">
            {(
              [
                ["system", "System", Monitor],
                ["light", "Light", Sun],
                ["dark", "Dark", Moon],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => {
                  setTheme(value);
                  applyThemePref(value);
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2.5 font-display text-body font-medium",
                  theme === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </Group>

        <Group title="Data">
          <Row Icon={Upload} label="Import clients" detail="From a CSV export of your old CRM." href="/settings/import" />
          <Row Icon={Download} label={exporting ? "Exporting…" : "Export clients"} detail="Download every client as CSV." onPress={exporting ? undefined : () => void exportClients()} />
        </Group>

        <Group title="Security">
          <Row Icon={KeyRound} label="Change password" onPress={() => setPwOpen((v) => !v)} />
          {pwOpen ? (
            <form
              className="flex gap-2 px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                void changePassword();
              }}
            >
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (8+ characters)"
                className="min-w-0 flex-1 rounded-xl bg-secondary px-3.5 py-2.5 font-display text-body outline-none"
              />
              <Button type="submit" className="rounded-xl">
                Save
              </Button>
            </form>
          ) : null}
          <Row Icon={LogOut} label="Sign out everywhere" detail="Ends sessions on every device." onPress={() => void signOut("global")} />
          <Row Icon={LogOut} label="Sign out" onPress={() => void signOut("local")} danger />
        </Group>

        <Group title="Danger zone">
          <Row Icon={Trash2} label="Delete account" detail="Permanently deletes your account, clients, messages and documents." onPress={() => setDeleteOpen((v) => !v)} danger />
          {deleteOpen ? (
            <div className="space-y-2 px-4 py-3">
              <p className="font-display text-caption text-muted-foreground">
                Type <span className="font-semibold text-foreground">DELETE</span> to confirm. This can&apos;t be undone.
              </p>
              <div className="flex gap-2">
                <input
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  aria-label="Type DELETE to confirm"
                  className="min-w-0 flex-1 rounded-xl bg-secondary px-3.5 py-2.5 font-display text-body outline-none"
                />
                <Button variant="destructive" disabled={deleteText !== "DELETE" || deleting} onClick={() => void deleteAccount()} className="rounded-xl">
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          ) : null}
        </Group>

        <p className="text-center font-display text-caption text-muted-foreground/70">Aria · Made for New Jersey agents</p>
      </div>
      <Toaster />
    </div>
  );
}
