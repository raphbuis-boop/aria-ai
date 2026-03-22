import { NextResponse } from "next/server";
import { addDays, addWeeks } from "date-fns";
import { getRouteSupabase } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await req.json().catch(() => ({}));

  const base = new Date();
  const closing_date = addWeeks(base, 6).toISOString();
  const inspection_date = addDays(base, 10).toISOString();
  const appraisal_date = addDays(base, 21).toISOString();
  const mortgage_commitment_date = addDays(base, 35).toISOString();

  return NextResponse.json({
    closing_date,
    inspection_date,
    appraisal_date,
    mortgage_commitment_date,
  });
}
