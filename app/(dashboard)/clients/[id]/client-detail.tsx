"use client";

import { ActivityItem } from "@/components/ActivityItem";
import { FileRow } from "@/components/FileRow";
import { TaskItem } from "@/components/TaskItem";
import { useToast } from "@/components/ToastProvider";
import type { MlsListingPayload } from "@/lib/simplyrets";
import { NJ_TOWN_OPTIONS } from "@/lib/nj-towns";
import { createClient } from "@/lib/supabase/client";
import { fmtMoney, formatPhoneE164 } from "@/lib/utils";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
  mlsLive = [],
}: {
  client: Record<string, unknown>;
  activities: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  files: Record<string, unknown>[];
  showings: Record<string, unknown>[];
  matches: Record<string, unknown>[];
  mlsLive?: MlsListingPayload[];
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
  const [mlsHits, setMlsHits] = useState<MlsListingPayload[]>(mlsLive);
  const [mlsLoading, setMlsLoading] = useState(false);
  const [mlsSearched, setMlsSearched] = useState(mlsLive.length > 0);
  const [editOpen, setEditOpen] = useState(false);
  const townList = String(client.town ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const [edit, setEdit] = useState({
    name: String(client.name ?? ""),
    phone: String(client.phone ?? ""),
    email: String(client.email ?? ""),
    budget_min: client.budget_min != null ? String(client.budget_min) : "",
    budget_max: client.budget_max != null ? String(client.budget_max) : "",
    towns: townList.length ? townList : ([] as string[]),
    beds: client.beds_wanted != null ? String(client.beds_wanted) : "",
    baths: client.baths_wanted != null ? String(client.baths_wanted) : "",
    client_role:
      (client.client_role as string) === "seller" ? "seller" : "buyer",
    notes: String(client.notes ?? ""),
    status: String(client.status ?? "new"),
  });

  useEffect(() => {
    setMlsHits(mlsLive);
    setMlsSearched(mlsLive.length > 0);
  }, [client.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function toggleTownEdit(t: string) {
    setEdit((e) => ({
      ...e,
      towns: e.towns.includes(t)
        ? e.towns.filter((x) => x !== t)
        : [...e.towns, t],
    }));
  }

  async function saveClientEdit() {
    const phoneE164 = edit.phone.trim() ? formatPhoneE164(edit.phone) : null;
    if (edit.phone.trim() && !phoneE164) {
      toast.toast("Invalid phone", "warn");
      return;
    }
    const { error } = await supabase
      .from("clients")
      .update({
        name: edit.name.trim(),
        phone: phoneE164,
        email: edit.email.trim() || null,
        budget_min: edit.budget_min ? Number(edit.budget_min) : null,
        budget_max: edit.budget_max ? Number(edit.budget_max) : null,
        town: edit.towns.length ? edit.towns.join(", ") : null,
        beds_wanted: edit.beds ? Number(edit.beds) : null,
        baths_wanted: edit.baths ? Number(edit.baths) : null,
        notes: edit.notes.trim() || null,
        client_role: edit.client_role,
        status: edit.status,
      })
      .eq("id", client.id as string);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    toast.toast("Saved", "success");
    setEditOpen(false);
    router.refresh();
  }

  async function searchMlsForClient() {
    setMlsLoading(true);
    const params = new URLSearchParams();
    params.set("state", "NJ");
    const town =
      (client.town as string | null)?.split(",")[0]?.trim() ?? null;
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
            <span className="rounded-[8px] bg-bg-deep px-2 py-0.5 text-[10px] font-medium text-text-dim">
              {(client.client_role as string) === "seller" ? "Seller" : "Buyer"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded-full border border-border-card p-2 text-text-dim hover:text-accent-blue"
          aria-label="Edit client"
        >
          <Pencil size={18} />
        </button>
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/ai/draft-text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clientId: client.id,
                clientName: client.name,
                scenario: "Friendly check-in",
              }),
            });
            toast.toast("Draft in Inbox", "success");
            router.push("/inbox");
          }}
          className="rounded-[8px] bg-accent-blue px-3 py-2 text-[12px] font-medium text-white"
        >
          AI text
        </button>
        <button
          type="button"
          onClick={async () => {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from("activities").insert({
              client_id: client.id as string,
              agent_id: user.id,
              type: "call",
              body: "Call logged",
              ai_draft: false,
              approved: true,
              sent: false,
            });
            toast.toast("Call logged", "success");
            router.refresh();
          }}
          className="rounded-[8px] border border-border-card px-3 py-2 text-[12px] text-text-primary"
        >
          Log call
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("Showings");
            setShowModal(true);
          }}
          className="rounded-[8px] border border-border-card px-3 py-2 text-[12px] text-accent-blue"
        >
          Schedule showing
        </button>
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
            Listings from SimplyRETS using this client&apos;s town, budget, and beds.
          </p>
          <button
            type="button"
            onClick={searchMlsForClient}
            disabled={mlsLoading}
            className="w-full rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white disabled:opacity-60"
          >
            {mlsLoading ? "Searching…" : "Refresh MLS search"}
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
                      matchPing: true,
                      propertyContext: `${l.beds} bed / ${l.baths} bath at ${l.address}, ${l.city} — ${fmtMoney(l.price)}`,
                      skipInsert: false,
                    }),
                  });
                  toast.toast("Draft created — review in Inbox", "success");
                }}
              >
                AI Text Client
              </button>
            </div>
            );
          })}
          {matches.map((m) => {
            const p = m.properties as Record<string, unknown> | null;
            const photosRaw = p?.photos as unknown;
            const photo =
              Array.isArray(photosRaw) && photosRaw[0]
                ? String(photosRaw[0])
                : null;
            const beds = p?.beds != null ? Number(p.beds) : null;
            const baths = p?.baths != null ? Number(p.baths) : null;
            return (
              <div
                key={String(m.id)}
                className="rounded-[14px] border border-border-card bg-bg-card p-3"
              >
                {photo ? (
                  <div className="mb-2 h-32 w-full overflow-hidden rounded-[10px] bg-bg-deep">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="text-[14px] font-medium">
                  {String(p?.address ?? "Property")}
                </div>
                <div className="text-[13px] text-accent-blue">
                  {fmtMoney(Number(p?.price ?? 0) || null)}
                </div>
                <div className="mt-2 text-[12px] text-text-muted">
                  {beds != null ? `${beds} bd` : ""}
                  {baths != null ? ` · ${baths} ba` : ""} · Score{" "}
                  {String(m.match_score ?? 0)}
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
                        matchPing: true,
                        propertyContext: `${beds ?? "?"} bed / ${baths ?? "?"} bath at ${String(p?.address)} — ${fmtMoney(Number(p?.price ?? 0) || null)}`,
                        skipInsert: false,
                      }),
                    });
                    toast.toast("Draft created — review in Inbox", "success");
                  }}
                >
                  AI Text Client
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[14px] border border-border-card bg-bg-card p-4">
            <div className="text-[16px] font-medium text-text-primary">
              Edit client
            </div>
            <div className="mt-3 space-y-2">
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                placeholder="Name"
              />
              <input
                value={edit.phone}
                onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                placeholder="Phone"
              />
              <input
                value={edit.email}
                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                placeholder="Email"
              />
              <div className="flex gap-2">
                <input
                  value={edit.budget_min}
                  onChange={(e) =>
                    setEdit({ ...edit, budget_min: e.target.value })
                  }
                  className="w-1/2 rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                  placeholder="Budget min"
                  inputMode="numeric"
                />
                <input
                  value={edit.budget_max}
                  onChange={(e) =>
                    setEdit({ ...edit, budget_max: e.target.value })
                  }
                  className="w-1/2 rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                  placeholder="Budget max"
                  inputMode="numeric"
                />
              </div>
              <div className="text-[11px] text-text-dim">Preferred towns</div>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {NJ_TOWN_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTownEdit(t)}
                    className={`rounded-full border px-2 py-1 text-[10px] font-medium ${
                      edit.towns.includes(t)
                        ? "border-accent-blue bg-accent-blue/15 text-accent-blue"
                        : "border-border-card text-text-dim"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={edit.beds}
                  onChange={(e) => setEdit({ ...edit, beds: e.target.value })}
                  className="w-1/2 rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                  placeholder="Beds"
                  inputMode="numeric"
                />
                <input
                  value={edit.baths}
                  onChange={(e) => setEdit({ ...edit, baths: e.target.value })}
                  className="w-1/2 rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                  placeholder="Baths"
                  inputMode="decimal"
                />
              </div>
              <div className="flex gap-2">
                {(["buyer", "seller"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEdit({ ...edit, client_role: r })}
                    className={`flex-1 rounded-[8px] border py-2 text-[12px] capitalize ${
                      edit.client_role === r
                        ? "border-accent-blue text-accent-blue"
                        : "border-border-card text-text-dim"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <select
                value={edit.status}
                onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              >
                {[
                  "new",
                  "contacted",
                  "showing",
                  "offer",
                  "under_contract",
                  "closed",
                  "dead",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
              <textarea
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                className="min-h-[80px] w-full rounded-[8px] border border-border-card bg-bg-deep p-3 text-[13px]"
                placeholder="Notes"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void saveClientEdit()}
                className="flex-1 rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-[8px] border border-border-card px-3 py-2 text-[13px] text-text-dim"
              >
                Cancel
              </button>
            </div>
          </div>
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
