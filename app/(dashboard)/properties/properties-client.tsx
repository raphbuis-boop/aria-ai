"use client";

import { CardMenu } from "@/components/CardMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditPropertyModal, type EditPropertyRecord } from "@/components/EditPropertyModal";
import { IdxComplianceNotice } from "@/components/IdxComplianceNotice";
import { MarketsComingSoonNote } from "@/components/MarketsComingSoonNote";
import { PropertyCard } from "@/components/PropertyCard";
import type { MatchSummary } from "@/components/MatchScoreBadge";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { runPropertyMatching } from "@/lib/matchProperties";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type PropertyMatchMap = Record<string, MatchSummary[]>;

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

export function PropertiesClient({
  initial,
  availableCount,
  matchMap,
}: {
  initial: Record<string, unknown>[];
  availableCount: number;
  matchMap: PropertyMatchMap;
}) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<"All" | "Available" | "Pending" | "Sold">("All");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    address: "", town: "", price: "", beds: "", baths: "", sqft: "",
  });
  const [matchesFor, setMatchesFor] = useState<Record<string, unknown>[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [editProp, setEditProp] = useState<EditPropertyRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; address: string } | null>(null);

  const filtered = useMemo(() => {
    if (filter === "All") return initial;
    const m: Record<string, string> = { Available: "available", Pending: "pending", Sold: "sold" };
    return initial.filter((p) => p.status === m[filter]);
  }, [initial, filter]);

  async function findMatches(propertyId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await runPropertyMatching(supabase, user.id, propertyId);
    const { data } = await supabase
      .from("property_matches").select("*, clients(*)").eq("property_id", propertyId);
    setMatchesFor(data ?? []);
    setActivePropertyId(propertyId);
    toast.toast("Matches updated", "success");
  }

  async function notifyAll(propertyId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: ms } = await supabase
      .from("property_matches").select("*, clients(*)").eq("property_id", propertyId);
    let n = 0;
    for (const m of ms ?? []) {
      const c = m.clients as { id: string; name?: string };
      await supabase.from("activities").insert({
        client_id: c.id, agent_id: user.id, type: "text",
        body: "New property match — review details in Properties.",
        ai_draft: true, approved: false, sent: false,
      });
      n += 1;
    }
    toast.toast(`${n} drafts created. Review in Inbox.`, "success");
  }

  async function archiveProperty(id: string, label: string) {
    const { error } = await supabase.from("properties").update({ status: "archived" }).eq("id", id);
    if (error) { toast.toast(error.message, "warn"); return; }
    toast.toast(`${label} archived`, "success");
    router.refresh();
  }

  async function deleteProperty(id: string, label: string) {
    await supabase.from("property_matches").delete().eq("property_id", id);
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) { toast.toast(error.message, "warn"); return; }
    toast.toast(`${label} deleted`, "success");
    setConfirmDelete(null);
    router.refresh();
  }

  async function addProperty() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: created, error } = await supabase
      .from("properties")
      .insert({
        agent_id: user.id,
        address: form.address, town: form.town,
        price: Number(form.price), beds: Number(form.beds),
        baths: Number(form.baths), sqft: Number(form.sqft),
        description: "New property",
      })
      .select("id").single();
    if (error) { toast.toast(error.message, "warn"); return; }
    const { matched } = await runPropertyMatching(supabase, user.id, created.id);
    toast.toast(`${matched} clients matched!`, "success");
    setOpen(false);
    router.refresh();
  }

  async function aiTextMatch(clientId: string, name: string, property: Record<string, unknown>) {
    await fetch("/api/ai/draft-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId, clientName: name,
        propertyContext: `${property.address} at $${property.price}`,
        skipInsert: false,
      }),
    });
    toast.toast("Draft ready — Inbox", "success");
  }

  return (
    <div
      className="min-h-[100dvh] pb-[130px]"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.10), transparent),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167,139,250,0.06), transparent)
        `,
        color: "var(--oc-text-1)",
      }}
    >
      <div className="mx-auto max-w-lg px-5 pt-6">

        {/* ── Header ── */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1
              className="text-[22px] font-semibold leading-tight"
              style={{ color: "#ffffff", letterSpacing: "-0.02em" }}
            >
              Properties
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-semibold"
              style={{
                background: "rgba(59,130,246,0.15)",
                color: "#3B82F6",
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              {availableCount} available
            </span>
            <button
              type="button"
              onClick={() => router.push("/properties/saved")}
              className="text-[12px] font-semibold active:scale-[0.97] transition-transform duration-100"
              style={{
                background: "rgba(20,20,22,0.6)",
                border: "0.5px solid rgba(255,255,255,0.10)",
                color: "#9CA3AF",
                padding: "5px 12px",
                borderRadius: 8,
              }}
            >
              Watchlist
            </button>
            <button
              type="button"
              onClick={() => router.push("/listings")}
              className="text-[12px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
              style={{ background: "#3B82F6", padding: "5px 12px", borderRadius: 8 }}
            >
              Search MLS
            </button>
          </div>
        </header>

        <MarketsComingSoonNote className="mb-3" />

        <div className="mb-4">
          <IdxComplianceNotice compact />
        </div>

        {/* ── Filter pills ── */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {(["All", "Available", "Pending", "Sold"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="shrink-0 text-[12px] font-medium active:scale-[0.97] transition-transform duration-100"
              style={
                filter === f
                  ? { background: "#3B82F6", color: "#ffffff", padding: "7px 14px", borderRadius: 20 }
                  : {
                      background: "rgba(20,20,22,0.6)",
                      color: "#6B7280",
                      padding: "7px 14px",
                      borderRadius: 20,
                      border: "0.5px solid rgba(255,255,255,0.06)",
                    }
              }
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── Empty state ── */}
        {filtered.length === 0 && (
          <div className="mt-12 flex flex-col items-center text-center">
            <p
              className="mb-1 text-[11px] font-semibold uppercase"
              style={{ color: "#6B7280", letterSpacing: "0.08em" }}
            >
              No Properties
            </p>
            <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
              No properties match this filter.{" "}
              <button
                type="button"
                onClick={() => router.push("/listings")}
                className="font-medium"
                style={{ color: "#3B82F6" }}
              >
                Search MLS
              </button>{" "}
              or tap + to add manually.
            </p>
          </div>
        )}

        {/* ── Property list ── */}
        <div className="space-y-4">
          {filtered.map((p) => {
            const id = String(p.id);
            const topMatches = matchMap[id] ?? [];
            const matchCount =
              activePropertyId === id && matchesFor.length
                ? matchesFor.length
                : topMatches.length;
            const rawPhotos = p.photos as unknown;
            const photoUrl =
              Array.isArray(rawPhotos) && typeof rawPhotos[0] === "string"
                ? rawPhotos[0]
                : null;
            const snapshot =
              p.snapshot && typeof p.snapshot === "object"
                ? (p.snapshot as Record<string, unknown>)
                : null;
            const snapshotOffice =
              snapshot?.listingOffice && typeof snapshot.listingOffice === "object"
                ? (snapshot.listingOffice as Record<string, unknown>)
                : null;
            const listingOfficeName =
              (typeof p.listing_office_name === "string" ? p.listing_office_name : null) ??
              (typeof snapshotOffice?.name === "string" ? snapshotOffice.name : null);
            const listDate =
              (typeof p.list_date === "string" ? p.list_date : null) ??
              (typeof snapshot?.listDate === "string" ? snapshot.listDate : null) ??
              (typeof p.updated_at === "string" ? p.updated_at : null);
            const addressLabel = String(p.address ?? "Property");

            return (
              <div key={id}>
                <div className="relative">
                  <PropertyCard
                    address={p.address as string | null}
                    town={p.town as string | null}
                    mls_number={p.mls_number as string | null}
                    price={p.price as number | null}
                    beds={p.beds as number | null}
                    baths={Number(p.baths)}
                    sqft={p.sqft as number | null}
                    status={p.status as string | null}
                    matchCount={matchCount}
                    topMatches={topMatches}
                    photoUrl={photoUrl}
                    listingOfficeName={listingOfficeName}
                    listDate={listDate}
                    onFindMatches={() => findMatches(id)}
                    onNotifyAll={() => notifyAll(id)}
                  />
                  <CardMenu
                    className="absolute right-2 top-2"
                    onEdit={() =>
                      setEditProp({
                        id,
                        address: p.address as string | null,
                        town: p.town as string | null,
                        price: p.price as number | null,
                        beds: p.beds as number | null,
                        baths: p.baths != null ? Number(p.baths) : null,
                        sqft: p.sqft as number | null,
                        status: p.status as string | null,
                        description: p.description as string | null,
                      })
                    }
                    onArchive={() => archiveProperty(id, addressLabel)}
                    onDelete={() => setConfirmDelete({ id, address: addressLabel })}
                  />
                </div>

                {/* Match results panel */}
                {activePropertyId === id && matchesFor.length > 0 && (
                  <div
                    className="mt-2 space-y-2 p-3"
                    style={{
                      background: "rgba(20,20,22,0.6)",
                      border: "0.5px solid rgba(255,255,255,0.06)",
                      borderRadius: 12,
                    }}
                  >
                    {matchesFor.map((m) => {
                      const c = m.clients as { id: string; name?: string; lead_score?: number };
                      return (
                        <div key={String(m.id)} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium" style={{ color: "#ffffff" }}>
                              {c.name}
                            </div>
                            <div className="truncate text-[11px]" style={{ color: "#6B7280" }}>
                              {(m.match_reasons as string[])?.join(" · ")}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => aiTextMatch(c.id, String(c.name), p)}
                            className="text-[11px] font-medium active:scale-[0.97] transition-transform duration-100"
                            style={{
                              background: "transparent",
                              border: "0.5px solid rgba(255,255,255,0.15)",
                              color: "#ffffff",
                              padding: "5px 10px",
                              borderRadius: 6,
                            }}
                          >
                            AI Text
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FAB ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center text-[24px] font-medium text-white active:scale-[0.97] transition-transform duration-100"
        style={{
          background: "#3B82F6",
          borderRadius: "50%",
          boxShadow: "0 4px 20px rgba(59,130,246,0.4)",
        }}
      >
        +
      </button>

      {/* ── Add property sheet ── */}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-[3px]">
          <button type="button" aria-label="Close" className="absolute inset-0" onClick={() => setOpen(false)} />
          <div
            className="relative z-10 w-full max-w-md rounded-t-[24px] px-5 pb-10 pt-4"
            style={{
              background: "rgba(20,20,22,0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              borderBottom: "none",
            }}
          >
            <div
              className="mx-auto mb-5 h-1 w-9 rounded-full"
              style={{ background: "rgba(255,255,255,0.15)" }}
            />
            <p className="mb-4 text-[17px] font-semibold" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
              Add property
            </p>
            <div className="space-y-3">
              {(
                [
                  ["address", "Address"],
                  ["town", "Town"],
                  ["price", "Price"],
                  ["beds", "Beds"],
                  ["baths", "Baths"],
                  ["sqft", "Sqft"],
                ] as const
              ).map(([k, ph]) => (
                <input
                  key={k}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  placeholder={ph}
                  className="placeholder-[#4B5563]"
                  style={INPUT_STYLE}
                />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={addProperty}
                className="flex-1 text-[14px] font-semibold text-white active:scale-[0.97] transition-transform duration-100"
                style={{ background: "#3B82F6", borderRadius: 10, padding: "13px" }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[14px] font-medium active:scale-[0.97] transition-transform duration-100"
                style={{
                  background: "transparent",
                  border: "0.5px solid rgba(255,255,255,0.15)",
                  color: "#9CA3AF",
                  borderRadius: 10,
                  padding: "13px 18px",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editProp && (
        <EditPropertyModal property={editProp} onClose={() => setEditProp(null)} />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this property?"
        message={
          confirmDelete
            ? `${confirmDelete.address} will be permanently removed along with its match records. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete property"
        onConfirm={async () => {
          if (confirmDelete) await deleteProperty(confirmDelete.id, confirmDelete.address);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
