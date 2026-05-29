import { createClient } from "@/lib/supabase/server";
import { InboxClient } from "./inbox-client";
import { redirect } from "next/navigation";

export default async function InboxPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("activities")
    .select(
      `
      id,
      type,
      body,
      created_at,
      ai_draft,
      approved,
      sent,
      client_id,
      clients ( name, phone )
    `,
    )
    .eq("agent_id", user.id)
    .or("ai_draft.eq.false,sent.eq.false")
    .order("created_at", { ascending: false })
    .limit(200);

  const { count: unread } = await supabase
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", user.id)
    .eq("ai_draft", true)
    .eq("approved", false);

  const initial = (rows ?? []).map((r) => {
    const c = r.clients as
      | { name: string | null; phone: string | null }
      | { name: string | null; phone: string | null }[]
      | null;
    const client = Array.isArray(c) ? c[0] : c;
    return { ...r, clients: client ?? null };
  });

  return (
    <InboxClient
      initial={initial}
      unread={unread ?? 0}
    />
  );
}
