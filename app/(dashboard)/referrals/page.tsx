"use client";

import { ReferralCard } from "@/components/ReferralCard";
import { useToast } from "@/components/ToastProvider";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const INPUT_STYLE = {
  background: "rgba(255,255,255,0.06)",
  border: "0.5px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

export default function ReferralsPage() {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"Sent" | "Received">("Sent");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [agents, setAgents] = useState<{ id: string; full_name: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    client_name: "", client_phone: "", client_email: "",
    town: "", budget_max: "", notes: "",
    to_agent_id: "", referral_fee_percent: "25",
  });

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const [{ data }, { data: profs }] = await Promise.all([
      supabase.from("referrals").select("*").or(`from_agent_id.eq.${user.id},to_agent_id.eq.${user.id}`),
      supabase.from("agent_profiles").select("id, full_name"),
    ]);
    setRows(data ?? []);
    setAgents((profs as { id: string; full_name: string | null }[]) ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!userId) return [];
    return rows.filter((r) =>
      tab === "Sent" ? r.from_agent_id === userId : r.to_agent_id === userId,
    );
  }, [rows, tab, userId]);

  async function createReferral() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("referrals").insert({
      from_agent_id: user.id,
      to_agent_id: form.to_agent_id || user.id,
      client_name: form.client_name, client_phone: form.client_phone,
      client_email: form.client_email, town: form.town,
      budget_max: Number(form.budget_max || 0), notes: form.notes,
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("referrals").update({ status: "accepted" }).eq("id", id);
    await supabase.from("clients").insert({
      agent_id: user.id,
      name: String(ref.client_name ?? "Referral client"),
      phone: ref.client_phone as string | null,
      email: ref.client_email as string | null,
      town: ref.town as string | null,
      budget_max: ref.budget_max as number | null,
      source: "referral", status: "new",
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
      <div className="mx-auto max-w-lg px-5 pt-6">

        {/* ── Header ── */}
        <div className="mb-5 flex items-center justify-between">
          <h1
            className="text-[22px] font-semibold leading-tight"
            style={{ color: "#ffffff", letterSpacing: "-0.02em" }}
          >
            Referral Marketplace
          </h1>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[13px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
            style={{ background: "#3B82F6", padding: "8px 16px", borderRadius: 8 }}
          >
            + New
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="mb-5 flex gap-2">
          {(["Sent", "Received"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="text-[12px] font-medium active:scale-[0.97] transition-transform duration-100"
              style={
                tab === t
                  ? { background: "#3B82F6", color: "#ffffff", padding: "7px 16px", borderRadius: 20 }
                  : {
                      background: "rgba(20,20,22,0.6)",
                      color: "#6B7280",
                      padding: "7px 16px",
                      borderRadius: 20,
                      border: "0.5px solid rgba(255,255,255,0.06)",
                    }
              }
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Referral list ── */}
        <div className="space-y-3">
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
                      className="text-[12px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
                      style={{ background: "#3B82F6", borderRadius: 7, padding: "7px 14px" }}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => decline(String(r.id))}
                      className="text-[12px] font-medium active:scale-[0.97] transition-transform duration-100"
                      style={{
                        background: "transparent",
                        border: "0.5px solid rgba(255,255,255,0.15)",
                        color: "#9CA3AF",
                        borderRadius: 7,
                        padding: "7px 14px",
                      }}
                    >
                      Decline
                    </button>
                  </>
                ) : null
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="mt-8 flex flex-col items-center text-center">
              <p
                className="mb-1 text-[11px] font-semibold uppercase"
                style={{ color: "#6B7280", letterSpacing: "0.08em" }}
              >
                No Referrals
              </p>
              <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
                No referrals in this tab yet.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── New referral sheet ── */}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-[3px]">
          <button type="button" aria-label="Close" className="absolute inset-0" onClick={() => setOpen(false)} />
          <div
            className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[24px] px-5 pb-10 pt-4"
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
              New referral
            </p>
            <div className="space-y-3">
              <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Client name" className="placeholder-[#4B5563]" style={INPUT_STYLE} />
              <input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} placeholder="Phone" className="placeholder-[#4B5563]" style={INPUT_STYLE} />
              <input value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="Email" className="placeholder-[#4B5563]" style={INPUT_STYLE} />
              <input value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} placeholder="Town" className="placeholder-[#4B5563]" style={INPUT_STYLE} />
              <input value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} placeholder="Budget max" className="placeholder-[#4B5563]" style={INPUT_STYLE} />
              <input value={form.referral_fee_percent} onChange={(e) => setForm({ ...form, referral_fee_percent: e.target.value })} placeholder="Fee %" className="placeholder-[#4B5563]" style={INPUT_STYLE} />
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes"
                rows={3}
                className="resize-none placeholder-[#4B5563]"
                style={{ ...INPUT_STYLE, padding: "12px 16px" }}
              />
              <select value={form.to_agent_id} onChange={(e) => setForm({ ...form, to_agent_id: e.target.value })} style={INPUT_STYLE}>
                <option value="" style={{ background: "#111111" }}>Select agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id} style={{ background: "#111111" }}>{a.full_name ?? a.id}</option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={createReferral}
                className="flex-1 text-[14px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
                style={{ background: "#3B82F6", borderRadius: 10, padding: "13px" }}>
                Send
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="text-[14px] font-medium active:scale-[0.97] transition-transform duration-100"
                style={{ background: "transparent", border: "0.5px solid rgba(255,255,255,0.15)", color: "#9CA3AF", borderRadius: 10, padding: "13px 18px" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
