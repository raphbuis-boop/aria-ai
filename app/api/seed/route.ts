import { NextResponse } from "next/server";
import { runPropertyMatching } from "@/lib/matchProperties";
import { getRouteSupabase } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Fixed demo-day anchor so dates line up with the investor deck.
// 2026-04-18 is the "today" of the demo story.
const ISO = (y: number, m: number, d: number, h = 12, mm = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, mm)).toISOString();

export async function POST() {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = user.id;

  const { count } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId);

  if ((count ?? 0) > 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: "Already seeded",
    });
  }

  const clientsPayload = [
    {
      agent_id: agentId,
      name: "Mike Rodriguez",
      phone: "+12015550182",
      email: "mike.r@email.com",
      source: "zillow" as const,
      status: "showing" as const,
      lead_score: 9,
      budget_min: 700000,
      budget_max: 850000,
      town: "Ridgewood",
      beds_wanted: 4,
      baths_wanted: 2.5,
      notes: "Wants yard + good schools. Pre-approved.",
      last_engagement_at: ISO(2026, 4, 18, 15, 0),
      automation_day: 0,
    },
    {
      agent_id: agentId,
      name: "Lisa Thompson",
      phone: "+19085550143",
      email: "lisa.t@email.com",
      source: "manual" as const,
      status: "under_contract" as const,
      lead_score: 8,
      budget_min: 780000,
      budget_max: 900000,
      town: "Westfield",
      beds_wanted: 4,
      baths_wanted: 3,
      notes: "Offer accepted — under contract at 55 Elm Court.",
      last_engagement_at: ISO(2026, 4, 17, 19, 0),
      automation_day: 2,
    },
    {
      agent_id: agentId,
      name: "Emily Chen",
      phone: "+19735550199",
      email: "emily.chen@email.com",
      source: "google" as const,
      status: "showing" as const,
      lead_score: 7,
      budget_min: 550000,
      budget_max: 650000,
      town: "Montclair",
      beds_wanted: 3,
      baths_wanted: 2,
      notes: "Commute to NYC matters. First-time buyer.",
      last_engagement_at: ISO(2026, 4, 16, 14, 0),
      automation_day: 1,
    },
    {
      agent_id: agentId,
      name: "James & Sarah Wilson",
      phone: "+19085550321",
      email: "jwilson@email.com",
      source: "referral" as const,
      status: "contacted" as const,
      lead_score: 6,
      budget_min: 900000,
      budget_max: 1100000,
      town: "Summit",
      beds_wanted: 5,
      baths_wanted: 3,
      notes: "Relocating from Brooklyn — two kids, need good schools.",
      last_engagement_at: ISO(2026, 4, 14, 16, 0),
      automation_day: 0,
    },
    {
      agent_id: agentId,
      name: "David Park",
      phone: "+12015550267",
      email: "david.park@email.com",
      source: "facebook" as const,
      status: "new" as const,
      lead_score: 5,
      budget_min: 400000,
      budget_max: 500000,
      town: "Hoboken",
      beds_wanted: 2,
      baths_wanted: 2,
      notes: "First-time buyer; wants low maintenance condo.",
      last_engagement_at: ISO(2026, 4, 13, 10, 0),
      automation_day: 0,
    },
  ];

  const { data: insertedClients, error: cErr } = await supabase
    .from("clients")
    .insert(clientsPayload)
    .select("id, name");

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 400 });
  }

  const byName = Object.fromEntries(
    (insertedClients ?? []).map((c) => [c.name, c.id]),
  ) as Record<string, string>;

  const mike = byName["Mike Rodriguez"];
  const lisa = byName["Lisa Thompson"];
  const emily = byName["Emily Chen"];
  const wilson = byName["James & Sarah Wilson"];
  const david = byName["David Park"];

  const propertiesPayload = [
    {
      agent_id: agentId,
      address: "47 Maple Ave",
      town: "Ridgewood",
      price: 785000,
      beds: 4,
      baths: 2.5,
      sqft: 1840,
      description: "Charming colonial — updated kitchen, deep backyard.",
      mls_number: "NJ-2026-0147",
      status: "available" as const,
      property_type: "single_family" as const,
    },
    {
      agent_id: agentId,
      address: "55 Elm Court",
      town: "Westfield",
      price: 875000,
      beds: 4,
      baths: 3,
      sqft: 2100,
      description: "Move-in ready center hall colonial with finished basement.",
      mls_number: "NJ-2026-0155",
      status: "pending" as const,
      property_type: "single_family" as const,
    },
    {
      agent_id: agentId,
      address: "12 Park Blvd",
      town: "Montclair",
      price: 620000,
      beds: 3,
      baths: 2,
      sqft: 1560,
      description: "Walk to Montclair station — renovated kitchen and baths.",
      mls_number: "NJ-2026-0112",
      status: "available" as const,
      property_type: "single_family" as const,
    },
  ];

  const { data: props, error: pErr } = await supabase
    .from("properties")
    .insert(propertiesPayload)
    .select("id, address");

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 400 });
  }

  // Activity timeline — Mike's story is the narrative of the demo.
  const activities = [
    // Mike Rodriguez — full timeline
    {
      client_id: mike,
      agent_id: agentId,
      type: "note" as const,
      body: "Lead created from Zillow — Ridgewood buyer, 4bd target, pre-approved $850k.",
      ai_draft: false,
      approved: true,
      sent: false,
      created_at: ISO(2026, 3, 10, 14, 0),
    },
    {
      client_id: mike,
      agent_id: agentId,
      type: "call" as const,
      body: "8 min call logged — discussed timeline, ready to move by end of May.",
      ai_draft: false,
      approved: true,
      sent: false,
      created_at: ISO(2026, 3, 21, 16, 30),
    },
    {
      client_id: mike,
      agent_id: agentId,
      type: "text" as const,
      body: "Hey Mike — 55 Elm Ct in Westfield just hit the market at $875k, 4bd/3ba. Worth a look tomorrow?",
      ai_draft: false,
      approved: true,
      sent: true,
      created_at: ISO(2026, 4, 11, 13, 0),
    },
    {
      client_id: mike,
      agent_id: agentId,
      type: "showing" as const,
      body: "Showing logged at 47 Maple Ave — strong interest, wants to write offer this week.",
      ai_draft: false,
      approved: true,
      sent: false,
      created_at: ISO(2026, 4, 18, 15, 0),
    },
    // Lisa — under contract narrative
    {
      client_id: lisa,
      agent_id: agentId,
      type: "offer" as const,
      body: "Offer submitted at $875k on 55 Elm Court — 21-day diligence.",
      ai_draft: false,
      approved: true,
      sent: false,
      created_at: ISO(2026, 4, 5, 17, 0),
    },
    {
      client_id: lisa,
      agent_id: agentId,
      type: "note" as const,
      body: "Inspection complete — minor punch list, nothing deal-breaking.",
      ai_draft: false,
      approved: true,
      sent: false,
      created_at: ISO(2026, 4, 10, 18, 0),
    },
    {
      client_id: lisa,
      agent_id: agentId,
      type: "note" as const,
      body: "Mortgage commitment received from First National.",
      ai_draft: false,
      approved: true,
      sent: false,
      created_at: ISO(2026, 4, 15, 14, 30),
    },
    {
      client_id: lisa,
      agent_id: agentId,
      type: "text" as const,
      body: "Hey Lisa — final walkthrough is locked for Apr 28 at 3pm. Closing Apr 30. Anything you want to double-check?",
      ai_draft: true,
      approved: false,
      sent: false,
      created_at: ISO(2026, 4, 17, 19, 0),
    },
    // Emily — Montclair search
    {
      client_id: emily,
      agent_id: agentId,
      type: "text" as const,
      body: "Emily — 12 Park Blvd in Montclair just came up at $620k, 3/2. Want to tour Sunday?",
      ai_draft: true,
      approved: false,
      sent: false,
      created_at: ISO(2026, 4, 17, 11, 0),
    },
    {
      client_id: emily,
      agent_id: agentId,
      type: "call" as const,
      body: "15 min call — financing looks solid, pre-approval letter on the way.",
      ai_draft: false,
      approved: true,
      sent: false,
      created_at: ISO(2026, 4, 16, 14, 0),
    },
    // Wilson — contacted
    {
      client_id: wilson,
      agent_id: agentId,
      type: "email" as const,
      body: "Sent Summit market snapshot + 6 comps in the $950k–$1.1M range.",
      ai_draft: false,
      approved: true,
      sent: false,
      created_at: ISO(2026, 4, 14, 10, 0),
    },
    // David — new lead
    {
      client_id: david,
      agent_id: agentId,
      type: "note" as const,
      body: "New lead from Facebook — Hoboken 2BR, $500k max. First-time buyer.",
      ai_draft: false,
      approved: true,
      sent: false,
      created_at: ISO(2026, 4, 13, 10, 0),
    },
  ];

  await supabase.from("activities").insert(activities);

  await supabase.from("tasks").insert([
    {
      client_id: mike,
      agent_id: agentId,
      title: "Send lender intro to Mike",
      due_at: ISO(2026, 4, 19, 17, 0),
      done: false,
      ai_generated: false,
    },
    {
      client_id: emily,
      agent_id: agentId,
      title: "Prep 12 Park Blvd tour for Sunday",
      due_at: ISO(2026, 4, 22, 20, 0),
      done: false,
      ai_generated: true,
    },
    {
      client_id: lisa,
      agent_id: agentId,
      title: "Confirm final walkthrough Apr 28",
      due_at: ISO(2026, 4, 26, 17, 0),
      done: false,
      ai_generated: true,
    },
    {
      client_id: wilson,
      agent_id: agentId,
      title: "Summit school research follow-up",
      due_at: ISO(2026, 4, 21, 17, 0),
      done: false,
      ai_generated: false,
    },
    {
      client_id: david,
      agent_id: agentId,
      title: "Hoboken intro call with David",
      due_at: ISO(2026, 4, 20, 15, 0),
      done: false,
      ai_generated: false,
    },
  ]);

  // 1 transaction under contract — Lisa @ 55 Elm Court, $875k, closing Apr 30
  await supabase.from("transactions").insert({
    client_id: lisa,
    agent_id: agentId,
    address: "55 Elm Court, Westfield",
    contract_price: 875000,
    closing_date: ISO(2026, 4, 30, 14, 0),
    inspection_date: ISO(2026, 4, 10, 16, 0),
    appraisal_date: ISO(2026, 4, 12, 14, 0),
    mortgage_commitment_date: ISO(2026, 4, 15, 14, 30),
    attorney_name: "Jane Counsel",
    attorney_email: "jane@counsel-law.com",
    lender_name: "First National Bank",
    lender_email: "loans@firstnational.com",
    status: "active",
    notes:
      "Under contract. Milestones complete: offer accepted Apr 5, inspection Apr 10, mortgage commitment Apr 15. Final walkthrough Apr 28, closing Apr 30.",
  });

  // Showings — 3 past + 2 upcoming
  await supabase.from("showings").insert([
    // Upcoming
    {
      client_id: mike,
      agent_id: agentId,
      address: "47 Maple Ave, Ridgewood",
      showing_date: ISO(2026, 4, 22, 15, 0), // Sat Apr 22, 11 AM ET
      client_feedback: null,
      ai_summary: null,
      next_action: "Tour confirmed — bring comps for 14 Maple and 102 Cedar.",
    },
    {
      client_id: emily,
      agent_id: agentId,
      address: "12 Park Blvd, Montclair",
      showing_date: ISO(2026, 4, 23, 18, 0), // Sun Apr 23, 2 PM ET
      client_feedback: null,
      ai_summary: null,
      next_action: "First tour — confirm parking and bring info sheet.",
    },
    // Past
    {
      client_id: mike,
      agent_id: agentId,
      address: "47 Maple Ave, Ridgewood",
      showing_date: ISO(2026, 4, 18, 15, 0),
      client_feedback: "Loved kitchen and yard. Ready to write offer.",
      ai_summary:
        "Strong interest. Mike is ready to move — recommend drafting offer at ask with 30-day close.",
      next_action: "Draft offer at $785k, 30-day close, 10% down.",
    },
    {
      client_id: lisa,
      agent_id: agentId,
      address: "22 Oak St, Westfield",
      showing_date: ISO(2026, 4, 10, 16, 0),
      client_feedback: "Layout felt cramped. Passing.",
      ai_summary: "Not a fit — kitchen and master were too small for Lisa.",
      next_action: "Skip similar layouts; focus on center-hall colonials.",
    },
    {
      client_id: lisa,
      agent_id: agentId,
      address: "55 Elm Court, Westfield",
      showing_date: ISO(2026, 4, 5, 17, 0),
      client_feedback: "Serious interest — discussing offer.",
      ai_summary:
        "Considering — Lisa loved finished basement and yard. Moved to offer same day.",
      next_action: "Offer submitted at $875k — accepted.",
    },
  ]);

  // Property matches — direct hand-picked matches
  const maple = props?.find((p) => p.address.includes("Maple"));
  const elm = props?.find((p) => p.address.includes("Elm"));
  const park = props?.find((p) => p.address.includes("Park"));

  const matchRows = [];
  if (maple && mike)
    matchRows.push({
      property_id: maple.id,
      client_id: mike,
      agent_id: agentId,
      match_score: 92,
      match_reasons: ["budget ✅", "preferred town ✅", "4bd/2.5ba ✅"],
      notified: false,
    });
  if (elm && lisa)
    matchRows.push({
      property_id: elm.id,
      client_id: lisa,
      agent_id: agentId,
      match_score: 96,
      match_reasons: ["under contract ✅", "preferred town ✅", "4bd ✅"],
      notified: true,
    });
  if (park && emily)
    matchRows.push({
      property_id: park.id,
      client_id: emily,
      agent_id: agentId,
      match_score: 94,
      match_reasons: ["budget ✅", "preferred town ✅", "3bd/2ba ✅"],
      notified: false,
    });
  if (matchRows.length) await supabase.from("property_matches").insert(matchRows);

  // Listings (agent's own listings — demo teaser)
  await supabase.from("listings").insert([
    {
      agent_id: agentId,
      address: "120 Park Place, Montclair",
      price: 699000,
      beds: 3,
      baths: 2,
      sqft: 2100,
      description: "Bright townhouse near trains.",
      mls_description: "Spacious 3BR with modern kitchen.",
      instagram_captions: { a: "funny", b: "pro", c: "teaser" },
      sms_blast: "New Montclair listing — tour this weekend!",
      photos: [],
      view_count: 42,
      is_featured: true,
    },
  ]);

  await runPropertyMatching(supabase, agentId);

  await supabase.from("referrals").insert({
    from_agent_id: agentId,
    to_agent_id: agentId,
    client_name: "Alex Rivera",
    client_phone: "+15559876543",
    client_email: "alex@email.com",
    town: "Glen Ridge",
    budget_max: 825000,
    notes: "Relocating from Chicago; needs quick timeline.",
    status: "pending",
    referral_fee_percent: 25,
  });

  return NextResponse.json({
    ok: true,
    clients: insertedClients?.length ?? 0,
    properties: props?.length ?? 0,
  });
}
