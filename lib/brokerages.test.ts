import { describe, expect, it } from "vitest";
import { canManageBrokerage, ensureBrokerage, getBrokerageMembership } from "@/lib/brokerages";
import { fakeSupabase } from "@/test/fake-supabase";

const AGENT = "agent-b";
const OTHER_BROKERAGE = "brokerage-x";

describe("brokerage membership", () => {
  it("never treats agent_profiles.brokerage_id as membership", async () => {
    // The exploit's footprint: B's profile points at someone else's brokerage.
    const { client, db } = fakeSupabase({
      agent_profiles: [{ id: AGENT, full_name: "Agent B", brokerage_id: OTHER_BROKERAGE }],
      brokerages: [{ id: OTHER_BROKERAGE, name: "X", owner_agent_id: "agent-a" }],
      brokerage_members: [{ brokerage_id: OTHER_BROKERAGE, user_id: "agent-a", role: "owner" }],
    });

    expect(await getBrokerageMembership(client, AGENT)).toBeNull();

    const membership = await ensureBrokerage(client, AGENT);
    expect(membership.brokerageId).not.toBe(OTHER_BROKERAGE);
    expect(membership.role).toBe("owner");
    expect(db.brokerages.find((b) => b.id === membership.brokerageId)).toMatchObject({
      name: "Agent B's Brokerage",
      owner_agent_id: AGENT,
    });
    expect(db.agent_profiles[0].brokerage_id).toBe(membership.brokerageId);
  });

  it("returns an existing membership without creating anything", async () => {
    const { client, db } = fakeSupabase({
      brokerage_members: [{ brokerage_id: OTHER_BROKERAGE, user_id: AGENT, role: "agent" }],
    });
    expect(await ensureBrokerage(client, AGENT)).toEqual({ brokerageId: OTHER_BROKERAGE, role: "agent" });
    expect(db.brokerages ?? []).toHaveLength(0);
  });

  it("backs out its own brokerage when a concurrent request won", async () => {
    const { client, db } = fakeSupabase(
      { agent_profiles: [{ id: AGENT, full_name: "Agent B" }] },
      { failInsert: { brokerage_members: { code: "23505", message: "duplicate key" } } },
    );
    // The winner's row appears once our insert has failed.
    const winner = { brokerage_id: "brokerage-winner", user_id: AGENT, role: "owner" };
    const realFrom = client.from.bind(client);
    let membershipReads = 0;
    (client as unknown as { from: typeof realFrom }).from = (table: string) => {
      if (table === "brokerage_members" && ++membershipReads === 3) db.brokerage_members.push(winner);
      return realFrom(table);
    };

    expect(await ensureBrokerage(client, AGENT)).toEqual({ brokerageId: "brokerage-winner", role: "owner" });
    expect(db.brokerages).toHaveLength(0);
  });

  it("lets only owners and admins manage", () => {
    expect(canManageBrokerage("owner")).toBe(true);
    expect(canManageBrokerage("admin")).toBe(true);
    expect(canManageBrokerage("agent")).toBe(false);
  });
});
