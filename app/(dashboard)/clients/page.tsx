import { createClient } from "@/lib/supabase/server";
import { ClientsPageClient } from "./clients-client";

export default async function ClientsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("agent_id", user.id)
    .order("last_engagement_at", { ascending: false });

  return <ClientsPageClient initial={clients ?? []} />;
}
