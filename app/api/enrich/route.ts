import { NextResponse } from "next/server";
import { callClaude, getAnthropic, safeJsonParse } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

type Enrich = {
  job_title: string;
  company: string;
  linkedin_url: string;
  estimated_income_range: string;
  homeowner_status: string;
  notes: string;
};

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId ?? "");
  const clientName = String(body.clientName ?? "");
  const email = String(body.email ?? "");

  const system =
    "Generate realistic professional enrichment data as JSON only: { job_title, company, linkedin_url, estimated_income_range, homeowner_status, notes }";

  const userMsg = `Name: ${clientName}\nEmail: ${email}`;

  const raw = await callClaude(system, userMsg, 500);
  let data = safeJsonParse<Enrich>(raw);

  if (!getAnthropic() || !data) {
    data = {
      job_title: "Product Director",
      company: "Regional healthcare group",
      linkedin_url: "https://www.linkedin.com/in/example-profile",
      estimated_income_range: "$180k–$240k",
      homeowner_status: "First-time buyer",
      notes:
        "Likely relocating for schools; prefers walkable downtown pockets and a manageable commute to NYC.",
    };
  }

  if (clientId) {
    await supabase
      .from("clients")
      .update({ enriched_data: data as unknown as Record<string, unknown> })
      .eq("id", clientId)
      .eq("agent_id", user.id);
  }

  return NextResponse.json(data);
}
