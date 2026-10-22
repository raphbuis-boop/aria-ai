import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";

vi.mock("@/lib/sms/conversation", () => ({
  draftFirstTouchSms: vi.fn(async () => "Hi Dana, this is Aria for Sam. What are you looking for? Reply STOP to opt out."),
}));
vi.mock("@/lib/sms/outbound", () => ({
  sendClientSms: vi.fn(async () => ({ ok: true, activityId: "act-1", sid: "SM1" })),
}));

const { ingestLead, sendFirstTouch } = await import("@/lib/sms/lead");
const { sendClientSms } = await import("@/lib/sms/outbound");

const AGENT = "agent-1";

function lead(overrides: Record<string, unknown> = {}) {
  return {
    agentId: AGENT,
    source: "zillow" as const,
    name: "Dana Buyer",
    phone: "(201) 555-0142",
    email: "dana@example.com",
    message: "Is 14 Elm still available?",
    ...overrides,
  };
}

describe("lead SMS consent", () => {
  beforeEach(() => {
    process.env.ARIA_SMS_ENABLED = "1";
    vi.mocked(sendClientSms).mockClear();
  });
  afterEach(() => {
    delete process.env.ARIA_SMS_ENABLED;
  });

  it("creates but never texts a lead whose source didn't say it consented", async () => {
    const { client, db } = fakeSupabase({ agent_profiles: [{ id: AGENT, full_name: "Sam Agent" }] });
    const result = await ingestLead(client, lead());

    expect(result.created).toBe(true);
    expect(result.firstText).toMatchObject({ ok: false, error: expect.stringMatching(/consent/i) });
    expect(sendClientSms).not.toHaveBeenCalled();
    expect(db.clients[0]).toMatchObject({ phone: "+12015550142", status: "new" });
    expect(db.activities[0].metadata).toMatchObject({ kind: "lead_intake", sms_consent: false });
  });

  it("texts a consenting lead and marks them contacted", async () => {
    const { client, db } = fakeSupabase({ agent_profiles: [{ id: AGENT, full_name: "Sam Agent" }] });
    const result = await ingestLead(client, lead({ autoText: true }));

    expect(result.firstText).toMatchObject({ ok: true });
    expect(sendClientSms).toHaveBeenCalledOnce();
    expect(db.clients[0].status).toBe("contacted");
    expect(db.activities[0].metadata).toMatchObject({ sms_consent: true });
  });

  it("doesn't text anyone while Aria texting is off", async () => {
    delete process.env.ARIA_SMS_ENABLED;
    const { client } = fakeSupabase({});
    const result = await ingestLead(client, lead({ autoText: true }));
    expect(result.firstText).toMatchObject({ ok: false, error: expect.stringMatching(/off/i) });
    expect(sendClientSms).not.toHaveBeenCalled();
  });
});

describe("sendFirstTouch (Start Aria on an existing client)", () => {
  beforeEach(() => {
    process.env.ARIA_SMS_ENABLED = "1";
    vi.mocked(sendClientSms).mockClear();
  });
  afterEach(() => {
    delete process.env.ARIA_SMS_ENABLED;
  });

  const existing = { id: "client-1", agent_id: AGENT, name: "Dana Buyer", phone: "+12015550142", sms_opted_out: false, town: "Montclair" };

  it("texts an existing client who has no text thread yet", async () => {
    const { client, db } = fakeSupabase({
      clients: [{ ...existing, status: "new" }],
      agent_profiles: [{ id: AGENT, full_name: "Sam Agent" }],
    });
    const result = await sendFirstTouch(client, existing, { source: "manual" });
    expect(result).toMatchObject({ ok: true });
    expect(sendClientSms).toHaveBeenCalledOnce();
    expect(db.clients[0].status).toBe("contacted");
  });

  it("returns null when the client is already in a text thread", async () => {
    const { client } = fakeSupabase({
      activities: [{ client_id: existing.id, type: "text", body: "hi" }],
    });
    expect(await sendFirstTouch(client, existing, { source: "manual" })).toBeNull();
    expect(sendClientSms).not.toHaveBeenCalled();
  });
});
