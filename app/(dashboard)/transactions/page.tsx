import { createClient } from "@/lib/supabase/server";
import { TransactionsClient } from "./transactions-client";

export default async function TransactionsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: txs } = await supabase
    .from("transactions")
    .select("*, clients(name)")
    .eq("agent_id", user.id)
    .order("closing_date", { ascending: true });

  return <TransactionsClient initial={txs ?? []} />;
}
