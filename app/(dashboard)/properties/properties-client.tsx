"use client";

import { BackButton } from "@/components/BackButton";
import { CardMenu } from "@/components/CardMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditPropertyModal, type EditPropertyRecord } from "@/components/EditPropertyModal";
import { MarketsComingSoonNote } from "@/components/MarketsComingSoonNote";
import { PropertyCard } from "@/components/PropertyCard";
import type { MatchSummary } from "@/components/MatchScoreBadge";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { runPropertyMatching } from "@/lib/matchProperties";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type PropertyMatchMap = Record<string, MatchSummary[]>;

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
  const [filter, setFilter] = useState<"All" | "Available" | "Pending" | "Sold">(
    "All",
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    address: "",
    town: "",
    price: "",
    beds: "",
    baths: "",
    sqft: "",
  });
  const [matchesFor, setMatchesFor] = useState<Record<string, unknown>[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [editProp, setEditProp] = useState<EditPropertyRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; address: string } | null>(null);

  const filtered = useMemo(() => {
    if (filter === "All") return initial;
    const m: Record<string, string> = {
      Available: "available",
      Pending: "pending",
      Sold: "sold",
    };
    return initial.filter((p) => p.status === m[filter]);
  }, [initial, filter]);

  async function findMatches(propertyId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await runPropertyMatching(supabase, user.id, propertyId);
    const { data } = await supabase
      .from("property_matches")
      .select("*, clients(*)")
      .eq("property_id", propertyId);
    setMatchesFor(data ?? []);
    setActivePropertyId(propertyId);
    toast.toast("Matches updated", "success");
  }

  async function notifyAll(propertyId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: ms } = await supabase
      .from("property_matches")
      .select("*, clients(*)")
      .eq("property_id", propertyId);
    let n = 0;
    for (const m of ms ?? []) {
      const c = m.clients as { id: string; name?: string };
      await supabase.from("activities").insert({
        client_id: c.id,
        agent_id: user.id,
        type: "text",
        body: `New property match — review details in Properties.`,
        ai_draft: true,
        approved: false,
        sent: false,
      });
      n += 1;
    }
    toast.toast(`${n} drafts created. Review in Inbox.`, "success");
  }

  async function archiveProperty(id: string, label: string) {
    const { error } = await supabase
      .from("properties")
      .update({ status: "archived" })
      .eq("id", id);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    toast.toast(`${label} archived`, "success");
    router.refresh();
  }

  async function deleteProperty(id: string, label: string) {
    await supabase.from("property_matches").delete().eq("property_id", id);
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    toast.toast(`${label} deleted`, "success");
    setConfirmDelete(null);
    router.refresh();
  }

  async function addProperty() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: created, error } = await supabase
      .from("properties")
      .insert({
        agent_id: user.id,
        address: form.address,
        town: form.town,
        price: Number(form.price),
        beds: Number(form.beds),
        baths: Number(form.baths),
        sqft: Number(form.sqft),
        description: "New property",
      })
      .select("id")
      .single();
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    const { matched } = await runPropertyMatching(supabase, user.id, created.id);
    toast.toast(`${matched} clients matched!`, "success");
    setOpen(false);
    router.refresh();
  }

  async function aiTextMatch(
    clientId: string,
    name: string,
    property: Record<string, unknown>,
  ) {
    await fetch("/api/ai/draft-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientName: name,
        propertyContext: `${property.address} at $${property.price}`,
        skipInsert: false,
      }),
    });
    toast.toast("Draft ready — Inbox", "success");
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <BackButton href="/more" className="mb-4" />
      <header className="flex items-center justify-between gap-2">
        <div className="text-[20px] font-medium text-text-primary">Properties</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full bg-[rgba(59,130,246,0.15)] px-2 py-0.5 text-[11px] font-medium text-accent-blue">
            {availableCount} available
          </span>
          <button
            type="button"
            onClick={() => router.push("/properties/saved")}
            className="rounded-full border border-border-card bg-bg-card px-3 py-[5px] text-[11px] font-semibold text-text-dim"
          >
            Watchlist
          </button>
          <button
            type="button"
            onClick={() => router.push("/mls")}
            className="rounded-full bg-accent-blue px-3 py-[5px] text-[11px] font-semibold text-white"
          >
            Search MLS
          </button>
        </div>
      </header>
      <MarketsComingSoonNote className="mt-2" />
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {(["All", "Available", "Pending", "Sold"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium ${
              filter === f
                ? "border-accent-blue text-accent-blue"
                : "border-border-card text-text-dim"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-[14px] border border-border-card bg-bg-card px-4 py-8 text-center text-[13px] text-text-dim">
            No properties match this filter. Add listings from{" "}
            <button
              type="button"
              onClick={() => router.push("/mls")}
              className="font-medium text-accent-blue"
            >
              MLS Search
            </button>{" "}
            or use + to add manually.
          </div>
        ) : null}
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
                      baths:
                        p.baths != null ? Number(p.baths) : null,
                      sqft: p.sqft as number | null,
                      status: p.status as string | null,
                      description: p.description as string | null,
                    })
                  }
                  onArchive={() => archiveProperty(id, addressLabel)}
                  onDelete={() =>
                    setConfirmDelete({ id, address: addressLabel })
                  }
                />
              </div>
              {activePropertyId === id && matchesFor.length ? (
                <div className="mt-2 space-y-2 rounded-[12px] border border-border-card bg-bg-deep p-3">
                  {matchesFor.map((m) => {
                    const c = m.clients as {
                      id: string;
                      name?: string;
                      lead_score?: number;
                    };
                    return (
                      <div
                        key={String(m.id)}
                        className="flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-[13px] font-medium">
                            {c.name}
                          </div>
                          <div className="text-[11px] text-text-dim">
                            {(m.match_reasons as string[])?.join(" · ")}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => aiTextMatch(c.id, String(c.name), p)}
                          className="rounded-[8px] border border-border-card px-2 py-1 text-[11px] text-accent-blue"
                        >
                          AI Text
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-blue text-[12px] font-medium text-white"
      >
        +
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[14px] border border-border-card bg-bg-card p-4">
            <div className="text-[16px] font-medium">Add property</div>
            <div className="mt-3 space-y-2">
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
                  onChange={(e) =>
                    setForm({ ...form, [k]: e.target.value })
                  }
                  placeholder={ph}
                  className="w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
                />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={addProperty}
                className="flex-1 rounded-[8px] bg-accent-blue py-2 text-[13px] text-white"
              >
                Save
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

      {editProp ? (
        <EditPropertyModal
          property={editProp}
          onClose={() => setEditProp(null)}
        />
      ) : null}

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
          if (confirmDelete)
            await deleteProperty(confirmDelete.id, confirmDelete.address);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
