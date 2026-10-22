import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";

vi.mock("@/lib/sms/conversation", () => ({
  draftFirstTouchSms: vi.fn(async () => "Hi Dana, this is Aria for Sam. What are you looking for? Reply STOP to opt out."),
}));
vi.mock("@/lib/sms/outbound", () => ({
  sendClientSms: vi.fn(async () => ({ ok: true, activityId: "act-1", sid: "SM1" })),
}));
vi.mock("@/lib/resend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/resend")>()),
  sendEmail: vi.fn(async () => {}),
}));

const { ingestLead, sendFirstTouch } = await import("@/lib/sms/lead");
const { sendClientSms } = await import("@/lib/sms/outbound");
const { sendEmail } = await import("@/lib/resend");

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
    const { client, db } = fakeSupabase({ agent_profiles: [{ id: AGENT, full_name: "Sam Agent", email: "sam@brokerage.test" }] });
    const result = await ingestLead(client, lead());

    expect(result.created).toBe(true);
    expect(result.firstText).toMatchObject({ ok: false, error: expect.stringMatching(/consent/i) });
    expect(sendClientSms).not.toHaveBeenCalled();
    expect(db.clients[0]).toMatchObject({ phone: "+12015550142", status: "new" });
    expect(db.activities[0].metadata).toMatchObject({ kind: "lead_intake", sms_consent: false });
  });

  it("texts a consenting lead and marks them contacted", async () => {
    const { client, db } = fakeSupabase({ agent_profiles: [{ id: AGENT, full_name: "Sam Agent", email: "sam@brokerage.test" }] });
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

describe("new lead alerts", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear();
  });

  it("emails the agent a link to the lead the moment it arrives", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example");
    const { client, db } = fakeSupabase({ agent_profiles: [{ id: AGENT, full_name: "Sam Agent", email: "sam@brokerage.test" }] });
    await ingestLead(client, lead());

    expect(sendEmail).toHaveBeenCalledOnce();
    const mail = vi.mocked(sendEmail).mock.calls[0][0];
    expect(mail.to).toBe("sam@brokerage.test");
    expect(mail.subject).toBe("New Zillow lead: Dana Buyer");
    expect(mail.html).toContain(`https://app.example/clients/${db.clients[0].id}`);
    expect(mail.html).toContain("Is 14 Elm still available?");
    vi.unstubAllEnvs();
  });

  it("doesn't email agents about clients they typed in themselves", async () => {
    const { client } = fakeSupabase({ agent_profiles: [{ id: AGENT, full_name: "Sam Agent", email: "sam@brokerage.test" }] });
    await ingestLead(client, lead({ source: "manual" }));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still creates the lead when the alert can't be sent", async () => {
    vi.mocked(sendEmail).mockImplementationOnce(async () => {
      throw new Error("Resend down");
    });
    const { client, db } = fakeSupabase({ agent_profiles: [{ id: AGENT, full_name: "Sam Agent", email: "sam@brokerage.test" }] });
    const result = await ingestLead(client, lead());
    expect(result.created).toBe(true);
    expect(db.clients).toHaveLength(1);
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
      agent_profiles: [{ id: AGENT, full_name: "Sam Agent", email: "sam@brokerage.test" }],
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
