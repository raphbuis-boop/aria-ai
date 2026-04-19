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

type DemoClient = {
  id: string;
  name: string;
  town: string;
  budget: string;
  score: number;
  status: string;
  lastSeen: string;
  note: string;
  phone: string;
  email: string;
  beds: number;
};

type DemoDraft = {
  id: string;
  clientId: string;
  clientName: string;
  scenario: string;
  body: string;
  createdAt: string;
};

const INITIAL_CLIENTS: DemoClient[] = [
  { id: "d1", name: "Jennifer Walsh",         town: "Montclair",   budget: "$620k",  score: 6,  status: "new",            lastSeen: "2h ago",   note: "3 bed min, big yard",    phone: "(973) 555-0142", email: "jen.walsh@example.com",     beds: 3 },
  { id: "d2", name: "Robert Kim",             town: "Glen Ridge",  budget: "$490k",  score: 3,  status: "new",            lastSeen: "1d ago",   note: "First-time buyer",       phone: "(201) 555-0187", email: "rkim@example.com",          beds: 2 },
  { id: "d3", name: "Marcus Thompson",        town: "Ridgewood",   budget: "$875k",  score: 9,  status: "contacted",      lastSeen: "30m ago",  note: "Viewed 14 Elm St 3×",    phone: "(201) 555-0221", email: "m.thompson@example.com",    beds: 4 },
  { id: "d4", name: "Ashley Rivera",          town: "Summit",      budget: "$1.1M",  score: 7,  status: "contacted",      lastSeen: "3h ago",   note: "Needs 4+ beds",          phone: "(908) 555-0331", email: "ashley.r@example.com",      beds: 4 },
  { id: "d5", name: "David & Lisa Park",      town: "Westfield",   budget: "$720k",  score: 9,  status: "showing",        lastSeen: "1h ago",   note: "Showing Thurs 2pm",      phone: "(908) 555-0104", email: "parks@example.com",         beds: 3 },
  { id: "d6", name: "Tom Chen",               town: "Millburn",    budget: "$990k",  score: 8,  status: "showing",        lastSeen: "4h ago",   note: "2nd showing booked",     phone: "(973) 555-0518", email: "tchen@example.com",         beds: 4 },
  { id: "d7", name: "Sarah & Mike Rodriguez", town: "Hoboken",     budget: "$850k",  score: 10, status: "offer",          lastSeen: "20m ago",  note: "Offer at $832k ✓",       phone: "(201) 555-0490", email: "rodriguez@example.com",     beds: 3 },
  { id: "d8", name: "James O'Brien",          town: "Montclair",   budget: "$635k",  score: 9,  status: "under_contract", lastSeen: "2d ago",   note: "Closing June 15",        phone: "(973) 555-0612", email: "jamesob@example.com",       beds: 3 },
  { id: "d9", name: "The Nguyen Family",      town: "Glen Rock",   budget: "$760k",  score: 8,  status: "closed",         lastSeen: "1w ago",   note: "Closed $752k 🎉",        phone: "(201) 555-0775", email: "nguyens@example.com",       beds: 4 },
];

const INITIAL_DRAFTS: DemoDraft[] = [
  {
    id: "draft1",
    clientId: "d3",
    clientName: "Marcus Thompson",
    scenario: "Match ping · 14 Elm St, Ridgewood",
    body: "Hey Marcus — 14 Elm in Ridgewood just dropped to $869k. 4 bed, 2.5 bath, updated kitchen. Saw you viewed it 3x already. Want to grab a slot this weekend?",
    createdAt: "12m ago",
  },
  {
    id: "draft2",
    clientId: "d5",
    clientName: "David & Lisa Park",
    scenario: "Showing reminder · Thurs 2pm",
    body: "Hi David & Lisa — confirming 2pm Thursday at 22 Stoneleigh in Westfield. I'll meet you out front. Text me if anything changes!",
    createdAt: "38m ago",
  },
  {
    id: "draft3",
    clientId: "d1",
    clientName: "Jennifer Walsh",
    scenario: "Re-engage · no activity 48h",
    body: "Hey Jennifer — circling back. Three new 3-bed listings under $640k came on in Montclair this morning with decent yards. Want me to send the short list?",
    createdAt: "1h ago",
  },
  {
    id: "draft4",
    clientId: "d7",
    clientName: "Sarah & Mike Rodriguez",
    scenario: "Offer update",
    body: "Quick update — listing agent says seller is reviewing tonight and will respond in the morning. I'll ping you the second I hear. Hang tight!",
    createdAt: "2h ago",
  },
];

const COLS = [
  { id: "new",            label: "New" },
  { id: "contacted",      label: "Contacted" },
  { id: "showing",        label: "Showing" },
  { id: "offer",          label: "Offer" },
  { id: "under_contract", label: "Under Contract" },
  { id: "closed",         label: "Closed" },
] as const;

type TabId = "home" | "inbox" | "pipeline" | "clients";

function accentColor(score: number) {
  if (score >= 7) return "#3B82F6";
  if (score >= 4) return "#F59E0B";
  return "#374151";
}

function parseBudget(b: string): number {
  const num = parseFloat(b.replace(/[$k,M]/g, ""));
  const mult = b.includes("M") ? 1_000_000 : b.includes("k") ? 1_000 : 1;
  return num * mult;
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
      {c.note && <div className="mt-1.5 text-[10px] italic text-gray-600">{c.note}</div>}
      <div className="mt-2.5 border-t border-[#222] pt-2 text-right">
        <span className="text-[10px] text-gray-600">{c.lastSeen}</span>
      </div>
    </div>
  );
}

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
          boxShadow: isOver ? "0 0 0 1px #3B82F6" : "0 2px 8px rgba(0,0,0,0.3)",
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

function HomeView({
  clients,
  drafts,
  pipelineValue,
  onJumpToInbox,
  onJumpToPipeline,
}: {
  clients: DemoClient[];
  drafts: DemoDraft[];
  pipelineValue: number;
  onJumpToInbox: () => void;
  onJumpToPipeline: () => void;
}) {
  const hotLeads = clients.filter((c) => c.score >= 8 && c.status !== "closed");
  const activeClients = clients.filter((c) => c.status !== "closed").length;

  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-6">
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-widest text-blue-500">
          MONDAY · NJ
        </div>
        <h1 className="mt-1 text-[22px] font-semibold text-white">Morning briefing</h1>
      </div>

      <div
        className="mb-5 rounded-[14px] border border-[#1a1a1a] bg-[#0a0a0a] p-4"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
            Overnight · Auto
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-gray-300">
          <span className="font-semibold text-white">12 follow-ups</span> sent overnight.{" "}
          <span className="font-semibold text-amber-400">{hotLeads.length} hot leads</span> are ready to contact.{" "}
          <span className="font-semibold text-white">Sarah & Mike Rodriguez</span> submitted an offer at $832k — awaiting response.{" "}
          Aria has <span className="font-semibold text-blue-400">{drafts.length} AI drafts</span> waiting for your approval.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-[12px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="text-[10px] font-medium uppercase tracking-widest text-gray-600">
            Pipeline value
          </div>
          <div className="mt-2 text-[24px] font-semibold text-blue-400">
            ${(pipelineValue / 1_000_000).toFixed(1)}M
          </div>
          <div className="mt-0.5 text-[11px] text-gray-500">{activeClients} active</div>
        </div>
        <div className="rounded-[12px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="text-[10px] font-medium uppercase tracking-widest text-gray-600">
            Hot leads
          </div>
          <div className="mt-2 text-[24px] font-semibold text-amber-400">{hotLeads.length}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">score 8+</div>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Hot leads today
          </div>
          <button
            onClick={onJumpToPipeline}
            className="text-[11px] font-medium text-blue-400 hover:text-blue-300"
          >
            View pipeline →
          </button>
        </div>
        <div className="space-y-2">
          {hotLeads.slice(0, 4).map((c) => (
            <div
              key={c.id}
              className="rounded-[12px] border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold text-white">{c.name}</div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    {c.town} · {c.budget} · {c.beds} bed
                  </div>
                  <div className="mt-1 text-[11px] italic text-gray-600">{c.note}</div>
                </div>
                <LeadBadge score={c.score} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Drafts waiting
          </div>
          <button
            onClick={onJumpToInbox}
            className="text-[11px] font-medium text-blue-400 hover:text-blue-300"
          >
            Open inbox →
          </button>
        </div>
        <div className="rounded-[12px] border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="text-[13px] leading-relaxed text-gray-300">
            {drafts.length} texts drafted in your voice, ready to approve — including a match
            ping to <span className="font-semibold text-white">Marcus Thompson</span> for 14 Elm
            St.
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxView({
  drafts,
  setDrafts,
}: {
  drafts: DemoDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<DemoDraft[]>>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  function openEdit(d: DemoDraft) {
    setEditingId(d.id);
    setDraftBody(d.body);
  }

  function closeEdit() {
    setEditingId(null);
    setDraftBody("");
  }

  function approve() {
    if (!editingId) return;
    const d = drafts.find((x) => x.id === editingId);
    setDrafts((list) => list.filter((x) => x.id !== editingId));
    setFlash(d ? `Sent to ${d.clientName}` : "Sent");
    closeEdit();
    setTimeout(() => setFlash(null), 2200);
  }

  function dismiss() {
    if (!editingId) return;
    setDrafts((list) => list.filter((x) => x.id !== editingId));
    setFlash("Draft dismissed");
    closeEdit();
    setTimeout(() => setFlash(null), 1800);
  }

  const editing = drafts.find((d) => d.id === editingId) ?? null;

  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-6">
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-widest text-blue-500">
          AI DRAFTS
        </div>
        <h1 className="mt-1 text-[22px] font-semibold text-white">Inbox</h1>
        <p className="mt-0.5 text-[12px] text-gray-500">
          Tap a card to review and approve in your voice.
        </p>
      </div>

      {flash && (
        <div className="mb-4 rounded-[10px] border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-[12px] text-blue-300">
          {flash}
        </div>
      )}

      {drafts.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
          <div className="text-[14px] font-semibold text-white">Inbox zero</div>
          <p className="mt-1 text-[12px] text-gray-500">
            You&apos;re all caught up. Aria will draft more as new activity comes in.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {drafts.map((d) => (
            <button
              key={d.id}
              onClick={() => openEdit(d)}
              className="w-full rounded-[12px] border border-[#1a1a1a] bg-[#0a0a0a] p-4 text-left transition-colors hover:border-blue-500/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold text-white">{d.clientName}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-blue-400">
                    {d.scenario}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] text-gray-600">{d.createdAt}</span>
              </div>
              <div className="mt-2 rounded-[8px] border border-[#1a1a1a] bg-[#050505] px-3 py-2 text-[12px] italic leading-relaxed text-gray-300">
                &ldquo;{d.body}&rdquo;
              </div>
              <div className="mt-2 text-[10px] font-medium text-blue-400">
                Tap to edit & approve →
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center"
          onClick={closeEdit}
        >
          <div
            className="w-full max-w-lg rounded-t-[18px] border border-[#1a1a1a] bg-[#0a0a0a] p-5 sm:rounded-[18px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-[10px] uppercase tracking-wider text-blue-400">
              {editing.scenario}
            </div>
            <div className="text-[15px] font-semibold text-white">{editing.clientName}</div>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={5}
              className="mt-3 w-full rounded-[10px] border border-[#1a1a1a] bg-[#050505] p-3 text-[13px] leading-relaxed text-gray-200 outline-none focus:border-blue-500"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={approve}
                className="flex-1 rounded-[10px] bg-blue-500 px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-600"
              >
                Approve & Send
              </button>
              <button
                onClick={dismiss}
                className="rounded-[10px] border border-[#222] bg-transparent px-4 py-2.5 text-[13px] font-medium text-gray-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
            <button
              onClick={closeEdit}
              className="mt-3 w-full text-center text-[11px] text-gray-600 hover:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineView({
  clients,
  setClients,
}: {
  clients: DemoClient[];
  setClients: React.Dispatch<React.SetStateAction<DemoClient[]>>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

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
    .filter((c) => c.status !== "closed")
    .reduce((sum, c) => sum + parseBudget(c.budget), 0);

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

  return (
    <div className="mx-auto max-w-[calc(228px*6+20px*5+32px)] px-4 pb-10 pt-6">
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
            ${(pipelineValue / 1_000_000).toFixed(1)}M
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-3 [scroll-padding-left:1rem] sm:snap-none">
          {COLS.map((col) => (
            <DroppableColumn key={col.id} col={col} clients={grouped[col.id]} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function ClientsView({ clients }: { clients: DemoClient[] }) {
  const sorted = [...clients].sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-blue-500">
            ACTIVE BOOK
          </div>
          <h1 className="mt-1 text-[22px] font-semibold text-white">Clients</h1>
        </div>
        <span className="text-[11px] text-gray-500">{clients.length} total</span>
      </div>

      <div className="space-y-2">
        {sorted.map((c) => (
          <div
            key={c.id}
            className="rounded-[12px] border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-[13px] font-semibold text-white">{c.name}</div>
                  <LeadBadge score={c.score} />
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {c.town} · {c.budget} · {c.beds} bed · {c.phone}
                </div>
                <div className="mt-1 truncate text-[11px] text-gray-600">{c.email}</div>
                <div className="mt-1 text-[11px] italic text-gray-600">{c.note}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-gray-600">
                  {c.status.replace(/_/g, " ")}
                </div>
                <div className="mt-0.5 text-[10px] text-gray-600">{c.lastSeen}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-[64px] flex-col items-center gap-[6px] pb-1 transition-opacity"
      style={{ opacity: active ? 1 : 0.45 }}
      aria-pressed={active}
    >
      <span className={active ? "text-accent-blue" : "text-text-dim"}>{children}</span>
      <span
        className={`text-[9px] ${active ? "text-accent-blue" : "text-text-dim"}`}
      >
        {label}
      </span>
    </button>
  );
}

export default function DemoPage() {
  const [tab, setTab] = useState<TabId>("home");
  const [clients, setClients] = useState<DemoClient[]>(INITIAL_CLIENTS);
  const [drafts, setDrafts] = useState<DemoDraft[]>(INITIAL_DRAFTS);

  const pipelineValue = clients
    .filter((c) => c.status !== "closed")
    .reduce((sum, c) => sum + parseBudget(c.budget), 0);

  return (
    <>
      {tab === "home" && (
        <HomeView
          clients={clients}
          drafts={drafts}
          pipelineValue={pipelineValue}
          onJumpToInbox={() => setTab("inbox")}
          onJumpToPipeline={() => setTab("pipeline")}
        />
      )}
      {tab === "inbox" && <InboxView drafts={drafts} setDrafts={setDrafts} />}
      {tab === "pipeline" && <PipelineView clients={clients} setClients={setClients} />}
      {tab === "clients" && <ClientsView clients={clients} />}

      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border-card bg-bg-primary">
        <div className="mx-auto flex h-full max-w-lg items-end justify-between px-2 pb-1 pt-1">
          <TabButton active={tab === "home"} onClick={() => setTab("home")} label="Home">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </TabButton>
          <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")} label="Inbox">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </TabButton>
          <div className="relative flex w-[72px] flex-col items-center">
            <div
              className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#1D4ED8] text-white opacity-60"
              style={{ boxShadow: "0 0 0 8px rgba(59,130,246,0.15)" }}
              aria-hidden="true"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M12 2 L14.5 9 L22 9 L16 14 L18.5 22 L12 17.5 L5.5 22 L8 14 L2 9 L9.5 9 Z" />
              </svg>
            </div>
          </div>
          <TabButton
            active={tab === "pipeline"}
            onClick={() => setTab("pipeline")}
            label="Pipeline"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </TabButton>
          <TabButton
            active={tab === "clients"}
            onClick={() => setTab("clients")}
            label="Clients"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </TabButton>
        </div>
      </nav>
    </>
  );
}
