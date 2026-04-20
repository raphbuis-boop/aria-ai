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
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-28">
      <div className="px-5 pt-6 flex items-center justify-between mb-2">
        <div className="text-[26px] font-semibold text-white">Pipeline</div>
        <div className="text-[#4f7bff] font-semibold text-sm">
          {fmtMoney(total)}
        </div>
      </div>
      <div className="mt-4">
        <PipelineBoard initial={clients ?? []} />
      </div>
    </div>
  );
}
