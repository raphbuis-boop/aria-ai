"use client";

import { BackButton } from "@/components/BackButton";
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
  client_id: "",
  address: "",
  contract_price: "",
  closing_date: "",
  inspection_date: "",
  appraisal_date: "",
  mortgage_commitment_date: "",
  attorney_name: "",
  attorney_email: "",
  lender_name: "",
  lender_email: "",
};

export function TransactionsClient({
  initial,
}: {
  initial: Record<string, unknown>[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    initial[0] ?? null,
  );
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
      const dt = new Date(d);
      const days = differenceInCalendarDays(dt, now);
      return days >= 0 && days <= 2;
    });
  }, [selected]);

  async function archiveTx(id: string, label: string) {
    const { error } = await supabase
      .from("transactions")
      .update({ status: "archived" })
      .eq("id", id);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    if (selected?.id === id) setSelected(null);
    toast.toast(`${label} archived`, "success");
    router.refresh();
  }

  async function deleteTx(id: string, label: string) {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    if (selected?.id === id) setSelected(null);
    toast.toast(`${label} deleted`, "success");
    setConfirmDelete(null);
    router.refresh();
  }

  async function saveTx() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: created, error } = await supabase
      .from("transactions")
      .insert({
        client_id: form.client_id,
        agent_id: user.id,
        address: form.address,
        contract_price: Number(form.contract_price || 0),
        closing_date: form.closing_date
          ? new Date(form.closing_date).toISOString()
          : null,
        inspection_date: form.inspection_date
          ? new Date(form.inspection_date).toISOString()
          : null,
        appraisal_date: form.appraisal_date
          ? new Date(form.appraisal_date).toISOString()
          : null,
        mortgage_commitment_date: form.mortgage_commitment_date
          ? new Date(form.mortgage_commitment_date).toISOString()
          : null,
        attorney_name: form.attorney_name,
        attorney_email: form.attorney_email,
        lender_name: form.lender_name,
        lender_email: form.lender_email,
        status: "active",
      })
      .select("*")
      .single();
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }

    const milestoneDates = [
      { label: "Inspection", key: form.inspection_date },
      { label: "Appraisal", key: form.appraisal_date },
      { label: "Mortgage commitment", key: form.mortgage_commitment_date },
      { label: "Closing", key: form.closing_date },
    ];
    for (const m of milestoneDates) {
      if (!m.key) continue;
      const due = addDays(new Date(m.key), -2);
      await supabase.from("tasks").insert({
        client_id: form.client_id,
        agent_id: user.id,
        title: `${m.label} prep`,
        due_at: due.toISOString(),
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
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <BackButton href="/dashboard" className="mb-4" />
      <div className="text-[20px] font-medium text-text-primary">
        Transaction Copilot
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-[8px] bg-accent-blue py-3 text-[13px] font-medium text-white"
      >
        Add Transaction
      </button>

      {atRisk && selected ? (
        <div className="mt-4 rounded-[10px] border border-red-500 bg-bg-deep px-3 py-2 text-[12px] text-red-400">
          At-risk: milestone within 48 hours — confirm status now.
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {initial.map((t) => {
          const id = String(t.id);
          const name = (t.clients as { name?: string })?.name ?? "Client";
          const closing = t.closing_date
            ? new Date(String(t.closing_date))
            : null;
          const days = closing
            ? differenceInCalendarDays(closing, new Date())
            : null;
          const label = `${name} · ${String(t.address ?? "Transaction")}`;
          return (
            <div key={id} className="relative">
              <button
                type="button"
                onClick={() => setSelected(t)}
                className="w-full rounded-[14px] border border-border-card bg-bg-card p-4 pr-10 text-left"
              >
                <div className="text-[14px] font-medium text-text-primary">
                  {name}
                </div>
                <div className="text-[12px] text-text-dim">
                  {String(t.address)}
                </div>
                <div className="mt-2 text-[13px] text-accent-blue">
                  ${Number(t.contract_price ?? 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-text-dim">
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
                    inspection_date:
                      (t.inspection_date as string | null) ?? null,
                    appraisal_date:
                      (t.appraisal_date as string | null) ?? null,
                    mortgage_commitment_date:
                      (t.mortgage_commitment_date as string | null) ?? null,
                    attorney_name:
                      (t.attorney_name as string | null) ?? null,
                    attorney_email:
                      (t.attorney_email as string | null) ?? null,
                    lender_name: (t.lender_name as string | null) ?? null,
                    lender_email:
                      (t.lender_email as string | null) ?? null,
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

      {selected ? (
        <div className="mt-8 space-y-3">
          <div className="text-[16px] font-medium text-text-primary">Timeline</div>
          <TransactionMilestone
            label="Inspection"
            dateIso={selected.inspection_date as string | null}
          />
          <TransactionMilestone
            label="Appraisal"
            dateIso={selected.appraisal_date as string | null}
          />
          <TransactionMilestone
            label="Mortgage commitment"
            dateIso={selected.mortgage_commitment_date as string | null}
          />
          <TransactionMilestone
            label="Closing"
            dateIso={selected.closing_date as string | null}
          />
          <button
            type="button"
            onClick={draftEmail}
            className="rounded-[8px] bg-accent-blue px-3 py-2 text-[12px] font-medium text-white"
          >
            Draft check-in email
          </button>
          {draft ? (
            <div className="rounded-[12px] border border-border-card bg-bg-card p-3 text-[13px] text-text-secondary">
              {draft}
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(draft).then(() =>
                    toast.toast("Copied", "success"),
                  )
                }
                className="mt-2 rounded-[8px] border border-border-card px-2 py-1 text-[11px] text-accent-blue"
              >
                Copy
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <AddTxModal
          form={form}
          setForm={setForm}
          onClose={() => setOpen(false)}
          onSave={saveTx}
        />
      ) : null}

      {editTx ? (
        <EditTransactionModal tx={editTx} onClose={() => setEditTx(null)} />
      ) : null}

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

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("agent_id", user.id);
      setClients((data as { id: string; name: string }[]) ?? []);
    })();
  }, [supabase]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[14px] border border-border-card bg-bg-card p-4">
        <div className="text-[16px] font-medium">Add transaction</div>
        <select
          value={form.client_id}
          onChange={(e) => setForm({ ...form, client_id: e.target.value })}
          className="mt-3 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        >
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Address"
          className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <input
          value={form.contract_price}
          onChange={(e) => setForm({ ...form, contract_price: e.target.value })}
          placeholder="Contract price"
          className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        {(
          [
            ["closing_date", "Closing"],
            ["inspection_date", "Inspection"],
            ["appraisal_date", "Appraisal"],
            ["mortgage_commitment_date", "Mortgage commitment"],
          ] as const
        ).map(([key, label]) => (
          <input
            key={key}
            type="datetime-local"
            value={form[key]}
            onChange={(e) =>
              setForm({ ...form, [key]: e.target.value } as TxForm)
            }
            placeholder={label}
            className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
          />
        ))}
        <input
          value={form.attorney_name}
          onChange={(e) => setForm({ ...form, attorney_name: e.target.value })}
          placeholder="Attorney name"
          className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <input
          value={form.attorney_email}
          onChange={(e) => setForm({ ...form, attorney_email: e.target.value })}
          placeholder="Attorney email"
          className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <input
          value={form.lender_name}
          onChange={(e) => setForm({ ...form, lender_name: e.target.value })}
          placeholder="Lender name"
          className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <input
          value={form.lender_email}
          onChange={(e) => setForm({ ...form, lender_email: e.target.value })}
          placeholder="Lender email"
          className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onSave}
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
