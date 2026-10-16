import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Every table holding an agent's CRM data, each listed before any table it
 * references (showings → tasks, client_deals → transactions, everything →
 * clients / properties), so the wipe works whether or not a foreign key
 * cascades — prod's core tables were made in the dashboard, where FKs
 * default to NO ACTION. Each delete has an explicit agent filter: this runs
 * with the service role, so the filter (not RLS) keeps it to the caller's
 * own rows.
 *
 * Kept on purpose: agent_profiles (name, voice, tone, signature, settings),
 * gmail_integrations (Google connection), brokerages and
 * brokerage_bba_templates (the agent's uploaded agreement templates) —
 * setup, not CRM data.
 */
const AGENT_TABLES = [
  "notifications",
  "dismissed_opportunities",
  "client_engagement_events",
  "user_saved_properties",
  "idx_listing_inquiries",
  "activities",
  "property_matches",
  "showings",
  "tasks",
  "client_deals",
  "client_documents",
  "buyer_broker_agreements",
  "transactions",
  "listings",
  "clients",
  "properties",
] as const;

/**
 * Rows that hang off a client or property. Swept by client_id / property_id
 * when the parent won't delete, so a child saved under another (or no)
 * agent_id can't block the wipe.
 */
const CHILDREN: Record<string, [column: string, tables: string[]]> = {
  clients: [
    "client_id",
    ["activities", "property_matches", "client_engagement_events", "showings", "tasks", "client_deals", "client_documents", "buyer_broker_agreements", "transactions"],
  ],
  properties: ["property_id", ["property_matches"]],
};

/** PostgREST/Postgres codes for a table or column this database doesn't have — nothing there to clear. */
const MISSING = new Set(["PGRST205", "42P01", "42703"]);
/** Ids per request: keeps URLs short and each statement well under Supabase's 8s statement timeout. */
const CHUNK = 100;
const PAGE = 1000;

export type WipeResult = {
  deleted: Record<string, number>;
  filesRemoved: number;
  /** Tables / buckets this deployment doesn't have. */
  skipped: string[];
  /** What couldn't be cleared, with the database or storage error. Empty on success. */
  failed: { target: string; error: string }[];
};

/**
 * Deletes all of one agent's CRM data and uploaded files. Each table and
 * bucket is attempted on its own, so one failure doesn't stop the rest, and
 * the whole thing is safe to re-run.
 */
export async function wipeAgentData(admin: SupabaseClient, agentId: string): Promise<WipeResult> {
  const deleted: Record<string, number> = {};
  const skipped = new Set<string>();

  /** Deletes rows of `table` whose `column` is one of `values`. Returns the error, or null when done. */
  async function remove(table: string, column: string, values: string[]): Promise<string | null> {
    for (let i = 0; i < values.length; i += CHUNK) {
      const { error, count } = await admin.from(table).delete({ count: "exact" }).in(column, values.slice(i, i + CHUNK));
      if (error && MISSING.has(error.code)) {
        skipped.add(table);
        return null;
      }
      if (error) return error.message;
      deleted[table] = (deleted[table] ?? 0) + (count ?? 0);
    }
    return null;
  }

  /** A client/property that won't delete: clear what points at it, then delete in batches. */
  async function removeParent(table: string): Promise<string | null> {
    const [column, children] = CHILDREN[table];
    const ids = await agentColumn(admin, table, "id", agentId);
    if (typeof ids === "string") return ids;
    let failure: string | null = null;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = ids.slice(i, i + CHUNK);
      for (const child of children) await remove(child, column, batch);
      failure = (await remove(table, "id", batch)) ?? failure;
    }
    return failure;
  }

  // Storage paths first: once the rows are gone, so is the record of these files.
  const docPaths = await agentColumn(admin, "client_documents", "storage_path", agentId);
  const bbaPaths = await agentColumn(admin, "buyer_broker_agreements", "signed_storage_path", agentId);

  let pending = [
    ...AGENT_TABLES.map((table) => ({ table, column: "agent_id", error: "" })),
    { table: "referrals", column: "from_agent_id", error: "" },
    { table: "referrals", column: "to_agent_id", error: "" },
  ];
  // Later passes retry whatever an FK we don't know about blocked, once the rows it pointed at are gone.
  for (let pass = 0; pass < 3 && pending.length; pass++) {
    const failing: typeof pending = [];
    for (const step of pending) {
      let error = await remove(step.table, step.column, [agentId]);
      if (error && CHILDREN[step.table]) error = await removeParent(step.table);
      if (error) failing.push({ ...step, error });
    }
    const stuck = failing.length === pending.length;
    pending = failing;
    if (stuck) break;
  }
  const failed = pending.map(({ table, error }) => ({ target: table, error }));
  const failedTables = new Set(pending.map((s) => s.table));

  // Files go only once their rows have, so a partial wipe never leaves rows pointing at nothing.
  const buckets: [bucket: string, table: string, paths: () => Promise<string[]>][] = [
    // Uploads are keyed `${agentId}/${clientId}/…`; listing the folder also catches files whose
    // rows an earlier, interrupted reset already deleted.
    ["client-documents", "client_documents", async () => [...asList(docPaths), ...(await listFiles(admin, "client-documents", agentId))]],
    // Signed agreements live at `${brokerageId}/signed/…` next to the templates, which stay.
    ["bba-templates", "buyer_broker_agreements", async () => [...asList(bbaPaths), ...(await unreferencedSignedBbas(admin, agentId))]],
    // Listing photos: `${agentId}/listings/…`.
    ["files", "listings", () => listFiles(admin, "files", `${agentId}/listings`)],
  ];
  let filesRemoved = 0;
  for (const [bucket, table, paths] of buckets) {
    if (failedTables.has(table)) continue;
    try {
      const unique = [...new Set(await paths())];
      for (let i = 0; i < unique.length; i += CHUNK) {
        const { data, error } = await admin.storage.from(bucket).remove(unique.slice(i, i + CHUNK));
        if (error) throw error;
        filesRemoved += data?.length ?? 0;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/bucket not found/i.test(message)) skipped.add(bucket);
      else failed.push({ target: `${bucket} files`, error: message });
    }
  }

  return { deleted, filesRemoved, skipped: [...skipped], failed };
}

/** Every non-empty `column` value of the agent's rows in `table` (paged past the 1000-row cap), or the error. */
async function agentColumn(admin: SupabaseClient, table: string, column: string, agentId: string): Promise<string[] | string> {
  const values: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(table).select(column).eq("agent_id", agentId).order("id").range(from, from + PAGE - 1);
    if (error) return MISSING.has(error.code) ? values : error.message;
    const rows = (data ?? []) as unknown as Record<string, string | null>[];
    for (const row of rows) if (row[column]) values.push(row[column] as string);
    if (rows.length < PAGE) return values;
  }
}

/** Paths from agentColumn; a lookup that failed contributes none (folder listings still find the files). */
function asList(values: string[] | string): string[] {
  return typeof values === "string" ? [] : values;
}

/** Every file under `folder`, recursively. */
async function listFiles(admin: SupabaseClient, bucket: string, folder: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: PAGE, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = `${folder}/${item.name}`;
      // Folders come back without an id.
      paths.push(...(item.id ? [path] : await listFiles(admin, bucket, path)));
    }
    if ((data ?? []).length < PAGE) return paths;
  }
}

/** Signed agreements in the agent's own brokerage folder that no remaining agreement row points at. */
async function unreferencedSignedBbas(admin: SupabaseClient, agentId: string): Promise<string[]> {
  const { data: owned, error } = await admin.from("brokerages").select("id").eq("owner_agent_id", agentId);
  if (error && !MISSING.has(error.code)) throw new Error(error.message);
  const paths = (await Promise.all((owned ?? []).map((b) => listFiles(admin, "bba-templates", `${b.id}/signed`)))).flat();
  const referenced = new Set<string>();
  for (let i = 0; i < paths.length; i += CHUNK) {
    const { data, error: lookupError } = await admin
      .from("buyer_broker_agreements")
      .select("signed_storage_path")
      .in("signed_storage_path", paths.slice(i, i + CHUNK));
    if (lookupError && !MISSING.has(lookupError.code)) throw new Error(lookupError.message);
    for (const row of data ?? []) referenced.add(row.signed_storage_path as string);
  }
  return paths.filter((p) => !referenced.has(p));
}
