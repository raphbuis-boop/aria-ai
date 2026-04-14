"use client";

import React, { useMemo, useState } from "react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type DemoClient = {
  id: string;
  name: string;
  town: string;
  budget: string;
  score: number;
  status: string;
  lastSeen: string;
  note: string;
};

// ─── Demo data ────────────────────────────────────────────────────────────────

const INITIAL_CLIENTS: DemoClient[] = [
  { id: "d1", name: "Jennifer Walsh",       town: "Montclair",   budget: "$620k",  score: 6,  status: "new",            lastSeen: "2h ago",    note: "3 bed min, big yard" },
  { id: "d2", name: "Robert Kim",           town: "Glen Ridge",  budget: "$490k",  score: 3,  status: "new",            lastSeen: "1d ago",    note: "First-time buyer" },
  { id: "d3", name: "Marcus Thompson",      town: "Ridgewood",   budget: "$875k",  score: 9,  status: "contacted",      lastSeen: "30m ago",   note: "Viewed 14 Elm St 3×" },
  { id: "d4", name: "Ashley Rivera",        town: "Summit",      budget: "$1.1M",  score: 7,  status: "contacted",      lastSeen: "3h ago",    note: "Needs 4+ beds" },
  { id: "d5", name: "David & Lisa Park",    town: "Westfield",   budget: "$720k",  score: 9,  status: "showing",        lastSeen: "1h ago",    note: "Showing Thurs 2pm" },
  { id: "d6", name: "Tom Chen",             town: "Millburn",    budget: "$990k",  score: 8,  status: "showing",        lastSeen: "4h ago",    note: "2nd showing booked" },
  { id: "d7", name: "Sarah & Mike Rodriguez", town: "Hoboken",   budget: "$850k",  score: 10, status: "offer",          lastSeen: "20m ago",   note: "Offer at $832k ✓" },
  { id: "d8", name: "James O'Brien",        town: "Montclair",   budget: "$635k",  score: 9,  status: "under_contract", lastSeen: "2d ago",    note: "Closing June 15" },
  { id: "d9", name: "The Nguyen Family",    town: "Glen Rock",   budget: "$760k",  score: 8,  status: "closed",         lastSeen: "1w ago",    note: "Closed $752k 🎉" },
];

const COLS = [
  { id: "new",            label: "New" },
  { id: "contacted",      label: "Contacted" },
  { id: "showing",        label: "Showing" },
  { id: "offer",          label: "Offer" },
  { id: "under_contract", label: "Under Contract" },
  { id: "closed",         label: "Closed" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function accentColor(score: number) {
  if (score >= 7) return "#3B82F6";
  if (score >= 4) return "#F59E0B";
  return "#374151";
}

function LeadBadge({ score }: { score: number }) {
  if (score >= 7) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-400">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
        Hot · {score}
      </span>
    );
  }
  if (score >= 4) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Warm · {score}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
      New · {score}
    </span>
  );
}

// ─── Draggable card ────────────────────────────────────────────────────────────

function DraggableCard({ c }: { c: DemoClient }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });

  const style: React.CSSProperties = {
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
    zIndex: isDragging ? 50 : undefined,
    boxShadow: isDragging ? "0 16px 40px rgba(0,0,0,0.8)" : "0 2px 12px rgba(0,0,0,0.5)",
    borderLeft: `2px solid ${accentColor(c.score)}`,
    opacity: isDragging ? 0.95 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-[10px] border border-[#222] bg-[#111] px-3 py-3.5 active:cursor-grabbing"
    >
      <div className="mb-2">
        <LeadBadge score={c.score} />
      </div>
      <div className="text-[13px] font-semibold leading-tight text-white">{c.name}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
        <span className="font-medium text-gray-400">{c.budget}</span>
        <span className="text-[#333]">·</span>
        <span>{c.town}</span>
      </div>
      {c.note && (
        <div className="mt-1.5 text-[10px] italic text-gray-600">{c.note}</div>
      )}
      <div className="mt-2.5 border-t border-[#222] pt-2 text-right">
        <span className="text-[10px] text-gray-600">{c.lastSeen}</span>
      </div>
    </div>
  );
}

// ─── Droppable column ─────────────────────────────────────────────────────────

function DroppableColumn({
  col,
  clients,
}: {
  col: (typeof COLS)[number];
  clients: DemoClient[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className="flex w-[85vw] shrink-0 snap-start flex-col sm:w-[228px]">
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-600">
          {col.label}
        </div>
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/5 px-1.5 text-[9px] font-medium text-gray-600">
          {clients.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          boxShadow: isOver
            ? "0 0 0 1px #3B82F6"
            : "0 2px 8px rgba(0,0,0,0.3)",
          transition: "box-shadow 0.15s",
        }}
        className={`min-h-[260px] flex-1 space-y-2 rounded-[14px] border bg-[#0a0a0a] p-2.5 ${
          isOver ? "border-blue-500" : "border-[#1a1a1a]"
        }`}
      >
        {clients.map((c) => (
          <DraggableCard key={c.id} c={c} />
        ))}
        {clients.length === 0 && (
          <div className="flex h-16 items-center justify-center rounded-[8px] border border-dashed border-[#1a1a1a]">
            <span className="text-[10px] text-gray-700">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const g: Record<string, DemoClient[]> = {};
    for (const col of COLS) g[col.id] = [];
    for (const c of clients) {
      if (g[c.status]) g[c.status].push(c);
      else g.new.push({ ...c, status: "new" });
    }
    return g;
  }, [clients]);

  const pipelineValue = clients
    .filter((c) => !["closed"].includes(c.status))
    .reduce((sum, c) => {
      const num = parseFloat(c.budget.replace(/[$k,M]/g, ""));
      const mult = c.budget.includes("M") ? 1000000 : c.budget.includes("k") ? 1000 : 1;
      return sum + num * mult;
    }, 0);

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const targetCol = COLS.find((c) => c.id === overId)?.id;
    if (!targetCol) return;
    setClients((list) =>
      list.map((c) => (c.id === activeId ? { ...c, status: targetCol } : c)),
    );
  }

  const hotLeads = clients.filter((c) => c.score >= 8 && c.status !== "closed");

  return (
    <div className="mx-auto max-w-[calc(228px*6+20px*5+32px)] px-4 pb-10 pt-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-blue-500">
            ARIA DEMO · NJ AGENT VIEW
          </div>
          <h1 className="mt-1 text-[20px] font-semibold text-white">Pipeline</h1>
          <p className="mt-0.5 text-[12px] text-gray-600">
            Drag cards between columns — changes are local to this demo.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-gray-600">Pipeline value</div>
          <div className="text-[20px] font-semibold text-blue-400">
            ${(pipelineValue / 1000000).toFixed(1)}M
          </div>
        </div>
      </div>

      {/* Morning briefing card */}
      <div className="mb-6 rounded-[14px] border border-[#1a1a1a] bg-[#0a0a0a] p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Morning Briefing</span>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-300">
          You have{" "}
          <span className="font-semibold text-amber-400">{hotLeads.length} hot leads</span> ready to contact.{" "}
          <span className="font-semibold text-white">Sarah & Mike Rodriguez</span> submitted an offer at $832k — awaiting response.{" "}
          <span className="font-semibold text-white">Marcus Thompson</span> viewed 14 Elm St three times this week.{" "}
          Aria has <span className="font-semibold text-blue-400">4 AI-drafted texts</span> ready for your approval.
        </p>
      </div>

      {/* Kanban board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="-mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-3 [scroll-padding-left:1rem] snap-x snap-mandatory sm:snap-none">
          {COLS.map((col) => (
            <DroppableColumn key={col.id} col={col} clients={grouped[col.id]} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
