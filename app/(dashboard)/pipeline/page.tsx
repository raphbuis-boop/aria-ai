import { BackButton } from "@/components/BackButton";
import { PipelineBoard } from "@/components/PipelineBoard";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney } from "@/lib/utils";

export default async function PipelinePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: clients } = await supabase
    .from("clients")
    .select(
      "id, name, town, budget_min, budget_max, lead_score, status, last_engagement_at",
    )
    .eq("agent_id", user.id);

  const total = (clients ?? []).reduce((s, c) => s + (c.budget_max ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6">
      <BackButton href="/dashboard" className="mb-4" />
      <header className="flex items-center justify-between gap-2">
        <div className="text-[20px] font-medium text-text-primary">Pipeline</div>
        <div className="text-[16px] font-medium text-accent-blue">
          {fmtMoney(total)}
        </div>
      </header>
      <div className="mt-6">
        <PipelineBoard initial={clients ?? []} />
      </div>
    </div>
  );
}
