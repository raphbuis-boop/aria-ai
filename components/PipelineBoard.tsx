"use client";

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

function LeadDot({ score }: { score: number }) {
  if (score >= 7) {
    return <span className="h-2 w-2 rounded-full bg-accent-blue" />;
  }
  if (score >= 4) {
    return <span className="h-2 w-2 rounded-full bg-accent-amber" />;
  }
  return <span className="h-2 w-2 rounded-full bg-text-dim" />;
}

function DraggableCard({ c }: { c: Client }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: c.id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-[10px] border border-border-card bg-bg-card p-3 active:cursor-grabbing"
    >
      <div className="text-[13px] font-medium text-text-primary">{c.name}</div>
      <div className="mt-1 text-[11px] text-text-dim">
        {fmtMoney(c.budget_max)} · {c.town ?? "—"}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <LeadDot score={c.lead_score ?? 0} />
        <span className="text-[11px] text-text-dim">
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
    <div className="flex w-[220px] shrink-0 flex-col">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-dim">
        {col.label}
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[240px] flex-1 space-y-2 rounded-[12px] border border-border-card bg-bg-deep p-2 ${
          isOver ? "border-accent-blue" : ""
        }`}
      >
        {clients.map((c) => (
          <DraggableCard key={c.id} c={c} />
        ))}
      </div>
      <div className="mt-2 text-[11px] text-text-muted">
        Total: {fmtMoney(total)}
      </div>
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
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {COLS.map((col) => (
          <DroppableColumn key={col.id} col={col} clients={grouped[col.id]} />
        ))}
      </div>
    </DndContext>
  );
}
