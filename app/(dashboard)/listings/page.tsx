import { Suspense } from "react";
import { MlsSearchClient } from "../mls/mls-search-client";

export default function ListingsSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-text-dim">
          Loading search…
        </div>
      }
    >
      <MlsSearchClient />
    </Suspense>
  );
}
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ListingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("listings")
    .select("*")
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="text-[20px] font-medium text-text-primary">Listings</div>
      <div className="mt-4 space-y-3">
        {(rows ?? []).map((l) => (
          <div
            key={l.id}
            className="rounded-[14px] border border-border-card bg-bg-card p-4"
          >
            <div className="text-[15px] font-medium text-text-primary">
              {l.address}
            </div>
            <div className="text-[13px] text-accent-blue">
              ${Number(l.price ?? 0).toLocaleString()}
            </div>
            <div className="text-[12px] text-text-dim">
              {l.beds} bd · {l.baths} ba · {l.sqft?.toLocaleString()} sqft
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/listings/new"
        className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-blue text-[13px] font-medium text-white"
      >
        New
      </Link>
    </div>
  );
}
