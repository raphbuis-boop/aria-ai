import { createHmac, timingSafeEqual } from "node:crypto";
import { waIdToE164, type WaMessage, type WaSource } from "./ingest";

/**
 * Parses WhatsApp Cloud API webhooks for a coexistence number (Aria only
 * receives). Pure — no I/O — so it's tested against Meta's documented
 * payloads (tests/whatsapp.test.ts).
 *
 * Fields handled (developers.facebook.com/documentation/business-messaging/
 * whatsapp/webhooks/reference/…):
 *   messages            value.messages[]        client → business
 *   smb_message_echoes  value.message_echoes[]  business → client, sent from her app
 *   history             value.history[].threads[].messages[] (backfill), or
 *                       value.history[].errors[] (code 2593109: she declined),
 *                       or value.messages / message_echoes (media follow-ups)
 *   account_update      PARTNER_REMOVED, ACCOUNT_OFFBOARDED, ACCOUNT_RECONNECTED, PARTNER_APP_UNINSTALLED
 *   smb_app_state_sync  her contact book — ignored, never stored
 */

/** Meta signs the raw body: X-Hub-Signature-256: sha256=<hex HMAC-SHA256 with the app secret>. */
export function signatureMatches(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"));
  const given = Buffer.from(header.slice(7).toLowerCase());
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const HISTORY_DECLINED_CODE = 2593109;

export type WaEdit = { originalId: string; text: string | null; type: string };

export type ParsedChange = {
  field: string;
  /** entry.id — the WABA for message fields. */
  wabaId: string | null;
  phoneNumberId: string | null;
  messages: WaMessage[];
  edits: WaEdit[];
  /** Original message ids deleted for everyone. */
  revokes: string[];
  history: { declined: boolean; progress: number | null } | null;
  account: { event: string; reason: string | null; wabaId: string | null } | null;
};

type Raw = Record<string, unknown>;
const rec = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v.map(rec) : []);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);
const digits = (v: unknown): string => (str(v) ?? "").replace(/\D/g, "");

/** Unix seconds (string or number) → ISO. */
function isoFromSeconds(v: unknown): string | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

/** Text body or caption — whatever a person would read in the chat. */
export function messageText(m: Raw): string | null {
  const type = str(m.type) ?? "";
  const part = rec(m[type]);
  switch (type) {
    case "text":
      return str(rec(m.text).body);
    case "image":
    case "video":
    case "document":
      return str(part.caption) ?? (type === "document" ? str(part.filename) : null);
    case "button":
      return str(rec(m.button).text);
    case "interactive": {
      const i = rec(m.interactive);
      return str(rec(i.button_reply).title) ?? str(rec(i.list_reply).title);
    }
    case "location":
      return [str(part.name), str(part.address)].filter(Boolean).join(", ") || null;
    case "contacts": {
      const names = arr(m.contacts).map((c) => str(rec(c.name).formatted_name)).filter(Boolean);
      return names.length ? names.join(", ") : null;
    }
    default:
      return null;
  }
}

function toMessage(m: Raw, source: WaSource, direction: "inbound" | "outbound", counterpartRaw: unknown): WaMessage | null {
  // Group chats aren't part of coexistence and are never read.
  if (m.group_id) return null;
  const id = str(m.id);
  const at = isoFromSeconds(m.timestamp);
  const counterpart = waIdToE164(digits(counterpartRaw));
  const type = str(m.type);
  if (!id || !at || !counterpart || !type) return null;
  return { id, direction, counterpart, at, type, text: messageText(m), source };
}

function editsAndRevokes(list: Raw[], out: ParsedChange) {
  for (const m of list) {
    if (m.type === "edit") {
      const e = rec(m.edit);
      const original = str(e.original_message_id);
      const msg = rec(e.message);
      if (original) out.edits.push({ originalId: original, text: messageText(msg), type: str(msg.type) ?? "text" });
    } else if (m.type === "revoke") {
      const original = str(rec(m.revoke).original_message_id);
      if (original) out.revokes.push(original);
    }
  }
}

export function parseWebhook(payload: unknown): ParsedChange[] {
  const body = rec(payload);
  if (body.object !== "whatsapp_business_account") return [];
  const out: ParsedChange[] = [];

  for (const entry of arr(body.entry)) {
    for (const change of arr(entry.changes)) {
      const field = str(change.field) ?? "";
      const value = rec(change.value);
      const metadata = rec(value.metadata);
      const businessNumber = digits(metadata.display_phone_number);
      const parsed: ParsedChange = {
        field,
        wabaId: str(entry.id),
        phoneNumberId: str(metadata.phone_number_id),
        messages: [],
        edits: [],
        revokes: [],
        history: null,
        account: null,
      };

      // With usernames (BSUIDs) `from`/`to` can be missing; a single contact's wa_id still identifies them.
      const contacts = arr(value.contacts);
      const soleWaId = contacts.length === 1 ? contacts[0].wa_id : null;
      const live = (list: Raw[], source: WaSource) => {
        for (const m of list) {
          const msg = toMessage(m, source, "inbound", m.from ?? soleWaId);
          if (msg) parsed.messages.push(msg);
        }
        editsAndRevokes(list, parsed);
      };
      const echoes = (list: Raw[], source: WaSource) => {
        for (const m of list) {
          const msg = toMessage(m, source, "outbound", m.to ?? soleWaId);
          if (msg) parsed.messages.push(msg);
        }
        editsAndRevokes(list, parsed);
      };

      if (field === "messages") {
        live(arr(value.messages), "message");
      } else if (field === "smb_message_echoes") {
        echoes(arr(value.message_echoes), "echo");
      } else if (field === "history") {
        // Media follow-ups for history messages arrive in the live shapes.
        live(arr(value.messages), "history");
        echoes(arr(value.message_echoes), "history");
        for (const h of arr(value.history)) {
          const errors = arr(h.errors);
          if (errors.some((e) => Number(e.code) === HISTORY_DECLINED_CODE)) {
            parsed.history = { declined: true, progress: null };
            continue;
          }
          const progress = Number(rec(h.metadata).progress);
          parsed.history = { declined: false, progress: Number.isFinite(progress) ? progress : (parsed.history?.progress ?? null) };
          for (const thread of arr(h.threads)) {
            const threadUser = digits(thread.id) || digits(rec(thread.context).wa_id);
            for (const m of arr(thread.messages)) {
              const from = digits(m.from);
              // From her number (or carrying "to", which only echoes have) → she sent it.
              const outbound = Boolean(m.to) || (businessNumber !== "" && from === businessNumber);
              const msg = toMessage(m, "history", outbound ? "outbound" : "inbound", outbound ? (threadUser || m.to) : (from || threadUser));
              if (msg) parsed.messages.push(msg);
            }
          }
        }
      } else if (field === "account_update") {
        const event = str(value.event);
        if (event) {
          parsed.account = {
            event,
            reason: str(rec(value.disconnection_info).reason),
            wabaId: str(rec(value.waba_info).waba_id),
          };
        }
      } else {
        // smb_app_state_sync (her contact book) and anything else: not read.
        continue;
      }
      out.push(parsed);
    }
  }
  return out;
}
