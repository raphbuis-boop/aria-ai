import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionsClient } from "../transactions-client";

export default async function TransactionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated → treat as not found (no redirect leak)
  if (!user) notFound();

  const { data: tx } = await supabase
    .from("transactions")
    .select("*, clients(name)")
    .eq("id", params.id)
    .eq("agent_id", user.id) // ← multi-tenant safety: only this agent's record
    .maybeSingle();

  // notFound() covers both "doesn't exist" and "owned by another agent" — same response, no info leak
  if (!tx) notFound();

  return <TransactionsClient initial={[tx]} />;
}
