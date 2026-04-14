"use client";

import type { MlsListingPayload } from "@/app/api/mls/listings/route";
import { ActivityItem } from "@/components/ActivityItem";
import { FileRow } from "@/components/FileRow";
import { TaskItem } from "@/components/TaskItem";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { isPast, parseISO } from "date-fns";

const tabs = [
  "Overview",
  "Activity",
  "Files",
  "Tasks",
  "Showings",
  "Properties",
] as const;

export function ClientDetail({
  client,
  activities,
  tasks,
  files,
  showings,
  matches,
}: {
  client: Record<string, unknown>;
  activities: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  files: Record<string, unknown>[];
  showings: Record<string, unknown>[];
  matches: Record<string, unknown>[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [notes, setNotes] = useState(String(client.notes ?? ""));
  const [lead, setLead] = useState(Number(client.lead_score ?? 0));
  const [catchUp, setCatchUp] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showForm, setShowForm] = useState({
    address: "",
    showing_date: "",
    feedback: "",
  });
  const [mlsHits, setMlsHits] = useState<MlsListingPayload[]>([]);
  const [mlsLoading, setMlsLoading] = useState(false);
  const [mlsSearched, setMlsSearched] = useState(false);

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const portalUrl = `${site}/portal/${client.portal_token as string}`;

  const enriched = client.enriched_data as Record<string, string> | null;

  async function saveNotes() {
    await supabase
      .from("clients")
      .update({ notes })
      .eq("id", client.id as string);
    toast.toast("Saved", "success");
  }

  async function setScore(n: number) {
    setLead(n);
    await supabase
      .from("clients")
      .update({ lead_score: n })
      .eq("id", client.id as string);
  }

  async function enrich() {
    await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id,
        clientName: client.name,
        email: client.email,
      }),
    });
    toast.toast("Enrichment saved", "success");
    router.refresh();
  }

  async function aiCatchUp() {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: `Give a 2-3 sentence catch-up summary for client ${client.name}.`,
        context: JSON.stringify(client),
      }),
    });
    const data = await res.json();
    setCatchUp(String(data.reply ?? ""));
  }

  async function addNote() {
    await supabase.from("activities").insert({
      client_id: client.id as string,
      agent_id: client.agent_id as string,
      type: "note",
      body: "Manual note added",
    });
    router.refresh();
  }

  async function searchMlsForClient() {
    setMlsLoading(true);
    const params = new URLSearchParams();
    params.set("state", "NJ");
    const town = client.town as string | null;
    const budgetMin = client.budget_min as number | null;
    const budgetMax = client.budget_max as number | null;
    const bedsW = client.beds_wanted as number | null;
    if (town) params.set("city", town);
    if (budgetMin != null && budgetMin > 0) {
      params.set("minPrice", String(budgetMin));
    }
    if (budgetMax != null && budgetMax > 0) {
      params.set("maxPrice", String(budgetMax));
    }
    if (bedsW != null) params.set("minBeds", String(bedsW));
    params.set("limit", "20");
    try {
      const res = await fetch(`/api/mls/listings?${params}`);
      const data = (await res.json()) as {
        error?: string;
        listings?: MlsListingPayload[];
      };
      if (!res.ok) {
        toast.toast(data.error ?? "MLS search failed", "warn");
        setMlsHits([]);
        return;
      }
      setMlsHits(data.listings ?? []);
    } catch {
      toast.toast("Network error loading MLS.", "warn");
      setMlsHits([]);
    } finally {
      setMlsLoading(false);
      setMlsSearched(true);
    }
  }

  const overdue = useCallback((ts: Record<string, unknown>): boolean => {
    if (!ts.due_at || ts.done) return false;
    try {
      return isPast(parseISO(String(ts.due_at)));
    } catch {
      return false;
    }
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/clients" aria-label="Back">
          <ArrowLeft className="text-text-dim" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-medium text-text-primary">
            {String(client.name)}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-[8px] bg-[rgba(59,130,246,0.15)] px-2 py-0.5 text-[10px] font-medium text-accent-blue">
              {String(client.source ?? "manual")}
            </span>
            <span className="rounded-[8px] bg-bg-deep px-2 py-0.5 text-[10px] font-medium text-text-dim">
              {String(client.status ?? "new").replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="text-[11px] text-text-dim">Lead score</div>
        <div className="flex gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setScore(i + 1)}
              className={`h-3 w-3 rounded-full ${
                i < lead ? "bg-accent-blue" : "bg-bg-deep"
              }`}
              aria-label={`Score ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium ${
              tab === t
                ? "border-accent-blue text-accent-blue"
                : "border-border-card text-text-dim"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="mt-4 space-y-3 text-[13px]">
          <div className="rounded-[14px] border border-border-card bg-bg-card p-4">
            <div className="text-text-muted">
              Budget: {fmtMoney(client.budget_min as number | null)} –{" "}
              {fmtMoney(client.budget_max as number | null)}
            </div>
            <div className="mt-1 text-text-muted">Town: {String(client.town ?? "—")}</div>
            <div className="mt-1 text-text-muted">
              Beds/baths wanted: {String(client.beds_wanted ?? "—")} /{" "}
              {String(client.baths_wanted ?? "—")}
            </div>
            <div className="mt-2">
              <a className="text-accent-blue" href={`tel:${client.phone ?? ""}`}>
                {String(client.phone ?? "Add phone")}
              </a>
            </div>
            <div className="mt-1">
              <a
                className="text-accent-blue"
                href={`mailto:${client.email ?? ""}`}
              >
                {String(client.email ?? "Add email")}
              </a>
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Notes (auto-save)"
            className="min-h-[100px] w-full rounded-[12px] border border-border-card bg-bg-deep p-3 text-[13px]"
          />
          <button
            type="button"
            onClick={enrich}
            className="rounded-[8px] bg-accent-blue px-3 py-2 text-[13px] font-medium text-white"
          >
            Enrich Contact
          </button>
          {enriched ? (
            <div className="rounded-[14px] border border-border-card bg-bg-card p-3 text-[12px] text-text-secondary">
              <div>{enriched.job_title}</div>
              <div className="text-text-dim">{enriched.company}</div>
              <div className="mt-2 text-text-muted">{enriched.notes}</div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(portalUrl);
                toast.toast("Portal link copied", "success");
              }}
              className="rounded-[8px] border border-border-card bg-bg-card px-3 py-2 text-[12px] text-accent-blue"
            >
              Copy portal link
            </button>
            <Link
              href={`/cma?seller=${encodeURIComponent(String(client.name))}`}
              className="rounded-[8px] border border-border-card bg-bg-card px-3 py-2 text-[12px] text-accent-blue"
            >
              Generate Pitch Deck
            </Link>
          </div>
          <button
            type="button"
            onClick={aiCatchUp}
            className="w-full rounded-[12px] border border-border-card bg-bg-deep px-3 py-3 text-left text-[13px] text-text-secondary"
          >
            AI Catch-up
          </button>
          {catchUp ? <p className="text-[13px] text-text-secondary">{catchUp}</p> : null}
        </div>
      ) : null}

      {tab === "Activity" ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addNote}
              className="rounded-[8px] bg-accent-blue px-3 py-2 text-[12px] text-white"
            >
              Add note
            </button>
            <button
              type="button"
              onClick={() => setTab("Showings")}
              className="rounded-[8px] border border-border-card px-3 py-2 text-[12px] text-accent-blue"
            >
              Log showing
            </button>
          </div>
          {activities.map((a) => (
            <ActivityItem
              key={String(a.id)}
              id={String(a.id)}
              type={String(a.type)}
              body={a.body as string | null}
              created_at={String(a.created_at)}
              clientName={String(client.name)}
              ai_draft={!!a.ai_draft}
              approved={!!a.approved}
              sent={!!a.sent}
              clientId={String(client.id)}
              clientPhone={client.phone as string | null}
              onApproved={() => router.refresh()}
            />
          ))}
        </div>
      ) : null}

      {tab === "Files" ? (
        <FilesTab
          clientId={String(client.id)}
          agentId={String(client.agent_id)}
          files={files}
        />
      ) : null}

      {tab === "Tasks" ? (
        <TasksTab clientId={String(client.id)} tasks={tasks} overdue={overdue} />
      ) : null}

      {tab === "Showings" ? (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white"
          >
            Log showing
          </button>
          {showings.map((s) => (
            <div
              key={String(s.id)}
              className="rounded-[14px] border border-border-card bg-bg-card p-3 text-[13px]"
            >
              <div className="font-medium">{String(s.address)}</div>
              <div className="text-[12px] text-text-dim">{String(s.showing_date)}</div>
              <div className="mt-2 text-text-secondary">{String(s.ai_summary ?? "")}</div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "Properties" ? (
        <div className="mt-4 space-y-3">
          <p className="text-[12px] text-text-dim">
            Search uses this client&apos;s town, budget, and beds vs live SimplyRETS
            NJ listings.
          </p>
          <button
            type="button"
            onClick={searchMlsForClient}
            disabled={mlsLoading}
            className="w-full rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white disabled:opacity-60"
          >
            {mlsLoading ? "Searching…" : "Search MLS for Matches"}
          </button>
          {!mlsLoading && mlsHits.length === 0 && !mlsSearched ? (
            <p className="text-center text-[12px] text-text-dim">
              Run a search to see listings that fit this client.
            </p>
          ) : null}
          {!mlsLoading && mlsSearched && mlsHits.length === 0 ? (
            <p className="text-center text-[12px] text-text-dim">
              No listings matched these criteria in the current feed.
            </p>
          ) : null}
          {mlsHits.map((l) => {
            const photo = l.photos?.[0];
            return (
            <div
              key={l.id}
              className="rounded-[14px] border border-border-card bg-bg-card p-3"
            >
              <div className="mb-2 h-32 w-full overflow-hidden rounded-[10px] bg-bg-deep">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-text-dim">
                    No photo
                  </div>
                )}
              </div>
              <div className="text-[14px] font-medium text-text-primary">
                {l.address}
              </div>
              <div className="text-[11px] text-text-dim">
                {l.city} · MLS {l.mlsNumber}
              </div>
              <div className="mt-1 text-[13px] text-accent-blue">
                {fmtMoney(l.price)}
              </div>
              <div className="mt-2 text-[12px] text-text-muted">
                {l.beds} bd · {l.baths} ba ·{" "}
                {l.sqft ? l.sqft.toLocaleString() : "—"} sqft
              </div>
              <button
                type="button"
                className="mt-2 rounded-[8px] border border-border-card px-3 py-2 text-[12px] text-accent-blue"
                onClick={async () => {
                  await fetch("/api/ai/draft-text", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      clientId: client.id,
                      clientName: client.name,
                      propertyContext: `${l.address} in ${l.city} at ${fmtMoney(l.price)}`,
                      skipInsert: false,
                    }),
                  });
                  toast.toast("Draft created — review in Inbox", "success");
                }}
              >
                AI Text About This
              </button>
            </div>
            );
          })}
          {matches.map((m) => {
            const p = m.properties as Record<string, unknown> | null;
            return (
              <div
                key={String(m.id)}
                className="rounded-[14px] border border-border-card bg-bg-card p-3"
              >
                <div className="text-[14px] font-medium">
                  {String(p?.address ?? "Property")}
                </div>
                <div className="text-[13px] text-accent-blue">
                  ${Number(p?.price ?? 0).toLocaleString()}
                </div>
                <div className="mt-2 text-[12px] text-text-muted">
                  Score {String(m.match_score ?? 0)}
                </div>
                <button
                  type="button"
                  className="mt-2 rounded-[8px] border border-border-card px-3 py-2 text-[12px] text-accent-blue"
                  onClick={async () => {
                    await fetch("/api/ai/draft-text", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        clientId: client.id,
                        clientName: client.name,
                        propertyContext: `${p?.address} at $${p?.price}`,
                        skipInsert: false,
                      }),
                    });
                    toast.toast("Draft created — review in Inbox", "success");
                  }}
                >
                  AI Text About This Property
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {showModal ? (
        <ShowingModal
          clientId={String(client.id)}
          agentId={String(client.agent_id)}
          form={showForm}
          setForm={setShowForm}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function TasksTab({
  clientId,
  tasks,
  overdue,
}: {
  clientId: string;
  tasks: Record<string, unknown>[];
  overdue: (t: Record<string, unknown>) => boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  async function addTask() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tasks").insert({
      client_id: clientId,
      agent_id: user.id,
      title,
      due_at: due ? new Date(due).toISOString() : null,
    });
    setTitle("");
    setDue("");
    router.refresh();
  }

  async function aiTasks() {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Suggest 3 tasks for this client for the next 7 days as a bullet list.",
        context: JSON.stringify({ clientId }),
      }),
    });
    const data = await res.json();
    toast.toast(String(data.reply ?? "").slice(0, 120), "success");
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="flex-1 rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="w-[160px] rounded-[8px] border border-border-card bg-bg-deep px-2 py-2 text-[12px]"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={addTask}
          className="rounded-[8px] bg-accent-blue px-3 py-2 text-[12px] text-white"
        >
          Add task
        </button>
        <button
          type="button"
          onClick={aiTasks}
          className="rounded-[8px] border border-border-card px-3 py-2 text-[12px] text-accent-blue"
        >
          AI Generate Tasks
        </button>
      </div>
      {tasks.map((t) => (
        <TaskItem
          key={String(t.id)}
          id={String(t.id)}
          title={String(t.title)}
          due_at={t.due_at as string | null}
          done={!!t.done}
          overdue={overdue(t)}
        />
      ))}
    </div>
  );
}

function FilesTab({
  clientId,
  agentId,
  files,
}: {
  clientId: string;
  agentId: string;
  files: Record<string, unknown>[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${agentId}/${clientId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("files").upload(path, file);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    const { data: pub } = supabase.storage.from("files").getPublicUrl(path);
    await supabase.from("files").insert({
      client_id: clientId,
      agent_id: agentId,
      name: file.name,
      storage_path: path,
      public_url: pub.publicUrl,
      file_type: "other",
    });
    toast.toast("Uploaded", "success");
    router.refresh();
  }

  async function extract() {
    const res = await fetch("/api/ai/extract-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "contract.pdf", fileType: "contract" }),
    });
    const dates = await res.json();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    for (const [key, val] of Object.entries(dates as Record<string, string>)) {
      if (!val) continue;
      await supabase.from("tasks").insert({
        client_id: clientId,
        agent_id: user.id,
        title: `${key.replace(/_/g, " ")}`,
        due_at: val,
        ai_generated: true,
      });
    }
    toast.toast("Milestone tasks created", "success");
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-3">
      <label className="inline-block rounded-[8px] bg-accent-blue px-3 py-2 text-[12px] font-medium text-white">
        Upload
        <input type="file" className="hidden" onChange={upload} />
      </label>
      <button
        type="button"
        onClick={extract}
        className="ml-2 rounded-[8px] border border-border-card px-3 py-2 text-[12px] text-accent-blue"
      >
        Extract contract dates
      </button>
      {files.map((f) => (
        <FileRow
          key={String(f.id)}
          name={f.name as string | null}
          file_type={f.file_type as string | null}
          created_at={String(f.created_at)}
        />
      ))}
    </div>
  );
}

function ShowingModal({
  clientId,
  agentId,
  form,
  setForm,
  onClose,
  onSaved,
}: {
  clientId: string;
  agentId: string;
  form: { address: string; showing_date: string; feedback: string };
  setForm: (f: typeof form) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const toast = useToast();

  async function save() {
    const res = await fetch("/api/ai/showing-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: form.address,
        clientName: "Client",
        feedback: form.feedback,
      }),
    });
    const summary = await res.json();

    await supabase.from("showings").insert({
      client_id: clientId,
      agent_id: agentId,
      address: form.address,
      showing_date: form.showing_date
        ? new Date(form.showing_date).toISOString()
        : null,
      client_feedback: form.feedback,
      ai_summary: summary.summary,
      next_action: summary.next_action,
    });

    const delta = Number(summary.lead_score_change ?? 0);
    if (delta) {
      const { data: c } = await supabase
        .from("clients")
        .select("lead_score")
        .eq("id", clientId)
        .single();
      const next = Math.min(
        10,
        Math.max(0, (c?.lead_score ?? 0) + delta),
      );
      await supabase.from("clients").update({ lead_score: next }).eq("id", clientId);
    }

    await supabase.from("tasks").insert({
      client_id: clientId,
      agent_id: agentId,
      title: `Follow up: ${summary.next_action ?? "Next steps"}`,
      due_at: new Date(Date.now() + 86400000).toISOString(),
      ai_generated: true,
    });

    toast.toast("Showing saved", "success");
    onSaved();
  }

  function startVoice() {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult: (ev: {
          results: ArrayLike<{ 0: { transcript: string } }>;
        }) => void;
        start: () => void;
      };
    };
    const SR = w.webkitSpeechRecognition;
    if (!SR) {
      toast.toast("Speech recognition not supported", "warn");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      const text = ev.results[0][0].transcript;
      setForm({ ...form, feedback: (form.feedback + " " + text).trim() });
    };
    rec.start();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-[14px] border border-border-card bg-bg-card p-4">
        <div className="text-[16px] font-medium">Log showing</div>
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Address"
          className="mt-3 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <input
          type="datetime-local"
          value={form.showing_date}
          onChange={(e) => setForm({ ...form, showing_date: e.target.value })}
          className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <textarea
          value={form.feedback}
          onChange={(e) => setForm({ ...form, feedback: e.target.value })}
          placeholder="Feedback"
          className="mt-2 min-h-[90px] w-full rounded-[8px] border border-border-card bg-bg-deep p-3 text-[13px]"
        />
        <button
          type="button"
          onClick={startVoice}
          className="mt-2 rounded-[8px] border border-border-card px-3 py-2 text-[12px] text-text-dim"
        >
          Voice memo
        </button>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-[8px] bg-accent-blue py-2 text-[13px] text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-border-card px-3 py-2 text-[13px] text-text-dim"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
