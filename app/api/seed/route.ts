import { NextResponse } from "next/server";
import { runPropertyMatching } from "@/lib/matchProperties";
import { getRouteSupabase } from "@/lib/api-auth";

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
    return NextResponse.json({ ok: true, skipped: true, message: "Already seeded" });
  }

  const clientsPayload = [
    {
      agent_id: agentId,
      name: "Mike Rodriguez",
      phone: "+15551234567",
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
      last_engagement_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      automation_day: 0,
    },
    {
      agent_id: agentId,
      name: "Emily Chen",
      phone: "+15552345678",
      email: "emily.chen@email.com",
      source: "google" as const,
      status: "showing" as const,
      lead_score: 8,
      budget_min: 550000,
      budget_max: 650000,
      town: "Montclair",
      beds_wanted: 3,
      baths_wanted: 2,
      notes: "Commute to NYC matters.",
      last_engagement_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      automation_day: 1,
    },
    {
      agent_id: agentId,
      name: "James & Sarah Wilson",
      phone: "+15553456789",
      email: "jwilson@email.com",
      source: "referral" as const,
      status: "contacted" as const,
      lead_score: 6,
      budget_min: 900000,
      budget_max: 1100000,
      town: "Summit",
      beds_wanted: 5,
      baths_wanted: 3,
      notes: "Looking for space for two kids.",
      last_engagement_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      automation_day: 0,
    },
    {
      agent_id: agentId,
      name: "David Park",
      phone: "+15554567890",
      email: "david.park@email.com",
      source: "facebook" as const,
      status: "new" as const,
      lead_score: 4,
      budget_min: 400000,
      budget_max: 500000,
      town: "Hoboken",
      beds_wanted: 2,
      baths_wanted: 2,
      notes: "First-time buyer; wants low maintenance.",
      last_engagement_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      automation_day: 0,
    },
    {
      agent_id: agentId,
      name: "Lisa Thompson",
      phone: "+15555678901",
      email: "lisa.t@email.com",
      source: "manual" as const,
      status: "under_contract" as const,
      lead_score: 7,
      budget_min: 750000,
      budget_max: 900000,
      town: "Westfield",
      beds_wanted: 4,
      baths_wanted: 3,
      notes: "Offer submitted; waiting on seller response.",
      last_engagement_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      automation_day: 2,
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

  const propertiesPayload = [
    {
      agent_id: agentId,
      address: "47 Maple Ave",
      town: "Ridgewood",
      price: 785000,
      beds: 4,
      baths: 2.5,
      sqft: 2400,
      description: "Charming colonial with updated kitchen.",
      mls_number: "NJ-100001",
      status: "available" as const,
      property_type: "single_family" as const,
    },
    {
      agent_id: agentId,
      address: "112 Oak St",
      town: "Montclair",
      price: 625000,
      beds: 3,
      baths: 2,
      sqft: 1850,
      description: "Walkable to downtown.",
      mls_number: "NJ-100002",
      status: "available" as const,
      property_type: "single_family" as const,
    },
    {
      agent_id: agentId,
      address: "8 Highland Rd",
      town: "Summit",
      price: 1150000,
      beds: 5,
      baths: 3.5,
      sqft: 3200,
      description: "Large lot, quiet street.",
      mls_number: "NJ-100003",
      status: "pending" as const,
      property_type: "single_family" as const,
    },
    {
      agent_id: agentId,
      address: "203 River Rd",
      town: "Hoboken",
      price: 595000,
      beds: 2,
      baths: 2,
      sqft: 1250,
      description: "Condo with NYC views.",
      mls_number: "NJ-100004",
      status: "available" as const,
      property_type: "condo" as const,
    },
    {
      agent_id: agentId,
      address: "55 Elm Court",
      town: "Westfield",
      price: 875000,
      beds: 4,
      baths: 3,
      sqft: 2600,
      description: "Move-in ready center hall colonial.",
      mls_number: "NJ-100005",
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

  const mike = byName["Mike Rodriguez"];
  const emily = byName["Emily Chen"];
  const james = byName["James & Sarah Wilson"];
  const david = byName["David Park"];
  const lisa = byName["Lisa Thompson"];

  const activities = [
    {
      client_id: mike,
      agent_id: agentId,
      type: "note" as const,
      body: "Asked for comps near Ridgewood elementary.",
      ai_draft: false,
      approved: true,
      sent: false,
    },
    {
      client_id: mike,
      agent_id: agentId,
      type: "text" as const,
      body: "Tour confirmed for Saturday 11am.",
      ai_draft: false,
      approved: true,
      sent: true,
    },
    {
      client_id: emily,
      agent_id: agentId,
      type: "text" as const,
      body: "Aria draft: Want me to send Montclair listings under $650k?",
      ai_draft: true,
      approved: false,
      sent: false,
    },
    {
      client_id: emily,
      agent_id: agentId,
      type: "call" as const,
      body: "15 min call — financing looks solid.",
      ai_draft: false,
      approved: true,
      sent: false,
    },
    {
      client_id: james,
      agent_id: agentId,
      type: "email" as const,
      body: "Sent market snapshot for Summit.",
      ai_draft: false,
      approved: true,
      sent: false,
    },
    {
      client_id: david,
      agent_id: agentId,
      type: "note" as const,
      body: "New lead — wants Hoboken 2BR.",
      ai_draft: false,
      approved: true,
      sent: false,
    },
    {
      client_id: lisa,
      agent_id: agentId,
      type: "offer" as const,
      body: "Offer submitted at $865k with 21-day diligence.",
      ai_draft: false,
      approved: true,
      sent: false,
    },
    {
      client_id: lisa,
      agent_id: agentId,
      type: "text" as const,
      body: "Seller counter expected by tonight.",
      ai_draft: true,
      approved: false,
      sent: false,
    },
    {
      client_id: mike,
      agent_id: agentId,
      type: "showing" as const,
      body: "Showing logged — strong interest.",
      ai_draft: false,
      approved: true,
      sent: false,
    },
    {
      client_id: emily,
      agent_id: agentId,
      type: "automation" as const,
      body: "Automation: follow-up reminder.",
      ai_draft: false,
      approved: true,
      sent: false,
    },
  ];

  await supabase.from("activities").insert(activities);

  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  await supabase.from("tasks").insert([
    {
      client_id: mike,
      agent_id: agentId,
      title: "Send lender intro",
      due_at: yesterday,
      done: false,
      ai_generated: false,
    },
    {
      client_id: emily,
      agent_id: agentId,
      title: "Prep Montclair tour list",
      due_at: new Date().toISOString(),
      done: false,
      ai_generated: true,
    },
    {
      client_id: james,
      agent_id: agentId,
      title: "Summit school research",
      due_at: weekAgo,
      done: false,
      ai_generated: false,
    },
    {
      client_id: david,
      agent_id: agentId,
      title: "Hoboken intro call",
      due_at: new Date(Date.now() + 86400000).toISOString(),
      done: false,
      ai_generated: false,
    },
    {
      client_id: lisa,
      agent_id: agentId,
      title: "Follow up on offer response",
      due_at: new Date().toISOString(),
      done: false,
      ai_generated: true,
    },
  ]);

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
    {
      agent_id: agentId,
      address: "9 Birch Ln, Ridgewood",
      price: 925000,
      beds: 4,
      baths: 2.5,
      sqft: 2750,
      description: "Classic Ridgewood colonial.",
      mls_description: "Updated systems, quiet block.",
      instagram_captions: { a: "funny", b: "pro", c: "teaser" },
      sms_blast: "Ridgewood opportunity — see it before it’s gone.",
      photos: [],
      view_count: 18,
      is_featured: false,
    },
  ]);

  const closing = new Date(Date.now() + 35 * 86400000).toISOString();
  await supabase.from("transactions").insert({
    client_id: lisa,
    agent_id: agentId,
    address: "55 Elm Court, Westfield",
    contract_price: 865000,
    closing_date: closing,
    inspection_date: new Date(Date.now() + 10 * 86400000).toISOString(),
    appraisal_date: new Date(Date.now() + 20 * 86400000).toISOString(),
    mortgage_commitment_date: new Date(Date.now() + 28 * 86400000).toISOString(),
    attorney_name: "Jane Counsel",
    attorney_email: "jane@law.com",
    lender_name: "First National",
    lender_email: "loans@firstnational.com",
    status: "active",
    notes: "Clean deal; watch inspection items.",
  });

  await supabase.from("showings").insert([
    {
      client_id: mike,
      agent_id: agentId,
      address: "47 Maple Ave, Ridgewood",
      showing_date: new Date(Date.now() - 2 * 86400000).toISOString(),
      client_feedback: "Loved kitchen; worried about yard size.",
      ai_summary:
        "Strong interest; minor concern on outdoor space — solvable with nearby parks pitch.",
      next_action: "Send two comps with larger yards.",
    },
    {
      client_id: emily,
      agent_id: agentId,
      address: "112 Oak St, Montclair",
      showing_date: new Date(Date.now() - 86400000).toISOString(),
      client_feedback: "Wants more closet space.",
      ai_summary: "Buyer likes location; needs storage solutions.",
      next_action: "Share organizer referrals + similar homes.",
    },
  ]);

  const ridgewood = props?.find((p) => p.address.includes("Maple"));
  if (ridgewood && mike) {
    await supabase.from("property_matches").insert({
      property_id: ridgewood.id,
      client_id: mike,
      agent_id: agentId,
      match_score: 88,
      match_reasons: ["budget ✅", "preferred town ✅", "beds ✅"],
      notified: false,
    });
  }

  const montclair = props?.find((p) => p.address.includes("Oak"));
  if (montclair && emily) {
    await supabase.from("property_matches").insert({
      property_id: montclair.id,
      client_id: emily,
      agent_id: agentId,
      match_score: 90,
      match_reasons: ["budget ✅", "preferred town ✅", "beds ✅"],
      notified: false,
    });
  }

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

  return NextResponse.json({ ok: true, clients: insertedClients?.length ?? 0 });
}
