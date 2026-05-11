"use client";

import { BackButton } from "@/components/BackButton";
import { ReferralCard } from "@/components/ReferralCard";
import { useToast } from "@/components/ToastProvider";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReferralsPage() {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"Sent" | "Received">("Sent");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [agents, setAgents] = useState<{ id: string; full_name: string | null }[]>(
    [],
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    client_email: "",
    town: "",
    budget_max: "",
    notes: "",
    to_agent_id: "",
    referral_fee_percent: "25",
  });

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from("referrals")
      .select("*")
      .or(`from_agent_id.eq.${user.id},to_agent_id.eq.${user.id}`);
    setRows(data ?? []);
    const { data: profs } = await supabase
      .from("agent_profiles")
      .select("id, full_name");
    setAgents((profs as { id: string; full_name: string | null }[]) ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const filtered = useMemo(() => {
    if (!userId) return [];
    return rows.filter((r) =>
      tab === "Sent"
        ? r.from_agent_id === userId
        : r.to_agent_id === userId,
    );
  }, [rows, tab, userId]);

  async function createReferral() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("referrals").insert({
      from_agent_id: user.id,
      to_agent_id: form.to_agent_id || user.id,
      client_name: form.client_name,
      client_phone: form.client_phone,
      client_email: form.client_email,
      town: form.town,
      budget_max: Number(form.budget_max || 0),
      notes: form.notes,
      referral_fee_percent: Number(form.referral_fee_percent || 25),
      status: "pending",
    });
    toast.toast("Referral sent", "success");
    setOpen(false);
    void load();
  }

  async function accept(id: string) {
    const ref = rows.find((r) => r.id === id);
    if (!ref) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("referrals")
      .update({ status: "accepted" })
      .eq("id", id);
    await supabase.from("clients").insert({
      agent_id: user.id,
      name: String(ref.client_name ?? "Referral client"),
      phone: ref.client_phone as string | null,
      email: ref.client_email as string | null,
      town: ref.town as string | null,
      budget_max: ref.budget_max as number | null,
      source: "referral",
      status: "new",
    });
    track("client_created", { source: "automation" });
    toast.toast("Client created", "success");
    void load();
    router.refresh();
  }

  async function decline(id: string) {
    await supabase.from("referrals").update({ status: "declined" }).eq("id", id);
    toast.toast("Declined", "success");
    void load();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <BackButton href="/more" className="mb-4" />
      <div className="text-[20px] font-medium text-text-primary">
        Referral Marketplace
      </div>
      <div className="mt-4 flex gap-2">
        {(["Sent", "Received"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
              tab === t
                ? "border-accent-blue text-accent-blue"
                : "border-border-card text-text-dim"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white"
      >
        New Referral
      </button>

      <div className="mt-6 space-y-3">
        {filtered.map((r) => (
          <ReferralCard
            key={String(r.id)}
            client_name={r.client_name as string | null}
            town={r.town as string | null}
            budget_max={r.budget_max as number | null}
            status={r.status as string | null}
            meta={
              tab === "Sent"
                ? `To: ${agents.find((a) => a.id === r.to_agent_id)?.full_name ?? ""}`
                : `From: ${agents.find((a) => a.id === r.from_agent_id)?.full_name ?? ""}`
            }
            actions={
              tab === "Received" && r.status === "pending" ? (
                <>
                  <button
                    type="button"
                    onClick={() => accept(String(r.id))}
                    className="rounded-[8px] bg-accent-blue px-3 py-1.5 text-[12px] text-white"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => decline(String(r.id))}
                    className="rounded-[8px] border border-border-card px-3 py-1.5 text-[12px] text-text-dim"
                  >
                    Decline
                  </button>
                </>
              ) : null
            }
          />
        ))}
        {!filtered.length ? (
          <div className="rounded-[14px] border border-border-card bg-bg-card p-4 text-[13px] text-text-muted">
            No referrals in this tab yet.
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[14px] border border-border-card bg-bg-card p-4">
            <div className="text-[16px] font-medium">New referral</div>
            <div className="mt-3 space-y-2">
              <input
                value={form.client_name}
                onChange={(e) =>
                  setForm({ ...form, client_name: e.target.value })
                }
                placeholder="Client name"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              />
              <input
                value={form.client_phone}
                onChange={(e) =>
                  setForm({ ...form, client_phone: e.target.value })
                }
                placeholder="Phone"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              />
              <input
                value={form.client_email}
                onChange={(e) =>
                  setForm({ ...form, client_email: e.target.value })
                }
                placeholder="Email"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              />
              <input
                value={form.town}
                onChange={(e) => setForm({ ...form, town: e.target.value })}
                placeholder="Town"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              />
              <input
                value={form.budget_max}
                onChange={(e) =>
                  setForm({ ...form, budget_max: e.target.value })
                }
                placeholder="Budget max"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              />
              <input
                value={form.referral_fee_percent}
                onChange={(e) =>
                  setForm({ ...form, referral_fee_percent: e.target.value })
                }
                placeholder="Fee %"
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              />
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes"
                className="min-h-[72px] w-full rounded-[8px] border border-border-card bg-bg-deep p-2 text-[13px]"
              />
              <select
                value={form.to_agent_id}
                onChange={(e) =>
                  setForm({ ...form, to_agent_id: e.target.value })
                }
                className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
              >
                <option value="">Select agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name ?? a.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={createReferral}
                className="flex-1 rounded-[8px] bg-accent-blue py-2 text-[13px] text-white"
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[8px] border border-border-card px-3 py-2 text-[13px] text-text-dim"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
