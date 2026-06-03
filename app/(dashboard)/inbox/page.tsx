import { createClient } from "@/lib/supabase/server";
import { InboxClient } from "./inbox-client";

export default async function InboxPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: rows }, { data: gmailRow }] = await Promise.all([
    // Fetch full activity history — no filter exclusion.
    // The Conversations view groups by client and shows full thread history.
    supabase
      .from("activities")
      .select(
        `
        id,
        type,
        direction,
        body,
        created_at,
        ai_draft,
        approved,
        sent,
        client_id,
        clients ( name, phone, email, lead_score )
      `,
      )
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),

    supabase
      .from("gmail_integrations")
      .select("email")
      .eq("agent_id", user.id)
      .maybeSingle(),
  ]);

  type ClientJoin = {
    name: string | null;
    phone: string | null;
    email: string | null;
    lead_score: number | null;
  };

  const initial = (rows ?? []).map((r) => {
    const c = r.clients as ClientJoin | ClientJoin[] | null;
    const client = Array.isArray(c) ? c[0] : c;
    return { ...r, clients: client ?? null };
  });

  const gmailStatus = gmailRow
    ? { connected: true, email: gmailRow.email as string | null }
    : { connected: false, email: null };

  return <InboxClient initial={initial} gmailStatus={gmailStatus} />;
}
