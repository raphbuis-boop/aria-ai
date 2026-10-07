import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { importClients, MAX_IMPORT_ROWS, type ImportGroup } from "@/lib/client-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/clients/import  { rows, group?: "leads" | "sphere", source? }
 * CSV (and any other client-side source) import. Normalizes, de-dupes and
 * reports per row — see lib/client-import.ts.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { rows?: unknown; group?: unknown; source?: unknown };
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `That file has ${rows.length} rows — the limit is ${MAX_IMPORT_ROWS} per import. Split it and import in parts.` },
      { status: 400 },
    );
  }
  const group: ImportGroup = body.group === "sphere" ? "sphere" : "leads";

  try {
    const result = await importClients(supabase, user.id, rows, {
      group,
      defaultSource: typeof body.source === "string" && body.source ? body.source : group === "sphere" ? "sphere" : "csv_import",
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[clients/import] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Import failed. Nothing was changed — try again." }, { status: 500 });
  }
}
