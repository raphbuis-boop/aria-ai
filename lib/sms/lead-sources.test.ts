import { describe, expect, it } from "vitest";
import { clientSourceFor, normalizeLeadSource, parseLeadPayload, parseMetaLead } from "@/lib/sms/lead-sources";

describe("normalizeLeadSource", () => {
  it("maps aliases and falls back to other", () => {
    expect(normalizeLeadSource("Zillow")).toBe("zillow");
    expect(normalizeLeadSource("realtor.com")).toBe("realtor");
    expect(normalizeLeadSource("facebook")).toBe("meta");
    expect(normalizeLeadSource("idx")).toBe("website");
    expect(normalizeLeadSource("carrier pigeon")).toBe("other");
    expect(normalizeLeadSource(undefined)).toBe("other");
  });

  it("maps onto the clients.source vocabulary", () => {
    expect(clientSourceFor("meta")).toBe("facebook");
    expect(clientSourceFor("zillow")).toBe("zillow");
    expect(clientSourceFor("website")).toBe("other");
  });
});

describe("parseLeadPayload", () => {
  it("reads a flat website/partner payload", () => {
    const lead = parseLeadPayload("website", {
      firstName: "Dana",
      lastName: "Buyer",
      phone: "201-555-0142",
      email: "dana@example.com",
      comments: "Love the porch",
      budget: "$850k",
      address: "14 Elm St",
      city: "Montclair",
      leadId: 77,
    });
    expect(lead).toEqual({
      name: "Dana Buyer",
      phone: "201-555-0142",
      email: "dana@example.com",
      message: "Love the porch",
      town: "Montclair",
      budgetMax: 850_000,
      propertyAddress: "14 Elm St, Montclair",
      providerEventId: "77",
    });
  });

  it("reads Zillow's nested contact and listing blocks", () => {
    const lead = parseLeadPayload("zillow", {
      zillowLeadId: "Z-1",
      consumer: { name: "Pat Lee", phone: "(973) 555-0199", email: "pat@example.com" },
      property: { address: "9 Oak Ave", city: "Summit", listPrice: 1_250_000 },
      message: "Tour Saturday?",
    });
    expect(lead).toMatchObject({
      name: "Pat Lee",
      phone: "(973) 555-0199",
      town: "Summit",
      budgetMax: 1_250_000,
      propertyAddress: "9 Oak Ave, Summit",
      providerEventId: "Z-1",
      message: "Tour Saturday?",
    });
  });

  it("reads Realtor.com's lead envelope", () => {
    const lead = parseLeadPayload("realtor", {
      lead: {
        leadGuid: "R-9",
        contact: { firstName: "Sam", lastName: "Ortiz", phone: "9085550100" },
        listing: { address: "3 Pine Rd", city: "Westfield", price: "1.1M" },
      },
    });
    expect(lead).toMatchObject({
      name: "Sam Ortiz",
      phone: "9085550100",
      town: "Westfield",
      budgetMax: 1_100_000,
      propertyAddress: "3 Pine Rd, Westfield",
      providerEventId: "R-9",
    });
  });

  it("ignores unusable budgets instead of guessing", () => {
    expect(parseLeadPayload("website", { name: "A", budget: "flexible" }).budgetMax).toBeNull();
    expect(parseLeadPayload("website", { name: "A", budget: -5 }).budgetMax).toBeNull();
  });

  it("reads Meta Lead Ads field_data", () => {
    const lead = parseMetaLead({
      id: "M-3",
      field_data: [
        { name: "full_name", values: ["Lee Park"] },
        { name: "phone_number", values: ["+12015550111"] },
        { name: "email", values: ["lee@example.com"] },
      ],
    });
    expect(lead).toMatchObject({ name: "Lee Park", phone: "+12015550111", email: "lee@example.com", providerEventId: "M-3" });
  });
});
