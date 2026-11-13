"use client";

/**
 * Mobile theater: designed for a phone, not a squeezed desktop shot (≈420vh).
 * The visitor's screen *is* the app:
 *   01 ask       the composer types the request
 *   02 work      steps resolve, the answer and "Found in Aria" appear
 *   03 calendar  iOS-style push from the thread into Today, showing highlighted
 *   04 device    reverse reveal: the phone shrinks into a device and Aria's
 *                desktop Showings list rises behind it, same showing highlighted
 *   05 tools     a vertical spine from the orb to each tool, with true status
 */

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { AriaOrb } from "./AriaOrb";
import { DEMO, SHOWINGS, TOOLS, type ToolStatus } from "./demo-data";
import {
  ChangeRow,
  ChatHeader,
  Composer,
  PhoneToday,
  ReplyCard,
  ShowingCard,
  ShowingsList,
  Sidebar,
  StatusPill,
  StepRow,
  UserBubble,
  WIN,
  WindowChrome,
  showingRowRect,
  tail,
} from "./product-ui";
import { Backdrop, Captions, ChapterRail, ScaledStage, SrNarrative } from "./theater-chrome";
import { chapters, ease, progressIn, tween, typedLength, type Range } from "./timeline";

export const M_W = 360;
export const M_H = 560;

function useTween(p: MotionValue<number>, range: Range, a: number, b: number) {
  return useTransform(p, (v) => tween(v, range, a, b));
}

function StepFromP({ p, i, range }: { p: MotionValue<number>; i: number; range: Range }) {
  const done = useTransform(p, (v) => ease(progressIn(v, range)));
  const s = DEMO.steps[i];
  return <StepRow label={s.label} detail={s.detail} done={done} />;
}

const DOT: Record<ToolStatus, string> = {
  live: "bg-sidebar-accent",
  import: "border border-sidebar-muted bg-sidebar",
  soon: "border border-dashed border-taupe-light bg-sidebar",
};

function ToolRow({ p, i }: { p: MotionValue<number>; i: number }) {
  const t = TOOLS[i];
  const s = 0.82 + i * 0.017;
  const opacity = useTransform(p, (v) => progressIn(v, [s, s + 0.03]));
  const x = useTransform(p, (v) => (1 - ease(progressIn(v, [s, s + 0.045]))) * 22);
  return (
    <motion.div className="relative flex min-h-[56px] items-center gap-3 py-1.5 pl-[44px] pr-2" style={{ opacity, x }}>
      <span className={cn("absolute left-[22px] top-1/2 size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full", DOT[t.status])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate font-display text-[13.5px] font-semibold text-sidebar-foreground">{t.name}</p>
          <StatusPill status={t.status} />
        </div>
        <p className="font-display text-[11.5px] leading-snug text-sidebar-muted">{t.relation}</p>
      </div>
    </motion.div>
  );
}

export function MobileStage({ p }: { p: MotionValue<number> }) {
  // 01 ask
  const typed = useTransform(p, (v) => (v < 0.155 ? tail(DEMO.ask.slice(0, typedLength(v, DEMO.ask, [0.015, 0.14])), 30) : ""));
  const caret = useTransform<number, number>(p, (v) => (v >= 0.008 && v < 0.155 ? 1 : 0));
  const placeholder = useTransform<number, number>(p, (v) => (v < 0.012 || v >= 0.155 ? 1 : 0));
  const bubbleO = useTween(p, [0.15, 0.175], 0, 1);
  const bubbleY = useTween(p, [0.15, 0.175], 16, 0);

  // 02 work
  const stepsO = useTween(p, [0.18, 0.195], 0, 1);
  const replyO = useTween(p, [0.28, 0.32], 0, 1);
  const replyY = useTween(p, [0.28, 0.32], 18, 0);
  const rowsO = useTween(p, [0.31, 0.34], 0, 1);

  // 03 push into Today
  const chatX = useTween(p, [0.4, 0.48], 0, -96);
  const chatDim = useTween(p, [0.4, 0.48], 0, 0.35);
  const todayX = useTween(p, [0.4, 0.48], M_W + 8, 0);
  const toastO = useTransform(p, (v) => Math.min(progressIn(v, [0.47, 0.5]), 1 - progressIn(v, [0.55, 0.57])));
  const toastY = useTween(p, [0.47, 0.5], 18, 0);
  const ringO = useTransform(p, (v) => {
    const t = progressIn(v, [0.49, 0.55]);
    return t <= 0 || t >= 1 ? 0 : 0.9 * (1 - t);
  });
  const ringS = useTween(p, [0.49, 0.55], 1, 1.08);

  // 04 phone → desk
  const phoneS = useTween(p, [0.6, 0.7], 1, 0.52);
  const phoneX = useTween(p, [0.6, 0.7], 0, 70);
  const phoneY = useTween(p, [0.6, 0.7], 0, 112);
  const bezelO = useTween(p, [0.63, 0.7], 0, 1);
  const deskO = useTween(p, [0.64, 0.7], 0, 1);
  const deskY = useTween(p, [0.64, 0.74], 50, 0);
  const deskRX = useTween(p, [0.64, 0.74], 18, 0);

  // 05 tools
  const devicesO = useTween(p, [0.78, 0.82], 1, 0);
  const devicesS = useTween(p, [0.78, 0.84], 1, 0.9);
  const orbO = useTween(p, [0.8, 0.84], 0, 1);
  const spine = useTween(p, [0.82, 0.96], 0, 1);

  const DESK_SCALE = 0.38;
  const priya = showingRowRect(0);

  return (
    <div className="relative font-display" style={{ width: M_W, height: M_H }}>
      <motion.div className="absolute inset-0" style={{ opacity: devicesO, scale: devicesS }}>
        {/* Aria's desktop Showings list, rising behind the phone */}
        <motion.div
          className="absolute left-[5px] top-[56px] origin-top-left"
          style={{ opacity: deskO, y: deskY, rotateX: deskRX, transformPerspective: 1000, scale: DESK_SCALE }}
        >
          <div className="relative overflow-hidden rounded-[16px] bg-card shadow-pop" style={{ width: WIN.w, height: WIN.h }}>
            <WindowChrome url="getariaai.com/showings" />
            <Sidebar followups="3" />
            <ShowingsList />
            <div className="absolute" style={{ left: priya.x, top: priya.y, width: priya.w, height: priya.h }}>
              <div className="h-full rounded-[16px] ring-4 ring-sage/50"><ShowingCard {...SHOWINGS[0]} /></div>
            </div>
          </div>
        </motion.div>

        {/* the phone: thread, then Today */}
        <motion.div className="absolute inset-0" style={{ scale: phoneS, x: phoneX, y: phoneY }}>
          <motion.div
            className="absolute inset-0 rounded-[30px]"
            style={{ opacity: bezelO, boxShadow: "0 0 0 10px var(--foreground), 0 0 0 11px color-mix(in srgb, var(--paper) 22%, transparent), 0 40px 70px -20px rgb(0 0 0 / 0.55)" }}
          />
          <div className="absolute inset-0 overflow-hidden rounded-[30px] border border-border bg-card shadow-pop">
            {/* thread */}
            <motion.div className="absolute inset-0" style={{ x: chatX }}>
              <ChatHeader />
              <motion.div className="absolute right-4 top-[72px]" style={{ opacity: bubbleO, y: bubbleY }}>
                <UserBubble className="h-auto w-auto max-w-[300px] text-[14px] leading-[21px]">{DEMO.ask}</UserBubble>
              </motion.div>
              <motion.div className="absolute left-4 top-[196px] space-y-0.5" style={{ opacity: stepsO }}>
                <StepFromP p={p} i={0} range={[0.2, 0.22]} />
                <StepFromP p={p} i={1} range={[0.225, 0.245]} />
                <StepFromP p={p} i={2} range={[0.25, 0.27]} />
              </motion.div>
              <motion.div className="absolute left-4 top-[282px]" style={{ opacity: replyO, y: replyY }}>
                <ReplyCard className="h-auto w-[328px] pb-3" textClassName="h-auto text-[13.5px] leading-[20px]">
                  <motion.div style={{ opacity: rowsO }} className="mt-1">
                    <ChangeRow status="Showing" summary="Priya, today at 11:00 AM" />
                    <ChangeRow status="Follow-up" summary="Send Priya comps, due Monday" />
                  </motion.div>
                </ReplyCard>
              </motion.div>
              <div className="absolute left-4 top-[494px]">
                <div className="relative">
                  <Composer text={typed} caret={caret} className="w-[328px]" />
                  <motion.span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground" style={{ opacity: placeholder }}>
                    Ask Aria anything…
                  </motion.span>
                </div>
              </div>
              <motion.div className="pointer-events-none absolute inset-0 bg-foreground" style={{ opacity: chatDim }} />
            </motion.div>

            {/* Today, pushed in */}
            <motion.div className="absolute inset-0 shadow-sheet" style={{ x: todayX }}>
              <PhoneToday statusBar={false} />
              <motion.div className="absolute left-4 right-4 top-[138px] h-16 rounded-[16px] border-2 border-sage" style={{ opacity: ringO, scale: ringS }} />
              <motion.div
                className="absolute inset-x-4 bottom-[84px] flex h-10 items-center gap-2 rounded-full bg-sidebar px-4 text-[12px] font-semibold text-sidebar-foreground shadow-float"
                style={{ opacity: toastO, y: toastY }}
              >
                <AriaOrb size={16} energy={0.5} breathe={false} /> On Today · 11:00 AM, 14 Linden Ave
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* tools */}
      <motion.div className="absolute left-1/2 top-1 -translate-x-1/2" style={{ opacity: orbO }}>
        <AriaOrb size={44} energy={0.8} />
      </motion.div>
      <motion.div className="absolute left-[21.5px] top-[62px] w-px origin-top bg-sidebar-muted/50" style={{ height: 476, scaleY: spine }} />
      <div className="absolute inset-x-0 top-[62px]">
        {TOOLS.map((t, i) => <ToolRow key={t.id} p={p} i={i} />)}
      </div>
    </div>
  );
}

export function MobileTheater() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const list = chapters("mobile");
  return (
    <section ref={ref} id="demo-mobile" data-env="theater" data-forest="0" aria-label="How Aria works" className="relative h-[460vh]">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden">
        <Backdrop p={p} dark={[0.58, 0.64]} />
        <div className="relative h-[230px] shrink-0 px-5 pt-[84px]">
          <Captions list={list} p={p} lightFrom={3} size="sm" />
        </div>
        <div aria-hidden className="relative min-h-0 flex-1">
          <ScaledStage w={M_W} h={M_H} max={1.25} className="absolute inset-x-3 inset-y-1">
            <MobileStage p={p} />
          </ScaledStage>
        </div>
        <div className="relative flex shrink-0 justify-center pb-[max(12px,env(safe-area-inset-bottom))] pt-1">
          <ChapterRail list={list} p={p} section={ref} skipTo="after-demo" compact />
        </div>
      </div>
      <SrNarrative />
    </section>
  );
}
