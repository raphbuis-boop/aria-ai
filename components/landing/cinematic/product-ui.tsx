"use client";

/**
 * Static replicas of Aria's production interface for the landing theater:
 * the Ask Aria thread (read-only answers), the Showings list, the desktop nav
 * and mobile Today. Labels mirror components/BottomNav.tsx, app/(dashboard)/
 * showings and app/(dashboard)/dashboard. Semantic tokens only.
 *
 * Geometry is fixed (px in a logical canvas) so scroll-driven "flights"
 * between scenes land exactly on their targets. Change a constant here and the
 * theaters follow.
 */

import type { ReactNode } from "react";
import { motion, type MotionValue } from "motion/react";
import {
  ArrowUp,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Handshake,
  Home,
  Mail,
  Mic,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AriaOrb } from "./AriaOrb";
import { DEMO, PAST_SHOWING, SHOWINGS, TOOL_STATUS_LABEL, type ToolStatus } from "./demo-data";

/* ───────────────────────── geometry ───────────────────────── */

import type { Rect } from "./timeline";
export type { Rect };

/** Desktop app window, relative to its own top-left. */
export const WIN = { w: 920, h: 600, chrome: 36, sidebar: 176 } as const;
/** Showings list rows, relative to the window. */
export const LIST = { left: WIN.sidebar + 22, top: 136, w: WIN.w - WIN.sidebar - 44, row: 64, gap: 8 } as const;
/** Sidebar nav rows start under the wordmark. */
export const NAV_TOP = WIN.chrome + 64;
export const NAV_ROW = 34;

/** Upcoming showing `i` on the Showings list (Priya is row 0). */
export function showingRowRect(i: number): Rect {
  return { x: LIST.left, y: LIST.top + i * (LIST.row + LIST.gap), w: LIST.w, h: LIST.row };
}

/** Chat panel internals, relative to the panel. */
export const CHAT = { w: 560, h: 568, bubbleTop: 78, stepsTop: 186, stepRow: 28, replyTop: 282, rowsTop: 132, row: 28, composerTop: 496 } as const;
export const changeRowRect = (i: number): Rect => ({ x: 40, y: CHAT.replyTop + CHAT.rowsTop + i * CHAT.row, w: 480, h: 24 });

/** Mobile Today internals, relative to the phone screen (300 wide). */
/** cardTop = status bar 40 + header 112 + section title 26. */
export const PHONE = { w: 300, h: 600, cardTop: 178, card: 64, header: 112 } as const;

/** The last `max` characters of a string, with a leading ellipsis when cut. */
export const tail = (s: string, max: number) => (s.length > max ? `\u2026${s.slice(-(max - 1))}` : s);

/* ───────────────────────── assistant thread ───────────────────────── */

const STEP_ICON = "flex size-[18px] items-center justify-center rounded-full bg-primary text-primary-foreground";

export function ChatHeader() {
  return (
    <div className="flex h-[60px] items-center gap-3 border-b border-border px-6">
      <AriaOrb size={28} energy={0.5} breathe={false} />
      <div className="min-w-0 leading-tight">
        <p className="font-heading text-[20px] text-foreground">Aria</p>
        <p className="truncate font-display text-[11.5px] text-muted-foreground">Ask about your clients and your day.</p>
      </div>
      <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 font-display text-[11px] font-semibold text-muted-foreground">Web · Voice</span>
    </div>
  );
}

export function UserBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("h-[92px] w-[420px] rounded-[20px] rounded-br-md bg-primary px-4 py-3 font-display text-[15px] leading-[22px] text-primary-foreground", className)}>
      {children}
    </div>
  );
}

export function StepRow({ label, detail, done }: { label: string; detail: string; done: MotionValue<number> | number }) {
  return (
    <div className="flex h-6 items-center gap-2.5 font-display text-[13px]">
      <span className="relative size-[18px]">
        <span className="absolute inset-0 rounded-full border border-border" />
        <motion.span className={cn("absolute inset-0", STEP_ICON)} style={{ opacity: done, scale: done }}>
          <Check className="size-3" strokeWidth={3} />
        </motion.span>
      </span>
      <span className="font-semibold text-foreground">{label}</span>
      <span className="text-muted-foreground">· {detail}</span>
    </div>
  );
}

export function ChangeRow({ status, summary, linkName }: { status: string; summary: string; linkName?: string }) {
  return (
    <div className="flex h-6 w-full min-w-0 items-center whitespace-nowrap font-display text-[12.5px]">
      <span className="font-semibold text-primary">{status}:</span>
      <span className="ml-1 min-w-0 truncate text-foreground">{summary}</span>
      {linkName ? <span className="ml-1.5 shrink-0 font-semibold text-primary">Open {linkName} →</span> : null}
    </div>
  );
}

/** The reply with its "Found in Aria" header. The rows are placed by the caller (they fly out). */
export function ReplyCard({ className, textClassName, children }: { className?: string; textClassName?: string; children?: ReactNode }) {
  return (
    <div className={cn("h-[196px] w-[512px] rounded-[18px] border border-border bg-card px-4 pt-4 shadow-card", className)}>
      <p className={cn("h-[66px] font-display text-[14.5px] leading-[22px] text-foreground", textClassName)}>{DEMO.reply}</p>
      <div className="mt-4 border-t border-border pt-2.5">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Found in Aria</p>
      </div>
      {children}
    </div>
  );
}

/** The ask bar. Pass the tail of long text (see `tail`) so the caret stays in view. */
export function Composer({ text, caret = 1, className }: { text: MotionValue<string> | string; caret?: MotionValue<number> | number; className?: string }) {
  return (
    <div className={cn("flex h-[52px] w-[512px] items-center gap-2 rounded-full border border-border bg-card pl-5 pr-1.5 shadow-card", className)}>
      <p className="min-w-0 flex-1 overflow-hidden whitespace-nowrap font-display text-[14px] text-foreground">
        <motion.span>{text}</motion.span>
        <motion.span style={{ opacity: caret }} className="ml-px inline-block h-[17px] w-[2px] translate-y-[3px] bg-sage" />
      </p>
      <span className="flex size-9 items-center justify-center rounded-full text-muted-foreground"><Mic className="size-4" /></span>
      <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowUp className="size-4" /></span>
    </div>
  );
}

/* ───────────────────────── desktop shell + showings ───────────────────────── */

const NAV = [
  { label: "Today", Icon: Home },
  { label: "Email", Icon: Mail },
  { label: "Clients", Icon: Users },
  { label: "Follow-ups", Icon: CheckCircle2, badge: true },
  { label: "Showings", Icon: CalendarDays, active: true },
  { label: "Properties", Icon: Building2 },
  { label: "Deals", Icon: Handshake },
] as const;

export function WindowChrome({ url }: { url: string }) {
  return (
    <div className="flex h-9 items-center gap-2 border-b border-border bg-well px-4">
      <span className="size-2.5 rounded-full bg-foreground/15" />
      <span className="size-2.5 rounded-full bg-foreground/15" />
      <span className="size-2.5 rounded-full bg-foreground/15" />
      <span className="mx-auto flex h-6 w-[300px] items-center justify-center rounded-md bg-card font-display text-[11px] text-muted-foreground">{url}</span>
      <span className="w-[42px]" />
    </div>
  );
}

export function Sidebar({ followups }: { followups: MotionValue<string> | string }) {
  return (
    <div className="absolute bottom-0 left-0 bg-sidebar text-sidebar-foreground" style={{ top: WIN.chrome, width: WIN.sidebar }}>
      <div className="flex h-16 items-center gap-2 px-5">
        <AriaOrb size={22} energy={0.35} breathe={false} />
        <span className="font-heading text-[19px]">Aria</span>
      </div>
      {NAV.map(({ label, Icon, ...rest }) => (
        <div
          key={label}
          className={cn(
            "mx-3 flex h-[30px] items-center gap-2.5 rounded-[10px] px-2.5 font-display text-[12.5px]",
            "active" in rest ? "bg-sidebar-raised font-semibold text-sidebar-foreground" : "text-sidebar-muted",
          )}
          style={{ marginBottom: NAV_ROW - 30 }}
        >
          <Icon className="size-[15px]" />
          {label}
          {"badge" in rest ? (
            <motion.span className="ml-auto rounded-full bg-signal px-1.5 font-display text-[10.5px] font-semibold leading-[17px] text-primary-foreground">
              {followups}
            </motion.span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ListLabel({ children, top }: { children: ReactNode; top: number }) {
  return (
    <p className="absolute font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground" style={{ left: LIST.left, top }}>
      {children}
    </p>
  );
}

/** Showings page body: header, upcoming showings and a past one (Priya's row is rendered by the caller). */
export function ShowingsList() {
  const pastTop = LIST.top + SHOWINGS.length * (LIST.row + LIST.gap) + 26;
  return (
    <>
      <div className="absolute flex items-center gap-2" style={{ left: LIST.left, right: 22, top: WIN.chrome + 18, height: 44 }}>
        <h3 className="font-heading text-[22px] text-foreground">Showings</h3>
        <span className="ml-auto flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 font-display text-[12px] font-semibold text-primary-foreground">
          <Plus className="size-3.5" /> Log a showing
        </span>
      </div>
      <ListLabel top={LIST.top - 26}>Upcoming</ListLabel>
      {SHOWINGS.map((s, i) => {
        if (i === 0) return null;
        const r = showingRowRect(i);
        return (
          <div key={s.who} className="absolute" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
            <ShowingCard {...s} />
          </div>
        );
      })}
      <ListLabel top={pastTop - 26}>Past</ListLabel>
      <div className="absolute" style={{ left: LIST.left, top: pastTop, width: LIST.w, height: LIST.row }}>
        <ShowingCard {...PAST_SHOWING} tone="muted" />
      </div>
    </>
  );
}

/* ───────────────────────── mobile ───────────────────────── */

export function StatusBar() {
  return (
    <div className="flex h-10 items-center justify-between px-6 pt-1 font-display text-[12px] font-semibold text-foreground">
      <span>9:41</span>
      <span className="h-[22px] w-[84px] rounded-full bg-foreground" />
      <span className="flex items-center gap-1"><i className="h-2.5 w-4 rounded-[3px] border border-foreground/70" /></span>
    </div>
  );
}

export function BottomNavBar() {
  const tabs = [
    { label: "Today", Icon: Home, active: true },
    { label: "Clients", Icon: Users },
    null,
    { label: "Follow-ups", Icon: CheckCircle2 },
    { label: "Properties", Icon: Building2 },
  ];
  return (
    <div className="absolute inset-x-0 bottom-0 flex h-[72px] items-start justify-around border-t border-border bg-card/95 px-2 pt-2.5">
      {tabs.map((t, i) =>
        t ? (
          <span key={t.label} className={cn("flex w-14 flex-col items-center gap-1 font-display text-[9.5px] font-semibold", t.active ? "text-primary" : "text-muted-foreground")}>
            <t.Icon className="size-[18px]" />
            {t.label}
          </span>
        ) : (
          <span key={i} className="-mt-1"><AriaOrb size={38} energy={0.45} breathe={false} /></span>
        ),
      )}
    </div>
  );
}

export function SectionTitle({ children, link }: { children: ReactNode; link?: string }) {
  return (
    <div className="flex h-[26px] items-center justify-between px-4 font-display">
      <span className="text-[12.5px] font-semibold text-foreground">{children}</span>
      {link ? <span className="text-[11.5px] font-semibold text-primary">{link}</span> : null}
    </div>
  );
}

export function ShowingCard({ when, who, where, tone = "showing" }: { when: string; who: string; where: string; tone?: "showing" | "muted" }) {
  return (
    <div className={cn("flex h-16 items-center gap-3 rounded-[16px] border border-border bg-card px-3 shadow-card")}>
      <div className={cn("flex h-11 w-[52px] shrink-0 flex-col items-center justify-center rounded-[11px] font-display leading-none", tone === "showing" ? "bg-sage/15 text-foreground" : "bg-secondary text-muted-foreground")}>
        <span className="text-[13px] font-semibold">{when.split(" ")[0]}</span>
        <span className="mt-0.5 text-[9.5px] font-semibold uppercase">{when.split(" ")[1]}</span>
      </div>
      <div className="min-w-0 font-display">
        <p className="truncate text-[13px] font-semibold text-foreground">{who}</p>
        <p className="truncate text-[11.5px] text-muted-foreground">{where}</p>
      </div>
    </div>
  );
}

/** Mobile Today on the showing day. Priya's card (at PHONE.cardTop) is rendered by the caller when it flies in. */
export function PhoneToday({ showPriya = true, statusBar = true }: { showPriya?: boolean; statusBar?: boolean }) {
  return (
    <div className="relative h-full w-full bg-background">
      {statusBar ? <StatusBar /> : null}
      <div className="px-4 pt-3" style={{ height: PHONE.header }}>
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Saturday</p>
        <p className="mt-1 font-heading text-[28px] leading-none text-foreground">Today</p>
        <div className="mt-3 flex h-8 items-center gap-2 rounded-full bg-secondary px-3 font-display text-[11.5px] text-muted-foreground">
          <Search className="size-3.5" /> Ask Aria anything…
        </div>
      </div>
      <SectionTitle link="Showings">Today&apos;s showings</SectionTitle>
      <div className="space-y-2 px-4">
        <div style={{ opacity: showPriya ? 1 : 0 }}>
          <ShowingCard when="11:00 AM" who={DEMO.client.name} where={`${DEMO.showing.where} · Showing`} />
        </div>
        <ShowingCard when="1:00 PM" who="Elena Ruiz" where="5 Orchard Ct · Showing" />
      </div>
      <div className="mt-5"><SectionTitle link="All">Follow-ups</SectionTitle></div>
      <div className="mx-4 flex h-[52px] items-center gap-3 rounded-[16px] border border-border bg-card px-3">
        <span className="size-[18px] rounded-full border-2 border-primary/50" />
        <div className="min-w-0 font-display">
          <p className="truncate text-[12.5px] font-semibold text-foreground">{DEMO.reminder.title}</p>
          <p className="text-[11px] text-muted-foreground">Monday · {DEMO.client.name}</p>
        </div>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 font-display text-[10px] font-semibold text-primary">Follow-up</span>
      </div>
      <BottomNavBar />
    </div>
  );
}

/* ───────────────────────── tools ───────────────────────── */

const STATUS_STYLE: Record<ToolStatus, string> = {
  live: "bg-sidebar-accent text-sidebar-accent-foreground",
  import: "border border-sidebar-muted/50 text-sidebar-foreground",
};

export function StatusPill({ status }: { status: ToolStatus }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em]", STATUS_STYLE[status])}>
      {TOOL_STATUS_LABEL[status]}
    </span>
  );
}

export function ToolCard({ name, status, relation, mark, className }: { name: string; status: ToolStatus; relation: string; mark: string; className?: string }) {
  return (
    <div className={cn("rounded-[16px] border border-sidebar-foreground/10 bg-sidebar-raised/80 p-3 backdrop-blur-md", className)}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-sidebar-foreground/10 font-heading text-[14px] text-sidebar-foreground">{mark}</span>
        <div className="min-w-0">
          <p className="truncate font-display text-[13px] font-semibold text-sidebar-foreground">{name}</p>
          <StatusPill status={status} />
        </div>
      </div>
      <p className="mt-2 font-display text-[11.5px] leading-snug text-sidebar-muted">{relation}</p>
    </div>
  );
}
