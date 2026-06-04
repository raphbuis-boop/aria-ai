"use client";

import { CardMenu } from "@/components/CardMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  EditShowingModal,
  type EditShowingRecord,
} from "@/components/EditShowingModal";
import { ShowingCard } from "@/components/ShowingCard";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isFuture, parseISO } from "date-fns";

const INPUT_STYLE = {
  background: "rgba(255,255,255,0.06)",
  border: "0.5px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      className="mb-2 text-[11px] font-semibold uppercase"
      style={{ color: "#6B7280", letterSpacing: "0.08em" }}
    >
      {label}
    </p>
  );
}

export function ShowingsClient({
  initial,
  signedClientIds,
}: {
  initial: Record<string, unknown>[];
  signedClientIds: string[];
}) {
  const signedSet = useMemo(() => new Set(signedClientIds), [signedClientIds]);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [editShowing, setEditShowing] = useState<EditShowingRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; address: string } | null>(null);
  const [form, setForm] = useState({
    client_id: "",
    address: "",
    showing_date: "",
    status: "scheduled" as "scheduled" | "completed" | "cancelled",
    notes: "",
    feedback: "",
  });

  const { upcoming, past } = useMemo(() => {
    const u: typeof initial = [];
    const p: typeof initial = [];
    for (const s of initial) {
      const iso = s.showing_date as string | null;
      if (!iso) { p.push(s); continue; }
      try {
        if (isFuture(parseISO(iso))) u.push(s);
        else p.push(s);
      } catch { p.push(s); }
    }
    u.sort((a, b) => String(a.showing_date ?? "").localeCompare(String(b.showing_date ?? "")));
    p.sort((a, b) => String(b.showing_date ?? "").localeCompare(String(a.showing_date ?? "")));
    return { upcoming: u, past: p };
  }, [initial]);

  async function openModal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("clients").select("id, name").eq("agent_id", user.id);
    setClients((data as { id: string; name: string }[]) ?? []);
    setOpen(true);
  }

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const addr = searchParams.get("address");
    if (addr) {
      try { setForm((f) => ({ ...f, address: decodeURIComponent(addr) })); }
      catch { setForm((f) => ({ ...f, address: addr })); }
    }
    void openModal();
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    url.searchParams.delete("address");
    window.history.replaceState({}, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function archiveShowing(id: string, label: string) {
    const { error } = await supabase.from("showings").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.toast(error.message, "warn"); return; }
    toast.toast(`Showing at ${label} cancelled`, "success");
    router.refresh();
  }

  async function deleteShowing(id: string, label: string) {
    const { error } = await supabase.from("showings").delete().eq("id", id);
    if (error) { toast.toast(error.message, "warn"); return; }
    toast.toast(`Showing at ${label} deleted`, "success");
    setConfirmDelete(null);
    router.refresh();
  }

  async function save() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!form.client_id || !form.address.trim()) {
      toast.toast("Client and address are required", "warn");
      return;
    }
    const res = await fetch("/api/ai/showing-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: form.address, clientName: "Client", feedback: form.feedback }),
    });
    const summary = await res.json();
    const row: Record<string, unknown> = {
      client_id: form.client_id,
      agent_id: user.id,
      address: form.address,
      showing_date: form.showing_date ? new Date(form.showing_date).toISOString() : null,
      client_feedback: form.feedback,
      ai_summary: summary.summary,
      next_action: summary.next_action,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const { error } = await supabase.from("showings").insert(row);
    if (error) { toast.toast(error.message, "warn"); return; }
    const delta = Number(summary.lead_score_change ?? 0);
    if (delta && form.client_id) {
      const { data: c } = await supabase.from("clients").select("lead_score").eq("id", form.client_id).single();
      const next = Math.min(10, Math.max(0, (c?.lead_score ?? 0) + delta));
      await supabase.from("clients").update({ lead_score: next }).eq("id", form.client_id);
    }
    await supabase.from("tasks").insert({
      client_id: form.client_id,
      agent_id: user.id,
      title: `Showing follow-up: ${summary.next_action ?? "Next step"}`,
      due_at: new Date(Date.now() + 86400000).toISOString(),
      ai_generated: true,
    });
    toast.toast("Showing saved", "success");
    setOpen(false);
    setForm({ client_id: "", address: "", showing_date: "", status: "scheduled", notes: "", feedback: "" });
    router.refresh();
  }

  return (
    <div
      className="min-h-[100dvh] pb-[130px]"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.10), transparent),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167,139,250,0.06), transparent),
          #000000
        `,
        color: "#ffffff",
      }}
    >
      <div className="px-5 pt-6">

        {/* ── Header ── */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1
              className="text-[26px] font-semibold leading-tight"
              style={{ color: "#ffffff", letterSpacing: "-0.025em" }}
            >
              Timeline
            </h1>
            <p className="mt-0.5 text-[12px]" style={{ color: "#6B7280" }}>
              {upcoming.length > 0 ? `${upcoming.length} upcoming` : "No upcoming showings"}
            </p>
          </div>
          <button
            type="button"
            onClick={openModal}
            className="text-[13px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
            style={{ background: "#3B82F6", padding: "8px 16px", borderRadius: 8 }}
          >
            + Add
          </button>
        </div>

        {/* ── Upcoming ── */}
        <SectionLabel label="Upcoming" />
        <div className="space-y-2.5 mb-7">
          {upcoming.length ? (
            upcoming.map((s) => {
              const id = String(s.id);
              const addr = String(s.address ?? "showing");
              return (
                <div key={id} className="relative">
                  <ShowingCard
                    clientId={(s.client_id as string) ?? null}
                    clientName={String((s.clients as { name?: string })?.name ?? "Client")}
                    address={s.address as string | null}
                    showing_date={s.showing_date as string | null}
                    status={(s.status as string) ?? "scheduled"}
                    notes={s.notes as string | null}
                    ai_summary={s.ai_summary as string | null}
                    next_action={s.next_action as string | null}
                    upcoming
                    bbaSigned={signedSet.has(String(s.client_id ?? ""))}
                  />
                  <CardMenu
                    className="absolute right-2 top-2"
                    onEdit={() =>
                      setEditShowing({
                        id,
                        client_id: (s.client_id as string | null) ?? null,
                        address: s.address as string | null,
                        showing_date: s.showing_date as string | null,
                        status: (s.status as string) ?? "scheduled",
                        notes: (s.notes as string | null) ?? null,
                      })
                    }
                    onArchive={() => archiveShowing(id, addr)}
                    onDelete={() => setConfirmDelete({ id, address: addr })}
                  />
                </div>
              );
            })
          ) : (
            <div
              className="px-4 py-5 text-[13px]"
              style={{
                background: "rgba(20,20,22,0.5)",
                border: "0.5px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                color: "#6B7280",
              }}
            >
              No upcoming showings. Tap + Add to schedule one.
            </div>
          )}
        </div>

        {/* ── Past ── */}
        <SectionLabel label="Past" />
        <div className="space-y-2.5">
          {past.length ? (
            past.map((s) => {
              const id = String(s.id);
              const addr = String(s.address ?? "showing");
              return (
                <div key={id} className="relative">
                  <ShowingCard
                    clientId={(s.client_id as string) ?? null}
                    clientName={String((s.clients as { name?: string })?.name ?? "Client")}
                    address={s.address as string | null}
                    showing_date={s.showing_date as string | null}
                    status={(s.status as string) ?? "scheduled"}
                    notes={s.notes as string | null}
                    ai_summary={s.ai_summary as string | null}
                    next_action={s.next_action as string | null}
                    bbaSigned={signedSet.has(String(s.client_id ?? ""))}
                  />
                  <CardMenu
                    className="absolute right-2 top-2"
                    onEdit={() =>
                      setEditShowing({
                        id,
                        client_id: (s.client_id as string | null) ?? null,
                        address: s.address as string | null,
                        showing_date: s.showing_date as string | null,
                        status: (s.status as string) ?? "scheduled",
                        notes: (s.notes as string | null) ?? null,
                      })
                    }
                    onArchive={() => archiveShowing(id, addr)}
                    onDelete={() => setConfirmDelete({ id, address: addr })}
                  />
                </div>
              );
            })
          ) : (
            <div
              className="px-4 py-5 text-[13px]"
              style={{
                background: "rgba(20,20,22,0.5)",
                border: "0.5px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                color: "#6B7280",
              }}
            >
              No past showings yet.
            </div>
          )}
        </div>
      </div>

      {/* ── Add showing sheet ── */}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-[3px]">
          <button type="button" aria-label="Close" className="absolute inset-0" onClick={() => setOpen(false)} />
          <div
            className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-[24px] px-5 pb-10 pt-4"
            style={{
              background: "rgba(20,20,22,0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              borderBottom: "none",
            }}
          >
            <div className="mx-auto mb-5 h-1 w-9 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
            <p className="mb-4 text-[17px] font-semibold" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
              Log a showing
            </p>
            <div className="space-y-3">
              <select
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                style={INPUT_STYLE}
              >
                <option value="" style={{ background: "#111111" }}>Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: "#111111" }}>{c.name}</option>
                ))}
              </select>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Property address"
                className="placeholder-[#4B5563]"
                style={INPUT_STYLE}
              />
              <input
                type="datetime-local"
                value={form.showing_date}
                onChange={(e) => setForm({ ...form, showing_date: e.target.value })}
                className="placeholder-[#4B5563]"
                style={INPUT_STYLE}
              />
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                style={INPUT_STYLE}
              >
                <option value="scheduled" style={{ background: "#111111" }}>Scheduled</option>
                <option value="completed" style={{ background: "#111111" }}>Completed</option>
                <option value="cancelled" style={{ background: "#111111" }}>Cancelled</option>
              </select>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes"
                rows={2}
                className="resize-none placeholder-[#4B5563]"
                style={INPUT_STYLE}
              />
              <textarea
                value={form.feedback}
                onChange={(e) => setForm({ ...form, feedback: e.target.value })}
                placeholder="Feedback (optional — used for AI summary)"
                rows={3}
                className="resize-none placeholder-[#4B5563]"
                style={INPUT_STYLE}
              />
            </div>
            <button
              type="button"
              onClick={save}
              className="mt-5 w-full text-[14px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
              style={{ background: "#3B82F6", borderRadius: 10, padding: "14px" }}
            >
              Save showing
            </button>
          </div>
        </div>
      )}

      {editShowing && (
        <EditShowingModal showing={editShowing} onClose={() => setEditShowing(null)} />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this showing?"
        message={
          confirmDelete
            ? `The showing at ${confirmDelete.address} will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete showing"
        onConfirm={async () => {
          if (confirmDelete) await deleteShowing(confirmDelete.id, confirmDelete.address);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
