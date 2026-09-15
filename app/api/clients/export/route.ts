import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: clients, error } = await supabase
    .from("clients")
    .select(
      "name, email, phone, town, status, budget_min, budget_max, beds_wanted, baths_wanted, created_at",
    )
    .eq("agent_id", user.id)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const headers = [
    "Name",
    "Email",
    "Phone",
    "Town",
    "Status",
    "Budget min",
    "Budget max",
    "Beds",
    "Baths",
    "Added",
  ];

  const rows = (clients ?? []).map((c) => [
    c.name,
    c.email,
    c.phone,
    c.town,
    c.status,
    c.budget_min,
    c.budget_max,
    c.beds_wanted,
    c.baths_wanted,
    c.created_at ? new Date(c.created_at as string).toISOString().slice(0, 10) : "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");

  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aria-clients-${dateStamp}.csv"`,
    },
  });
}
