"use client";

import React from "react";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney, relTime } from "@/lib/utils";
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const COLS = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "showing", label: "Showing" },
  { id: "offer", label: "Offer" },
  { id: "under_contract", label: "Under Contract" },
  { id: "closed", label: "Closed" },
] as const;

type Client = {
  id: string;
  name: string;
  town: string | null;
  budget_max: number | null;
  lead_score: number | null;
  status: string | null;
  last_engagement_at: string | null;
};

function accentColor(score: number) {
  if (score >= 7) return "#3B82F6";
  if (score >= 4) return "#F59E0B";
  return "#374151";
}

function LeadBadge({ score }: { score: number }) {
  if (score >= 7) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-blue/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-blue">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />
        Hot · {score}
      </span>
    );
  }
  if (score >= 4) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-amber/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-amber">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-amber" />
        Warm · {score}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-dim">
      <span className="h-1.5 w-1.5 rounded-full bg-text-dim" />
      New · {score}
    </span>
  );
}

function DraggableCard({ c }: { c: Client }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: c.id,
  });
  const score = c.lead_score ?? 0;
  const style: React.CSSProperties = {
    ...(transform
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      : {}),
    zIndex: isDragging ? 50 : undefined,
    boxShadow: isDragging
      ? "0 16px 40px rgba(0,0,0,0.8)"
      : "0 2px 12px rgba(0,0,0,0.5)",
    borderLeft: `2px solid ${accentColor(score)}`,
    opacity: isDragging ? 0.95 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-[10px] border border-border-card bg-bg-card px-3 py-3.5 active:cursor-grabbing"
    >
      <div className="mb-2">
        <LeadBadge score={score} />
      </div>
      <div className="text-[13px] font-semibold leading-tight text-text-primary">
        {c.name}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-dim">
        <span className="font-medium text-text-muted">{fmtMoney(c.budget_max)}</span>
        {c.town && (
          <>
            <span className="text-border-card">·</span>
            <span>{c.town}</span>
          </>
        )}
      </div>
      <div className="mt-2.5 border-t border-border-card pt-2 text-right">
        <span className="text-[10px] text-text-dim">
          {relTime(c.last_engagement_at)}
        </span>
      </div>
    </div>
  );
}

function DroppableColumn({
  col,
  clients,
}: {
  col: (typeof COLS)[number];
  clients: Client[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const total = clients.reduce((s, c) => s + (c.budget_max ?? 0), 0);
  return (
    <div className="flex w-[85vw] shrink-0 snap-start flex-col sm:w-[228px]">
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-text-dim">
          {col.label}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/5 px-1.5 text-[9px] font-medium text-text-dim">
            {clients.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        style={{
          boxShadow: isOver
            ? "0 0 0 1px #3B82F6, inset 0 0 0 1px #3B82F6"
            : "0 2px 8px rgba(0,0,0,0.3)",
          transition: "box-shadow 0.15s",
        }}
        className={`min-h-[260px] flex-1 space-y-2 rounded-[14px] border bg-bg-deep p-2.5 ${
          isOver ? "border-accent-blue" : "border-border-card"
        }`}
      >
        {clients.map((c) => (
          <DraggableCard key={c.id} c={c} />
        ))}
        {clients.length === 0 && (
          <div className="flex h-16 items-center justify-center rounded-[8px] border border-dashed border-border-card">
            <span className="text-[10px] text-text-dim">Drop here</span>
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="mt-2 px-0.5 text-[10px] text-text-dim">
          {fmtMoney(total)} total
        </div>
      )}
    </div>
  );
}

export function PipelineBoard({ initial }: { initial: Client[] }) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [clients, setClients] = useState(initial);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const grouped = useMemo(() => {
    const g: Record<string, Client[]> = {};
    for (const col of COLS) g[col.id] = [];
    for (const c of clients) {
      const st = c.status ?? "new";
      if (g[st]) g[st].push(c);
      else g.new.push({ ...c, status: "new" });
    }
    return g;
  }, [clients]);

  async function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const targetCol = COLS.find((c) => c.id === overId)?.id;
    if (!targetCol) return;

    const prev = clients.find((c) => c.id === activeId);
    if (!prev || prev.status === targetCol) return;

    setClients((list) =>
      list.map((c) => (c.id === activeId ? { ...c, status: targetCol } : c)),
    );

    await supabase
      .from("clients")
      .update({ status: targetCol })
      .eq("id", activeId);

    if (targetCol === "offer") {
      toast.toast("AI can draft offer cover letter?", "success");
      const ok = window.confirm("AI can draft offer cover letter?");
      if (ok) {
        await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "Draft a short offer cover letter for my buyer.",
            context: JSON.stringify({ clientId: activeId }),
          }),
        });
      }
    }
    if (targetCol === "under_contract") {
      const ok = window.confirm("Add transaction milestones?");
      if (ok) router.push("/transactions");
    }
    router.refresh();
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={onDragEnd}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-3 [scroll-padding-left:1rem] snap-x snap-mandatory sm:snap-none">
        {COLS.map((col) => (
          <DroppableColumn key={col.id} col={col} clients={grouped[col.id]} />
        ))}
      </div>
    </DndContext>
  );
}
