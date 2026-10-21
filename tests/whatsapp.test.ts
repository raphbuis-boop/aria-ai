// WhatsApp coexistence: webhook signature + parsing (payload shapes from
// Meta's webhook reference), the client-only privacy filter, idempotency,
// token encryption, and the "you haven't replied" rule. Fake people only.
// Run: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseWebhook, signatureMatches } from "@/lib/whatsapp/webhook";
import { ingestMessages, waIdToE164 } from "@/lib/whatsapp/ingest";
import { findAwaitingReplies, isRealContact, type ContactRow } from "@/lib/whatsapp/followups";
import { decryptToken, encryptToken } from "@/lib/whatsapp/crypto";
import { renderThread } from "@/lib/whatsapp/thread";

const BUSINESS = "15550100100";
const PHONE_NUMBER_ID = "106540352242922";
const WABA = "102290129340398";
const CLIENT = "12015550134"; // Dana Mockley, a client
const STRANGER = "12015550199";

const envelope = (field: string, value: Record<string, unknown>) => ({
  object: "whatsapp_business_account",
  entry: [{ id: WABA, changes: [{ field, value: { messaging_product: "whatsapp", metadata: { display_phone_number: BUSINESS, phone_number_id: PHONE_NUMBER_ID }, ...value } }] }],
});

test("signature: HMAC-SHA256 of the raw body with the app secret", () => {
  const body = JSON.stringify(envelope("messages", {}));
  const sig = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
  assert.equal(signatureMatches(body, sig, "s3cret"), true);
  assert.equal(signatureMatches(body, sig, "other"), false);
  assert.equal(signatureMatches(body + " ", sig, "s3cret"), false);
  assert.equal(signatureMatches(body, null, "s3cret"), false);
  assert.equal(signatureMatches(body, "sha1=abc", "s3cret"), false);
});

test("messages: client → business text, contacts and statuses", () => {
  const [c] = parseWebhook(
    envelope("messages", {
      contacts: [{ profile: { name: "Dana Mockley" }, wa_id: CLIENT }],
      messages: [{ from: CLIENT, id: "wamid.IN1", timestamp: "1749416383", type: "text", text: { body: "Is Saturday still good?" } }],
      statuses: [{ id: "wamid.X", status: "delivered", timestamp: "1749416390", recipient_id: CLIENT }],
    }),
  );
  assert.equal(c.field, "messages");
  assert.equal(c.phoneNumberId, PHONE_NUMBER_ID);
  assert.equal(c.wabaId, WABA);
  assert.deepEqual(c.messages, [
    { id: "wamid.IN1", direction: "inbound", counterpart: "+12015550134", at: new Date(1749416383 * 1000).toISOString(), type: "text", text: "Is Saturday still good?", source: "message" },
  ]);
});

test("messages: captions, numeric timestamps, group messages ignored", () => {
  const [c] = parseWebhook(
    envelope("messages", {
      messages: [
        { from: CLIENT, id: "wamid.IMG", timestamp: 1749416400, type: "image", image: { caption: "The kitchen", id: "m1", mime_type: "image/jpeg", sha256: "x" } },
        { from: CLIENT, id: "wamid.GRP", group_id: "120363", timestamp: "1749416401", type: "text", text: { body: "group chatter" } },
        { from: CLIENT, id: "wamid.AUD", timestamp: "1749416402", type: "audio", audio: { id: "m2", mime_type: "audio/ogg", voice: true } },
      ],
    }),
  );
  assert.deepEqual(
    c.messages.map((m) => [m.id, m.type, m.text]),
    [
      ["wamid.IMG", "image", "The kitchen"],
      ["wamid.AUD", "audio", null],
    ],
  );
});

test("smb_message_echoes: her messages from the WhatsApp Business app are outbound to `to`", () => {
  const [c] = parseWebhook(
    envelope("smb_message_echoes", {
      message_echoes: [{ from: BUSINESS, to: CLIENT, id: "wamid.OUT1", timestamp: "1739321024", type: "text", text: { body: "Yes — 11am!" } }],
    }),
  );
  assert.equal(c.messages[0].direction, "outbound");
  assert.equal(c.messages[0].counterpart, "+12015550134");
  assert.equal(c.messages[0].source, "echo");
});

test("edits and revokes (coexistence)", () => {
  const [c] = parseWebhook(
    envelope("smb_message_echoes", {
      message_echoes: [
        { from: BUSINESS, to: CLIENT, id: "wamid.E", timestamp: "1739321100", type: "edit", edit: { original_message_id: "wamid.OUT1", message: { type: "text", text: { body: "Yes — 11:30!" } } } },
        { from: BUSINESS, to: CLIENT, id: "wamid.R", timestamp: "1739321200", type: "revoke", revoke: { original_message_id: "wamid.OUT0" } },
      ],
    }),
  );
  assert.deepEqual(c.edits, [{ originalId: "wamid.OUT1", text: "Yes — 11:30!", type: "text" }]);
  assert.deepEqual(c.revokes, ["wamid.OUT0"]);
});

test("history: threads with both directions, progress, and the declined error", () => {
  const [c] = parseWebhook(
    envelope("history", {
      history: [
        {
          metadata: { phase: 1, chunk_order: 2, progress: 55 },
          threads: [
            {
              id: CLIENT,
              messages: [
                { from: CLIENT, id: "wamid.H1", timestamp: "1739230955", type: "text", text: { body: "Hi! Saw your listing" }, history_context: { status: "READ" } },
                { from: BUSINESS, to: CLIENT, id: "wamid.H2", timestamp: "1739230970", type: "text", text: { body: "Happy to help" }, history_context: { status: "READ" } },
                { from: BUSINESS, id: "wamid.H3", timestamp: "1739230980", type: "media_placeholder", history_context: { status: "PLAYED" } },
              ],
            },
          ],
        },
      ],
    }),
  );
  assert.deepEqual(c.history, { declined: false, progress: 55 });
  assert.deepEqual(
    c.messages.map((m) => [m.id, m.direction, m.counterpart, m.source]),
    [
      ["wamid.H1", "inbound", "+12015550134", "history"],
      ["wamid.H2", "outbound", "+12015550134", "history"],
      ["wamid.H3", "outbound", "+12015550134", "history"],
    ],
  );

  const [declined] = parseWebhook(
    envelope("history", { history: [{ errors: [{ code: 2593109, title: "History sync is turned off by the business from the WhatsApp Business App" }] }] }),
  );
  assert.deepEqual(declined.history, { declined: true, progress: null });
});

test("account_update and ignored fields", () => {
  const changes = parseWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: WABA,
        time: 1739212624,
        changes: [
          { field: "account_update", value: { phone_number: BUSINESS, event: "PARTNER_REMOVED", disconnection_info: { reason: "PRIMARY_INACTIVITY", initiated_by: "SYSTEM" } } },
          { field: "smb_app_state_sync", value: { state_sync: [{ type: "contact", contact: { full_name: "Lee Fakeworth", phone_number: STRANGER }, action: "add" }] } },
        ],
      },
    ],
  });
  assert.equal(changes.length, 1, "contact-book sync is never read");
  assert.deepEqual(changes[0].account, { event: "PARTNER_REMOVED", reason: "PRIMARY_INACTIVITY", wabaId: null });
  assert.deepEqual(parseWebhook({ object: "page", entry: [] }), []);
});

test("wa_id → E.164", () => {
  assert.equal(waIdToE164("12015550134"), "+12015550134");
  assert.equal(waIdToE164("+44 7700 900123"), "+447700900123");
  assert.equal(waIdToE164("123"), null);
  assert.equal(waIdToE164(undefined), null);
});

// ── Privacy + idempotency, against an in-memory stand-in for Supabase ────────

type Row = Record<string, unknown>;
function fakeSupabase(clients: { id: string; phones: string[] }[]) {
  const tables: Record<string, Row[]> = { activities: [], whatsapp_unknown_senders: [], clients: clients.map((c) => ({ ...c, agent_id: "agent-1", last_engagement_at: null, last_inbound_at: null, drip_paused_at: null })) };
  const writes: { table: string; op: string; payload: unknown }[] = [];
  function from(table: string) {
    let op = "select";
    let payload: unknown = null;
    const filters: [string, string, unknown][] = [];
    const run = (): { data: unknown; error: { code?: string; message: string } | null } => {
      const rows = tables[table] ?? [];
      const match = (r: Row) =>
        filters.every(([kind, k, v]) =>
          kind === "eq" ? r[k] === v : kind === "in" ? (v as unknown[]).includes(r[k]) : kind === "overlaps" ? ((r[k] as string[]) ?? []).some((p) => (v as string[]).includes(p)) : kind === "isnull" ? r[k] == null : true,
        );
      if (op === "select") return { data: rows.filter(match), error: null };
      writes.push({ table, op, payload });
      if (op === "insert") {
        const list = (Array.isArray(payload) ? payload : [payload]) as Row[];
        if (list.some((r) => r.external_id && rows.some((x) => x.external_id === r.external_id))) return { data: null, error: { code: "23505", message: "duplicate" } };
        rows.push(...list);
        return { data: null, error: null };
      }
      if (op === "upsert") {
        rows.push(payload as Row);
        return { data: null, error: null };
      }
      if (op === "update") {
        rows.filter(match).forEach((r) => Object.assign(r, payload as Row));
        return { data: null, error: null };
      }
      return { data: null, error: null };
    };
    const b = {
      select: () => b,
      eq: (k: string, v: unknown) => (filters.push(["eq", k, v]), b),
      in: (k: string, v: unknown) => (filters.push(["in", k, v]), b),
      overlaps: (k: string, v: unknown) => (filters.push(["overlaps", k, v]), b),
      is: (k: string, v: unknown) => (v === null && !k.includes("->") ? filters.push(["isnull", k, v]) : 0, b),
      gte: () => b, lte: () => b, lt: () => b, gt: () => b, neq: () => b, order: () => b, limit: () => b,
      insert: (p: unknown) => ((op = "insert"), (payload = p), b),
      upsert: (p: unknown) => ((op = "upsert"), (payload = p), b),
      update: (p: unknown) => ((op = "update"), (payload = p), b),
      delete: () => ((op = "delete"), b),
      maybeSingle: async () => {
        const r = run();
        return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error };
      },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  }
  return { client: { from } as unknown as SupabaseClient, tables, writes };
}

const conn = { agent_id: "agent-1", phone_number_id: PHONE_NUMBER_ID, waba_id: WABA };
const msg = (id: string, counterpart: string, direction: "inbound" | "outbound", source: "message" | "echo" | "history", text = "hello") => ({
  id, counterpart, direction, source, text, type: "text", at: "2026-10-20T15:00:00.000Z",
});

test("privacy: only chats with clients are written; strangers leave a number + first line card only when they message live", async () => {
  const db = fakeSupabase([{ id: "client-dana", phones: ["+12015550134"] }]);
  const result = await ingestMessages(db.client, conn, [
    msg("wamid.A", "+12015550134", "inbound", "message", "Is Saturday still good?\nAlso, parking?"),
    msg("wamid.B", "+12015550199", "inbound", "message", "Hi, who is this?\nSecond line stays private"),
    msg("wamid.C", "+12015550199", "outbound", "echo", "her reply to a stranger"),
    msg("wamid.D", "+12015550188", "inbound", "history", "old chat with a non-client"),
  ]);
  assert.equal(result.stored, 1);
  assert.equal(result.dropped, 3);
  assert.equal(result.unknownCards, 1);

  assert.equal(db.tables.activities.length, 1);
  assert.equal(db.tables.activities[0].client_id, "client-dana");
  assert.equal(db.tables.activities[0].external_id, "wa:wamid.A");
  assert.equal(db.tables.activities[0].type, "whatsapp");

  // Nothing about the strangers anywhere except the one card.
  const written = JSON.stringify(db.writes.filter((w) => w.table !== "whatsapp_unknown_senders"));
  for (const secret of ["+12015550199", "+12015550188", "who is this", "her reply to a stranger", "old chat"]) {
    assert.ok(!written.includes(secret), `leaked ${secret}`);
  }
  assert.deepEqual(
    db.tables.whatsapp_unknown_senders.map((c) => [c.phone, c.first_line]),
    [["+12015550199", "Hi, who is this?"]],
  );

  // Client replied live: replied + drip stopped.
  const dana = db.tables.clients[0];
  assert.equal(dana.last_inbound_at, "2026-10-20T15:00:00.000Z");
  assert.equal(dana.last_engagement_at, "2026-10-20T15:00:00.000Z");
  assert.ok(dana.drip_paused_at);
});

test("idempotent on message id: retries and history overlap store once", async () => {
  const db = fakeSupabase([{ id: "client-dana", phones: ["+12015550134"] }]);
  await ingestMessages(db.client, conn, [msg("wamid.A", "+12015550134", "inbound", "message")]);
  const again = await ingestMessages(db.client, conn, [
    msg("wamid.A", "+12015550134", "inbound", "history"),
    msg("wamid.A", "+12015550134", "inbound", "message"),
  ]);
  assert.equal(again.stored, 0);
  assert.equal(again.duplicates, 2);
  assert.equal(db.tables.activities.length, 1);
});

test("history doesn't stop the drip; reactions and unsupported types are dropped", async () => {
  const db = fakeSupabase([{ id: "client-dana", phones: ["+12015550134"] }]);
  await ingestMessages(db.client, conn, [
    msg("wamid.H", "+12015550134", "inbound", "history"),
    { ...msg("wamid.R", "+12015550134", "inbound", "message"), type: "reaction" },
    { ...msg("wamid.U", "+12015550134", "inbound", "message"), type: "unsupported" },
  ]);
  assert.equal(db.tables.activities.length, 1);
  assert.equal(db.tables.clients[0].drip_paused_at, null);
  assert.equal(db.tables.clients[0].last_inbound_at, "2026-10-20T15:00:00.000Z");
});

// ── "Client messaged you, you haven't replied" ──────────────────────────────

const row = (client_id: string, type: string, direction: string, hoursAgo: number, extra: Partial<ContactRow> = {}): ContactRow => ({
  client_id,
  type,
  direction,
  body: `${type} ${direction}`,
  ai_draft: false,
  sent: true,
  created_at: new Date(Date.parse("2026-10-21T12:00:00Z") - hoursAgo * 3_600_000).toISOString(),
  ...extra,
});
const NOW = new Date("2026-10-21T12:00:00Z");

test("awaiting reply: unanswered WhatsApp past the threshold, counted from the first unanswered message", () => {
  const rows = [
    row("dana", "whatsapp", "outbound", 30),
    row("dana", "whatsapp", "inbound", 6, { body: "Is Saturday still good?\nAlso…" }),
    row("dana", "whatsapp", "inbound", 2, { body: "Hello?" }),
  ];
  assert.deepEqual(findAwaitingReplies(rows, 4, NOW), [{ clientId: "dana", since: rows[1].created_at, preview: "Hello?" }]);
  assert.deepEqual(findAwaitingReplies(rows, 8, NOW), [], "not yet past 8 hours");
});

test("awaiting reply: her echo, a text or a call clears it; unsent drafts and notes don't", () => {
  const base = [row("dana", "whatsapp", "inbound", 10)];
  assert.equal(findAwaitingReplies([...base, row("dana", "whatsapp", "outbound", 1)], 4, NOW).length, 0);
  assert.equal(findAwaitingReplies([...base, row("dana", "sms", "outbound", 1)], 4, NOW).length, 0);
  assert.equal(findAwaitingReplies([...base, row("dana", "call", "outbound", 1)], 4, NOW).length, 0);
  assert.equal(findAwaitingReplies([...base, row("dana", "text", "outbound", 1, { ai_draft: true, sent: false })], 4, NOW).length, 1);
  assert.equal(findAwaitingReplies([...base, row("dana", "note", "outbound", 1)], 4, NOW).length, 1);
  assert.equal(findAwaitingReplies([row("dana", "text", "inbound", 10)], 4, NOW).length, 0, "SMS replies are handled in the Aria thread");
  assert.equal(isRealContact({ type: "automation", direction: "outbound", ai_draft: true, sent: false }), false);
});

test("token encryption round-trips and is tamper-evident", () => {
  process.env.WHATSAPP_TOKEN_KEY = randomBytes(32).toString("base64");
  const sealed = encryptToken("EAAG-fake-business-token");
  assert.ok(!sealed.includes("EAAG"));
  assert.equal(decryptToken(sealed), "EAAG-fake-business-token");
  const [v, iv, tag, data] = sealed.split(".");
  const flipped = `${v}.${iv}.${tag}.${data.slice(0, -2)}${data.endsWith("AA") ? "BA" : "AA"}`;
  assert.throws(() => decryptToken(flipped));
});

test("thread rendering for the reply prompt", () => {
  const text = renderThread(
    [
      { id: "1", direction: "inbound", body: "Is Saturday\nstill good?", created_at: "2026-10-20T15:00:00.000Z", mediaType: null },
      { id: "2", direction: "outbound", body: null, created_at: "2026-10-20T15:05:00.000Z", mediaType: "image" },
    ],
    "Dana",
  );
  assert.match(text, /^Dana \(Oct 20, 11:00 AM\): Is Saturday still good\?\nAgent \(Oct 20, 11:05 AM\): \[Photo\]$/);
});
