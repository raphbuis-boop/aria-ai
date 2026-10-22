import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code?: string; message: string } | null };

/**
 * A small in-memory stand-in for the Supabase query builder, covering the
 * chains our server code uses (select/insert/update/delete/upsert with eq
 * filters, maybeSingle/single). `failInsert` lets a test force a constraint
 * error on a table, e.g. to simulate a concurrent writer.
 */
export function fakeSupabase(
  tables: Record<string, Row[]>,
  opts: { failInsert?: Record<string, { code: string; message: string }> } = {},
) {
  const db = tables;
  let nextId = 1;

  function builder(table: string) {
    db[table] ??= [];
    let op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    let payload: Row | Row[] | null = null;
    let onConflict: string | null = null;
    const filters: Array<(r: Row) => boolean> = [];

    const matching = () => db[table].filter((r) => filters.every((f) => f(r)));

    function run(): Result {
      if (op === "insert") {
        const failure = opts.failInsert?.[table];
        if (failure) return { data: null, error: failure };
        const rows = (Array.isArray(payload) ? payload : [payload!]).map((r) => ({ id: `id-${nextId++}`, ...r }));
        db[table].push(...rows);
        return { data: rows, error: null };
      }
      if (op === "upsert") {
        const key = onConflict ?? "id";
        const rows = Array.isArray(payload) ? payload : [payload!];
        for (const r of rows) {
          const existing = db[table].find((x) => x[key] === r[key]);
          if (existing) Object.assign(existing, r);
          else db[table].push({ ...r });
        }
        return { data: rows, error: null };
      }
      if (op === "update") {
        const rows = matching();
        rows.forEach((r) => Object.assign(r, payload));
        return { data: rows, error: null };
      }
      if (op === "delete") {
        const rows = matching();
        db[table] = db[table].filter((r) => !rows.includes(r));
        return { data: rows, error: null };
      }
      return { data: matching(), error: null };
    }

    const q = {
      select: () => q,
      insert: (row: Row | Row[]) => ((op = "insert"), (payload = row), q),
      update: (row: Row) => ((op = "update"), (payload = row), q),
      delete: () => ((op = "delete"), q),
      upsert: (row: Row | Row[], o?: { onConflict?: string }) => (
        (op = "upsert"), (payload = row), (onConflict = o?.onConflict ?? null), q
      ),
      eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), q),
      maybeSingle: async (): Promise<Result> => {
        const res = run();
        if (res.error) return res;
        const rows = res.data as Row[];
        if (rows.length > 1) return { data: null, error: { code: "PGRST116", message: "multiple rows" } };
        return { data: rows[0] ?? null, error: null };
      },
      single: async (): Promise<Result> => {
        const res = run();
        if (res.error) return res;
        const rows = res.data as Row[];
        if (rows.length !== 1) return { data: null, error: { code: "PGRST116", message: `${rows.length} rows` } };
        return { data: rows[0], error: null };
      },
      then: (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return q;
  }

  const client = { from: (table: string) => builder(table) };
  return { client: client as unknown as SupabaseClient, db };
}
