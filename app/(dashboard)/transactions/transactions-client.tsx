"use client";

import { CardMenu } from "@/components/CardMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  EditTransactionModal,
  type EditTransactionRecord,
} from "@/components/EditTransactionModal";
import { TransactionMilestone } from "@/components/TransactionMilestone";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { addDays, differenceInCalendarDays } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TxForm = {
  client_id: string;
  address: string;
  contract_price: string;
  closing_date: string;
  inspection_date: string;
  appraisal_date: string;
  mortgage_commitment_date: string;
  attorney_name: string;
  attorney_email: string;
  lender_name: string;
  lender_email: string;
};

const emptyForm: TxForm = {
  client_id: "", address: "", contract_price: "",
  closing_date: "", inspection_date: "", appraisal_date: "",
  mortgage_commitment_date: "", attorney_name: "", attorney_email: "",
  lender_name: "", lender_email: "",
};

export function TransactionsClient({
  initial,
}: {
  initial: Record<string, unknown>[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Record<string, unknown> | null>(initial[0] ?? null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TxForm>(emptyForm);
  const [draft, setDraft] = useState<string | null>(null);
  const [editTx, setEditTx] = useState<EditTransactionRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

  const atRisk = useMemo(() => {
    if (!selected) return false;
    const dates = [
      selected.inspection_date,
      selected.appraisal_date,
      selected.mortgage_commitment_date,
      selected.closing_date,
    ].filter(Boolean) as string[];
    const now = new Date();
    return dates.some((d) => {
      const days = differenceInCalendarDays(new Date(d), now);
      return days >= 0 && days <= 2;
    });
  }, [selected]);

  async function archiveTx(id: string, label: string) {
    const { error } = await supabase.from("transactions").update({ status: "archived" }).eq("id", id);
    if (error) { toast.toast(error.message, "warn"); return; }
    if (selected?.id === id) setSelected(null);
    toast.toast(`${label} archived`, "success");
    router.refresh();
  }

  async function deleteTx(id: string, label: string) {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast.toast(error.message, "warn"); return; }
    if (selected?.id === id) setSelected(null);
    toast.toast(`${label} deleted`, "success");
    setConfirmDelete(null);
    router.refresh();
  }

  async function saveTx() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: created, error } = await supabase
      .from("transactions")
      .insert({
        client_id: form.client_id, agent_id: user.id,
        address: form.address,
        contract_price: Number(form.contract_price || 0),
        closing_date: form.closing_date ? new Date(form.closing_date).toISOString() : null,
        inspection_date: form.inspection_date ? new Date(form.inspection_date).toISOString() : null,
        appraisal_date: form.appraisal_date ? new Date(form.appraisal_date).toISOString() : null,
        mortgage_commitment_date: form.mortgage_commitment_date ? new Date(form.mortgage_commitment_date).toISOString() : null,
        attorney_name: form.attorney_name, attorney_email: form.attorney_email,
        lender_name: form.lender_name, lender_email: form.lender_email,
        status: "active",
      })
      .select("*").single();
    if (error) { toast.toast(error.message, "warn"); return; }

    for (const m of [
      { label: "Inspection", key: form.inspection_date },
      { label: "Appraisal", key: form.appraisal_date },
      { label: "Mortgage commitment", key: form.mortgage_commitment_date },
      { label: "Closing", key: form.closing_date },
    ]) {
      if (!m.key) continue;
      await supabase.from("tasks").insert({
        client_id: form.client_id, agent_id: user.id,
        title: `${m.label} prep`,
        due_at: addDays(new Date(m.key), -2).toISOString(),
        ai_generated: true,
      });
    }

    toast.toast("Transaction added", "success");
    setOpen(false);
    setForm(emptyForm);
    router.refresh();
    setSelected(created);
  }

  async function draftEmail() {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Draft a short check-in email about upcoming milestones.",
        context: JSON.stringify(selected),
      }),
    });
    const data = await res.json();
    setDraft(String(data.reply ?? ""));
  }

  return (
    <div
      className="min-h-screen pb-[130px]"
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
            Transaction Copilot
          </h1>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[13px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
            style={{ background: "#3B82F6", padding: "8px 16px", borderRadius: 8 }}
          >
            + Add
          </button>
        </div>

        {/* ── At-risk banner ── */}
        {atRisk && selected && (
          <div
            className="mb-4 px-4 py-3 text-[13px] font-medium"
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "0.5px solid rgba(239,68,68,0.30)",
              borderRadius: 10,
              color: "#EF4444",
            }}
          >
            At-risk: milestone within 48 hours — confirm status now.
          </div>
        )}

        {/* ── Transaction list ── */}
        <div className="space-y-3 mb-8">
          {initial.length === 0 && (
            <div className="mt-12 flex flex-col items-center text-center">
              <p
                className="mb-1 text-[11px] font-semibold uppercase"
                style={{ color: "#6B7280", letterSpacing: "0.08em" }}
              >
                No Transactions
              </p>
              <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
                Tap + Add to create your first transaction
              </p>
            </div>
          )}
          {initial.map((t) => {
            const id = String(t.id);
            const name = (t.clients as { name?: string })?.name ?? "Client";
            const closing = t.closing_date ? new Date(String(t.closing_date)) : null;
            const days = closing ? differenceInCalendarDays(closing, new Date()) : null;
            const isUrgent = days != null && days >= 0 && days <= 3;
            const label = `${name} · ${String(t.address ?? "Transaction")}`;
            const isSelected = selected?.id === t.id;
            return (
              <div key={id} className="relative">
                <button
                  type="button"
                  onClick={() => setSelected(t)}
                  className="w-full pr-10 text-left active:bg-white/[0.02]"
                  style={{
                    background: isSelected ? "rgba(59,130,246,0.08)" : "rgba(20,20,22,0.7)",
                    border: isSelected
                      ? "0.5px solid rgba(59,130,246,0.3)"
                      : "0.5px solid rgba(255,255,255,0.06)",
                    borderRadius: 14,
                    padding: 16,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                  }}
                >
                  <div
                    className="text-[15px] font-semibold"
                    style={{ color: "#ffffff", letterSpacing: "-0.01em" }}
                  >
                    {name}
                  </div>
                  <div className="mt-0.5 text-[12px]" style={{ color: "#6B7280" }}>
                    {String(t.address)}
                  </div>
                  <div className="mt-2 text-[14px] font-semibold" style={{ color: "#3B82F6" }}>
                    ${Number(t.contract_price ?? 0).toLocaleString()}
                  </div>
                  <div
                    className="mt-0.5 text-[12px] font-medium"
                    style={{ color: isUrgent ? "#EF4444" : "#6B7280" }}
                  >
                    {days != null ? `${days} days to closing` : "Closing TBD"}
                  </div>
                </button>
                <CardMenu
                  className="absolute right-2 top-2"
                  onEdit={() =>
                    setEditTx({
                      id,
                      address: (t.address as string | null) ?? null,
                      contract_price: (t.contract_price as number | null) ?? null,
                      closing_date: (t.closing_date as string | null) ?? null,
                      inspection_date: (t.inspection_date as string | null) ?? null,
                      appraisal_date: (t.appraisal_date as string | null) ?? null,
                      mortgage_commitment_date: (t.mortgage_commitment_date as string | null) ?? null,
                      attorney_name: (t.attorney_name as string | null) ?? null,
                      attorney_email: (t.attorney_email as string | null) ?? null,
                      lender_name: (t.lender_name as string | null) ?? null,
                      lender_email: (t.lender_email as string | null) ?? null,
                      status: (t.status as string | null) ?? null,
                    })
                  }
                  onArchive={() => archiveTx(id, label)}
                  onDelete={() => setConfirmDelete({ id, label })}
                />
              </div>
            );
          })}
        </div>

        {/* ── Selected transaction detail ── */}
        {selected && (
          <div className="space-y-3">
            <p
              className="text-[11px] font-semibold uppercase"
              style={{ color: "#6B7280", letterSpacing: "0.08em" }}
            >
              Milestones
            </p>
            <TransactionMilestone label="Inspection" dateIso={selected.inspection_date as string | null} />
            <TransactionMilestone label="Appraisal" dateIso={selected.appraisal_date as string | null} />
            <TransactionMilestone label="Mortgage commitment" dateIso={selected.mortgage_commitment_date as string | null} />
            <TransactionMilestone label="Closing" dateIso={selected.closing_date as string | null} />
            <button
              type="button"
              onClick={draftEmail}
              className="text-[13px] font-medium text-white active:scale-[0.97] transition-transform duration-100"
              style={{
                background: "transparent",
                border: "0.5px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: "9px 14px",
              }}
            >
              Draft check-in email
            </button>
            {draft && (
              <div
                className="p-4"
                style={{
                  background: "rgba(20,20,22,0.6)",
                  border: "0.5px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                }}
              >
                <p className="text-[13px]" style={{ color: "#9CA3AF" }}>{draft}</p>
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(draft).then(() => toast.toast("Copied", "success"))
                  }
                  className="mt-3 text-[11px] font-medium active:scale-[0.97] transition-transform duration-100"
                  style={{
                    background: "transparent",
                    border: "0.5px solid rgba(255,255,255,0.15)",
                    color: "#9CA3AF",
                    borderRadius: 6,
                    padding: "4px 10px",
                  }}
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add transaction sheet ── */}
      {open && (
        <AddTxModal form={form} setForm={setForm} onClose={() => setOpen(false)} onSave={saveTx} />
      )}

      {editTx && (
        <EditTransactionModal tx={editTx} onClose={() => setEditTx(null)} />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this transaction?"
        message={
          confirmDelete
            ? `${confirmDelete.label} will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete transaction"
        onConfirm={async () => {
          if (confirmDelete) await deleteTx(confirmDelete.id, confirmDelete.label);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function AddTxModal({
  form,
  setForm,
  onClose,
  onSave,
}: {
  form: TxForm;
  setForm: (f: TxForm | ((p: TxForm) => TxForm)) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const supabase = createClient();
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  const INPUT_STYLE_MODAL = {
    background: "rgba(255,255,255,0.06)",
    border: "0.5px solid rgba(255,255,255,0.08)",
    color: "#ffffff",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("clients").select("id, name").eq("agent_id", user.id);
      setClients((data as { id: string; name: string }[]) ?? []);
    })();
  }, [supabase]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-[3px]">
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={onClose} />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[24px] px-5 pb-10 pt-4"
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
          Add transaction
        </p>
        <div className="space-y-3">
          <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} style={INPUT_STYLE_MODAL}>
            <option value="" style={{ background: "#111111" }}>Select client</option>
            {clients.map((c) => <option key={c.id} value={c.id} style={{ background: "#111111" }}>{c.name}</option>)}
          </select>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="placeholder-[#4B5563]" style={INPUT_STYLE_MODAL} />
          <input value={form.contract_price} onChange={(e) => setForm({ ...form, contract_price: e.target.value })} placeholder="Contract price" className="placeholder-[#4B5563]" style={INPUT_STYLE_MODAL} />
          {(
            [
              ["closing_date", "Closing date"],
              ["inspection_date", "Inspection date"],
              ["appraisal_date", "Appraisal date"],
              ["mortgage_commitment_date", "Mortgage commitment date"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <p className="mb-1 text-[11px] font-semibold uppercase" style={{ color: "#6B7280", letterSpacing: "0.08em" }}>{label}</p>
              <input
                type="datetime-local"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value } as TxForm)}
                style={INPUT_STYLE_MODAL}
              />
            </div>
          ))}
          <input value={form.attorney_name} onChange={(e) => setForm({ ...form, attorney_name: e.target.value })} placeholder="Attorney name" className="placeholder-[#4B5563]" style={INPUT_STYLE_MODAL} />
          <input value={form.attorney_email} onChange={(e) => setForm({ ...form, attorney_email: e.target.value })} placeholder="Attorney email" className="placeholder-[#4B5563]" style={INPUT_STYLE_MODAL} />
          <input value={form.lender_name} onChange={(e) => setForm({ ...form, lender_name: e.target.value })} placeholder="Lender name" className="placeholder-[#4B5563]" style={INPUT_STYLE_MODAL} />
          <input value={form.lender_email} onChange={(e) => setForm({ ...form, lender_email: e.target.value })} placeholder="Lender email" className="placeholder-[#4B5563]" style={INPUT_STYLE_MODAL} />
        </div>
        <div className="mt-5 flex gap-2 pb-2">
          <button type="button" onClick={onSave}
            className="flex-1 text-[14px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
            style={{ background: "#3B82F6", borderRadius: 10, padding: "13px" }}>
            Save
          </button>
          <button type="button" onClick={onClose}
            className="text-[14px] font-medium active:scale-[0.97] transition-transform duration-100"
            style={{ background: "transparent", border: "0.5px solid rgba(255,255,255,0.15)", color: "#9CA3AF", borderRadius: 10, padding: "13px 18px" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
