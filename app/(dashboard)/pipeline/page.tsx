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
    <div
      className="min-h-screen w-full pb-[130px]"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.10), transparent),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167,139,250,0.06), transparent),
          #000000
        `,
        color: "#ffffff",
      }}
    >
      <div className="px-5 pt-6">
        <header className="mb-6 flex items-center justify-between gap-2">
          <h1
            className="text-[22px] font-semibold leading-tight"
            style={{ color: "#ffffff", letterSpacing: "-0.02em" }}
          >
            Pipeline
          </h1>
          <span
            className="text-[16px] font-semibold"
            style={{
              background: "linear-gradient(135deg, #3B82F6, #06B6D4)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {fmtMoney(total)}
          </span>
        </header>
        <PipelineBoard initial={clients ?? []} />
      </div>
    </div>
  );
}
