"use client";

/**
 * Desktop theater: one pinned, scroll-scrubbed shot (≈640vh).
 *   01 ask       the agent types one sentence to Aria
 *   02 work      Aria resolves the client, books the showing, sets the reminder
 *   03 calendar  the "What changed" rows lift off and fly into the real Calendar
 *                week and the Follow-ups badge; the room turns deep forest
 *   04 device    the desktop window narrows into a phone (clip-path), the showing
 *                flies into mobile Today
 *   05 tools     the phone pulls back; the agent's tools connect around it with
 *                line styles that encode their real status
 */

import { useId, useRef, type ReactNode } from "react";
import { Check } from "lucide-react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { DEMO, TOOLS, type ToolStatus } from "./demo-data";
import {
  CalendarWeek,
  ChangeRow,
  ChatHeader,
  Composer,
  EventBlock,
  NAV_ROW,
  NAV_TOP,
  PHONE,
  PhoneToday,
  ReplyCard,
  ShowingCard,
  Sidebar,
  StepRow,
  ToolCard,
  UserBubble,
  WIN,
  WindowChrome,
  changeRowRect,
  eventRect,
  tail,
} from "./product-ui";
import { Backdrop, Captions, ChapterRail, ScaledStage, SrNarrative } from "./theater-chrome";
import { chapters, ease, progressIn, rectAt, tween, typedLength, type Range, type Rect, type Stop } from "./timeline";

export const STAGE_W = 960;
export const STAGE_H = 640;

const WIN_AT = { x: 20, y: 20 };
const CHAT_AT = { x: 200, y: 36 };
const PHONE_AT = { x: 330, y: 20 };
const INSET = (WIN.w - PHONE.w) / 2; // 310: clip from window to phone width

const pad = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d / 2, w: r.w + d * 2, h: r.h + d });
const shift = (r: Rect, o: { x: number; y: number }): Rect => ({ ...r, x: r.x + o.x, y: r.y + o.y });

/** Visible inside [inR] and until [outR] ends: min(fade in, fade out). */
const window01 = (v: number, inR: Range, outR?: Range) => Math.min(progressIn(v, inR), outR ? 1 - progressIn(v, outR) : 1);

function useTween(p: MotionValue<number>, range: Range, a: number, b: number) {
  return useTransform(p, (v) => tween(v, range, a, b));
}

/* ───────────── flights ───────────── */

function Flight({ p, stops, className, children }: { p: MotionValue<number>; stops: Stop[]; className?: string; children: ReactNode }) {
  const x = useTransform(p, (v) => rectAt(v, stops).x);
  const y = useTransform(p, (v) => rectAt(v, stops).y);
  const width = useTransform(p, (v) => rectAt(v, stops).w);
  const height = useTransform(p, (v) => rectAt(v, stops).h);
  return (
    <motion.div className={cn("absolute left-0 top-0", className)} style={{ x, y, width, height }}>
      {children}
    </motion.div>
  );
}

function Layer({ opacity, className, children }: { opacity: MotionValue<number>; className?: string; children?: ReactNode }) {
  return (
    <motion.div className={cn("absolute inset-0", className)} style={{ opacity }}>
      {children}
    </motion.div>
  );
}

/** A soft ring that blooms once when something lands. */
function LandingRing({ p, rect, range, className }: { p: MotionValue<number>; rect: Rect; range: Range; className?: string }) {
  const opacity = useTransform(p, (v) => {
    const t = progressIn(v, range);
    return t <= 0 || t >= 1 ? 0 : 0.9 * (1 - t);
  });
  const scale = useTransform(p, (v) => 1 + 0.3 * ease(progressIn(v, range)));
  return (
    <motion.div
      className={cn("absolute rounded-[12px] border-2 border-sage", className)}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, opacity, scale }}
    />
  );
}

function StepFromP({ p, i, range }: { p: MotionValue<number>; i: number; range: Range }) {
  const done = useTransform(p, (v) => ease(progressIn(v, range)));
  const s = DEMO.steps[i];
  return <StepRow label={s.label} detail={s.detail} done={done} />;
}

/* ───────────── tools ───────────── */

const TOOL_Y = [36, 186, 336, 486];
const CARD_W = 230;
const LEFT_X = 40;
const RIGHT_X = STAGE_W - 40 - CARD_W;
const PHONE_SCALED = { left: 360, right: 600 }; // phone at 0.8 around the stage center
const DASH: Record<ToolStatus, string | undefined> = { live: undefined, import: "2 6", rolling: "9 6" };
const STROKE: Record<ToolStatus, string> = { live: "stroke-sidebar-accent", import: "stroke-sidebar-muted", rolling: "stroke-taupe-light" };

function toolGeometry(i: number) {
  const left = i < 4;
  const row = i % 4;
  const y = TOOL_Y[row];
  const x = left ? LEFT_X : RIGHT_X;
  const ay = y + 46;
  const ey = 170 + row * 100;
  const d = left
    ? `M ${x + CARD_W} ${ay} C ${x + CARD_W + 70} ${ay}, ${PHONE_SCALED.left - 70} ${ey}, ${PHONE_SCALED.left} ${ey}`
    : `M ${x} ${ay} C ${x - 70} ${ay}, ${PHONE_SCALED.right + 70} ${ey}, ${PHONE_SCALED.right} ${ey}`;
  return { left, x, y, d, start: 0.835 + (row * 2 + (left ? 0 : 1)) * 0.013 };
}

function ToolNode({ p, i }: { p: MotionValue<number>; i: number }) {
  const t = TOOLS[i];
  const g = toolGeometry(i);
  const opacity = useTransform(p, (v) => progressIn(v, [g.start, g.start + 0.035]));
  const x = useTransform(p, (v) => (1 - ease(progressIn(v, [g.start, g.start + 0.05]))) * (g.left ? 36 : -36));
  return (
    <motion.div className="absolute" style={{ left: g.x, top: g.y, width: CARD_W, opacity, x }}>
      <ToolCard {...t} />
    </motion.div>
  );
}

function ToolLine({ p, i }: { p: MotionValue<number>; i: number }) {
  const t = TOOLS[i];
  const g = toolGeometry(i);
  const pathLength = useTransform(p, (v) => progressIn(v, [g.start + 0.012, g.start + 0.07]));
  const id = `tool-line-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <g>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={STAGE_W} height={STAGE_H}>
        <motion.path d={g.d} fill="none" stroke="white" strokeWidth={6} style={{ pathLength }} />
      </mask>
      <path d={g.d} fill="none" strokeWidth={1.4} strokeLinecap="round" strokeDasharray={DASH[t.status]} className={STROKE[t.status]} mask={`url(#${id})`} />
    </g>
  );
}

function ToolsLegend({ p }: { p: MotionValue<number> }) {
  const opacity = useTransform(p, (v) => progressIn(v, [0.93, 0.97]));
  return (
    <motion.div style={{ opacity }} className="absolute inset-x-0 flex justify-center gap-6 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted" >
      {(["live", "import", "rolling"] as const).map((s) => (
        <span key={s} className="flex items-center gap-2" style={{ marginTop: 596 }}>
          <svg width="26" height="4" aria-hidden>
            <line x1="1" y1="2" x2="25" y2="2" strokeWidth={1.6} strokeLinecap="round" strokeDasharray={DASH[s]} className={STROKE[s]} />
          </svg>
          {s === "live" ? "Connected" : s === "import" ? "CSV / Excel import" : "Rolling out"}
        </span>
      ))}
    </motion.div>
  );
}

/* ───────────── stage ───────────── */

export function DesktopStage({ p }: { p: MotionValue<number> }) {
  // 01 ask
  const typed = useTransform(p, (v) => (v < 0.135 ? tail(DEMO.ask.slice(0, typedLength(v, DEMO.ask, [0.015, 0.12])), 50) : ""));
  const caret = useTransform<number, number>(p, (v) => (v >= 0.008 && v < 0.135 ? 1 : 0));
  const placeholder = useTransform<number, number>(p, (v) => (v < 0.012 || v >= 0.135 ? 1 : 0));
  const bubbleO = useTween(p, [0.13, 0.155], 0, 1);
  const bubbleY = useTween(p, [0.13, 0.155], 16, 0);
  const halo = useTransform(p, (v) => (0.25 + 0.55 * progressIn(v, [0.12, 0.17])) * (1 - progressIn(v, [0.34, 0.42])));

  // 02 work
  const stepsO = useTween(p, [0.155, 0.17], 0, 1);
  const replyO = useTween(p, [0.25, 0.29], 0, 1);
  const replyY = useTween(p, [0.25, 0.29], 18, 0);

  // 03 calendar: chat holds while the window rises behind it, then recedes as the rows fly
  const chatO = useTween(p, [0.42, 0.49], 1, 0);
  const chatS = useTween(p, [0.42, 0.5], 1, 0.88);
  const chatY = useTween(p, [0.42, 0.5], 0, -26);
  const winO = useTween(p, [0.35, 0.41], 0, 1);
  const winY = useTween(p, [0.35, 0.47], 190, 0);
  const winRX = useTween(p, [0.35, 0.47], 26, 0);
  const winS = useTween(p, [0.35, 0.47], 0.9, 1);
  const badge = useTransform<number, string>(p, (v) => (v >= 0.555 ? "3" : "2"));

  // 04 device: clip the window down to a phone, swap desk content for mobile Today
  const clipPath = useTransform(p, (v) => {
    const t = ease(progressIn(v, [0.62, 0.72]));
    return `inset(0px ${INSET * t}px 0px ${INSET * t}px round ${14 + 32 * t}px)`;
  });
  const deskO = useTween(p, [0.665, 0.705], 1, 0);
  const phoneO = useTween(p, [0.68, 0.73], 0, 1);
  const bezelO = useTween(p, [0.69, 0.75], 0, 1);

  // 05 tools
  const groupS = useTween(p, [0.8, 0.86], 1, 0.8);
  const toolsHalo = useTween(p, [0.8, 0.9], 0, 1);

  // Priya's showing: a "What changed" row → calendar block → mobile Today card
  const priyaRow = shift(changeRowRect(0), CHAT_AT);
  const priyaCal = shift(eventRect({ day: DEMO.showing.day, hour: DEMO.showing.hour, span: 1 }), WIN_AT);
  const priyaPhone: Rect = { x: PHONE_AT.x + 16, y: PHONE_AT.y + PHONE.cardTop, w: PHONE.w - 32, h: PHONE.card };
  const priyaStops: Stop[] = [
    { at: 0.4, rect: priyaRow },
    { at: 0.43, rect: pad(priyaRow, 10) },
    { at: 0.5, rect: priyaCal },
    { at: 0.63, rect: priyaCal },
    { at: 0.72, rect: priyaPhone },
  ];
  const pRowO = useTransform(p, (v) => window01(v, [0.28, 0.31], [0.43, 0.45]));
  const pChipO = useTransform(p, (v) => window01(v, [0.4, 0.43], [0.47, 0.5]));
  const pEventO = useTransform(p, (v) => window01(v, [0.46, 0.5], [0.645, 0.68]));
  const pCardO = useTransform(p, (v) => progressIn(v, [0.665, 0.71]));

  // Monday reminder: row → Follow-ups in the sidebar, where the badge ticks 2 → 3
  const remRow = shift(changeRowRect(1), CHAT_AT);
  const remNav: Rect = { x: WIN_AT.x + 12, y: WIN_AT.y + NAV_TOP + 3 * NAV_ROW, w: WIN.sidebar - 24, h: 30 };
  const remStops: Stop[] = [
    { at: 0.44, rect: remRow },
    { at: 0.47, rect: pad(remRow, 10) },
    { at: 0.555, rect: remNav },
  ];
  const rRowO = useTransform(p, (v) => window01(v, [0.295, 0.32], [0.46, 0.48]));
  const rChipO = useTransform(p, (v) => window01(v, [0.44, 0.47], [0.555, 0.58]));
  const rPillO = useTransform(p, (v) => window01(v, [0.48, 0.51], [0.545, 0.56]));

  return (
    <div className="relative font-display" style={{ width: STAGE_W, height: STAGE_H }}>
      {/* tools: halo + lines sit under everything else */}
      <motion.div
        className="absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ opacity: toolsHalo, background: "radial-gradient(circle, color-mix(in srgb, var(--glow) 30%, transparent), transparent 62%)" }}
      />
      <svg className="absolute inset-0" width={STAGE_W} height={STAGE_H} aria-hidden>
        {TOOLS.map((t, i) => <ToolLine key={t.id} p={p} i={i} />)}
      </svg>

      {/* the device: desktop window → phone */}
      <motion.div className="absolute inset-0" style={{ scale: groupS }}>
        <motion.div
          className="absolute"
          style={{
            left: WIN_AT.x, top: WIN_AT.y, width: WIN.w, height: WIN.h,
            opacity: winO, y: winY, rotateX: winRX, scale: winS, transformPerspective: 1400,
            filter: "drop-shadow(0 40px 60px rgb(var(--shadow-color) / 0.35))",
          }}
        >
          <motion.div className="absolute inset-0 overflow-hidden bg-card" style={{ clipPath }}>
            <Layer opacity={deskO}>
              <WindowChrome url="getariaai.com/calendar" />
              <Sidebar followups={badge} />
              <CalendarWeek />
            </Layer>
            <motion.div className="absolute top-0" style={{ left: INSET, width: PHONE.w, height: PHONE.h, opacity: phoneO }}>
              <PhoneToday showPriya={false} />
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* the conversation */}
      <motion.div
        className="absolute z-10"
        style={{ left: CHAT_AT.x - 120, top: CHAT_AT.y - 80, width: 800, height: 720, opacity: halo, background: "radial-gradient(closest-side, color-mix(in srgb, var(--glow) 22%, transparent), transparent)" }}
      />
      <motion.div
        className="absolute z-10 overflow-hidden rounded-[30px] border border-border bg-card shadow-pop"
        style={{ left: CHAT_AT.x, top: CHAT_AT.y, width: 560, height: 568, opacity: chatO, scale: chatS, y: chatY }}
      >
        <ChatHeader />
        <motion.div className="absolute right-6 top-[78px]" style={{ opacity: bubbleO, y: bubbleY }}>
          <UserBubble>{DEMO.ask}</UserBubble>
        </motion.div>
        <motion.div className="absolute left-6 top-[186px] space-y-1" style={{ opacity: stepsO }}>
          <StepFromP p={p} i={0} range={[0.17, 0.19]} />
          <StepFromP p={p} i={1} range={[0.2, 0.22]} />
          <StepFromP p={p} i={2} range={[0.23, 0.25]} />
        </motion.div>
        <motion.div className="absolute left-6 top-[282px]" style={{ opacity: replyO, y: replyY }}>
          <ReplyCard />
        </motion.div>
        <div className="absolute left-6 top-[496px]">
          <div className="relative">
            <Composer text={typed} caret={caret} />
            <motion.span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground" style={{ opacity: placeholder }}>
              Tell Aria what to do…
            </motion.span>
          </div>
        </div>
      </motion.div>

      {/* flights + device details, scaled with the device */}
      <motion.div className="pointer-events-none absolute inset-0 z-20" style={{ scale: groupS }}>
        <motion.div
          className="absolute rounded-[46px]"
          style={{
            left: PHONE_AT.x, top: PHONE_AT.y, width: PHONE.w, height: PHONE.h, opacity: bezelO,
            boxShadow: "0 0 0 9px var(--foreground), 0 0 0 10px color-mix(in srgb, var(--paper) 22%, transparent), 0 50px 90px -20px rgb(0 0 0 / 0.55)",
          }}
        />

        <Flight p={p} stops={priyaStops}>
          <Layer opacity={pChipO} className="rounded-[12px] bg-card shadow-float ring-1 ring-sage/50" />
          <Layer opacity={pRowO} className="flex items-center px-0">
            <ChangeRow status="Done" summary={DEMO.changes[0].summary} linkName={DEMO.client.first} />
          </Layer>
          <Layer opacity={pEventO}>
            <EventBlock e={{ kind: "showing", title: DEMO.showing.where, who: DEMO.showing.who, hour: DEMO.showing.hour }} className="bg-card shadow-float" />
          </Layer>
          <Layer opacity={pCardO}>
            <ShowingCard when="11:00 AM" who={DEMO.client.name} where={`${DEMO.showing.where} · Showing`} />
          </Layer>
        </Flight>
        <LandingRing p={p} rect={priyaCal} range={[0.5, 0.57]} />

        <Flight p={p} stops={remStops}>
          <Layer opacity={rChipO} className="rounded-[10px] bg-card shadow-float ring-1 ring-primary/30" />
          <Layer opacity={rRowO} className="flex items-center">
            <ChangeRow status="Done" summary={DEMO.changes[1].summary} />
          </Layer>
          <Layer opacity={rPillO} className="flex items-center gap-2 px-3 text-[12px] font-semibold text-foreground">
            <Check className="size-3.5 text-primary" strokeWidth={3} />
            <span className="truncate">{DEMO.reminder.title} · Mon</span>
          </Layer>
        </Flight>
        <LandingRing p={p} rect={remNav} range={[0.555, 0.62]} className="border-sidebar-accent" />
      </motion.div>

      {/* tools around the phone */}
      <div className="absolute inset-0 z-30">
        {TOOLS.map((t, i) => <ToolNode key={t.id} p={p} i={i} />)}
        <ToolsLegend p={p} />
      </div>
    </div>
  );
}

export function DesktopTheater() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const list = chapters("desktop");
  return (
    <section ref={ref} id="demo" data-env="theater" data-forest="0" aria-label="How Aria works" className="relative h-[640vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <Backdrop p={p} dark={[0.34, 0.42]} />
        <div className="relative mx-auto grid h-full max-w-[1520px] grid-cols-[minmax(300px,27%)_1fr] gap-8 px-10 pb-24 pt-24 xl:px-14">
          <div className="relative">
            <Captions list={list} p={p} lightFrom={2} size="lg" />
          </div>
          <div aria-hidden className="relative">
            <ScaledStage w={STAGE_W} h={STAGE_H} max={1.35} className="absolute inset-0">
              <DesktopStage p={p} />
            </ScaledStage>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <ChapterRail list={list} p={p} section={ref} skipTo="after-demo" />
        </div>
      </div>
      <SrNarrative />
    </section>
  );
}
