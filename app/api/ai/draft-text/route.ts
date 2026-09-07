import { NextResponse } from "next/server";
import { callClaude, getAnthropic, sanitizeDraft } from "@/lib/ai";
import { getRouteSupabase } from "@/lib/api-auth";

const DRAFT_RULES = `Rules:
- Plain text only. No markdown, bullets, labels, or "Draft:" / "SMS:" prefixes.
- Never use bracket placeholders like [name] or [town] — use real values or leave them out.
- No commentary, explanations, or subject lines.
- Sound like a real person texting from their phone. Warm, concise, natural.
- Return ONLY the message text.`;

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientName = String(body.clientName ?? "there");
  const context = String(body.context ?? "");
  const scenario = String(body.scenario ?? "");
  const bodyVoiceSamples = Array.isArray(body.voiceSamples)
    ? body.voiceSamples.map(String).filter(Boolean)
    : [];
  // Callers other than the Settings preview page (today-client, DraftSheet)
  // don't send voiceSamples — load the agent's saved samples so drafts still
  // match their tone instead of silently falling back to a generic voice.
  let voiceSamples = bodyVoiceSamples;
  if (voiceSamples.length === 0) {
    const { data: profile } = await supabase
      .from("agent_profiles")
      .select("voice_samples")
      .eq("id", user.id)
      .maybeSingle();
    voiceSamples = ((profile?.voice_samples as string[] | null) ?? []).filter(Boolean);
  }
  const clientId = body.clientId as string | undefined;
  const skipInsert = Boolean(body.skipInsert);
  const propertyContext = body.propertyContext
    ? String(body.propertyContext)
    : "";
  const matchPing = Boolean(body.matchPing);
  const toFiniteNumber = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const urgencyRank = toFiniteNumber(body.urgencyRank) ?? 0;
  const clientTown = String(body.clientTown ?? "");
  const clientBudgetMax = toFiniteNumber(body.clientBudgetMax);
  const propertyAddress = String(body.propertyAddress ?? "");
  const leadScore = toFiniteNumber(body.leadScore);
  const activitySignal = String(body.activitySignal ?? "");
  const commissionEst = toFiniteNumber(body.commissionEst);

  const firstName = clientName.split(/\s+/)[0] || "there";

  const samplesBlock = voiceSamples
    .map((s: string, i: number) => `Sample ${i + 1}: ${s}`)
    .join("\n");

  // Build enhanced context for the AI
  const clientContext = [];
  if (clientTown) clientContext.push(`Location: ${clientTown}`);
  if (clientBudgetMax !== null) clientContext.push(`Budget: $${clientBudgetMax.toLocaleString()}`);
  if (body.clientStatus) clientContext.push(`Status: ${body.clientStatus}`);
  if (leadScore !== null) clientContext.push(`Lead score: ${leadScore}/10`);
  if (activitySignal) clientContext.push(`Recent activity: ${activitySignal}`);
  if (commissionEst !== null) clientContext.push(`Projected commission: $${commissionEst.toLocaleString()}`);

  const system = matchPing
    ? `You ghost-write a single SMS for a New Jersey real estate agent introducing a specific property to a buyer client.
Keep it under 320 characters. Conversational — the agent knows this client personally.
Use the client's context to make the message personal and relevant.
${DRAFT_RULES}`
    : `You are ghostwriting a text message for a real estate agent. Match their tone from the provided samples.
Use the client's context to make the message personal and relevant.
1–3 sentences max. If property context is provided, introduce it naturally.
${DRAFT_RULES}`;

  const userMsg = matchPing
    ? `Client first name: ${firstName}
Client context: ${clientContext.join(" | ") || "Limited context available"}
Property details:
${propertyContext || context}

Write ONE warm SMS introducing this property. Under 320 characters.`
    : `Client: ${clientName}
Scenario: ${scenario}
Context: ${context}${propertyContext ? `\nProperty: ${propertyContext}` : ""}
Client context: ${clientContext.join(" | ") || "Limited context available"}

Voice samples (match this tone):
${samplesBlock || "(no samples — use warm, concise NJ agent tone)"}

Write ONE short text message.`;

  // Try to get AI-generated draft
  let draft = "";
  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      const rawDraft = await callClaude(system, userMsg, matchPing ? 220 : 150);
      draft = sanitizeDraft(rawDraft);
    } catch (error) {
      console.error("[draft-text] AI generation failed:", error);
      // Will fall back to smart templates below
    }
  }

  // Fallback to smart templates if AI failed or not available
  if (!draft) {
    // Import the smart template function - we'll create a lightweight version here
    // to avoid circular dependencies
    const fallbackDraft = generateSmartTemplateFallback({
      firstName,
      urgencyRank,
      clientTown,
      clientBudgetMax,
      propertyAddress,
      reason: scenario,
    });
    draft = fallbackDraft;
  }

  // Final fallback to generic templates if everything else fails
  if (!draft) {
    // Safe generic fallback — no hardcoded towns or fabricated listing details
    draft = matchPing
      ? `Hey ${firstName} — found a property that might check your boxes. Want me to send the details?`
      : `Hey ${firstName} — just wanted to check in on your search. Any availability to connect this week?`;
  }

  if (clientId && !skipInsert) {
    await supabase.from("activities").insert({
      client_id: clientId,
      agent_id: user.id,
      type: "text",
      body: draft,
      ai_draft: true,
      approved: false,
      sent: false,
    });
  }

  return NextResponse.json({ draft });
}

// Lightweight smart template fallback to avoid circular dependencies
function generateSmartTemplateFallback(params: {
  firstName: string;
  urgencyRank: number;
  clientTown: string;
  clientBudgetMax: number | null;
  propertyAddress: string;
  reason: string;
}): string {
  const { firstName, urgencyRank, clientTown, clientBudgetMax, propertyAddress, reason } = params;

  const fmtMoney = (amount: number): string => {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`;
    return `$${amount}`;
  };

  const locationBudgetPhrase = (town: string | null, budgetMax: number | null): string => {
    if (town && budgetMax) return `${town}, up to ${fmtMoney(budgetMax)}`;
    if (town) return town;
    if (budgetMax) return `up to ${fmtMoney(budgetMax)}`;
    return "";
  };

  switch (urgencyRank) {
    // 1 — closing at risk
    case 1: {
      const addressMatch = reason.match(/^Closing at (.+)$/);
      const address = addressMatch?.[1];
      return address
        ? `Hi ${firstName} — your closing at ${address} is almost here! Everything looks good on my end — let me know if anything comes up before then.`
        : `Hi ${firstName} — your closing is coming up soon! Everything looks good on my end — let me know if anything comes up.`;
    }

    // 2 — hot lead gone quiet
    case 2: {
      const where = locationBudgetPhrase(clientTown, clientBudgetMax);
      return where
        ? `Hey ${firstName} — it's been a bit since we caught up on your ${where} search. Still keeping an eye out for you — want me to send over a few new places this week?`
        : `Hey ${firstName} — it's been a bit since we caught up. Still keeping an eye out for you — want me to send over a few new places this week?`;
    }

    // 3 — birthday or home-purchase anniversary
    case 3: {
      if (/birthday/i.test(reason)) {
        return `Happy birthday, ${firstName}! 🎉 Hope you're having a great day — thinking of you!`;
      }
      const yearsMatch = reason.match(/(\d+)\s+years?\s+ago/i);
      const years = yearsMatch ? Number(yearsMatch[1]) : null;
      return years
        ? `Hi ${firstName} — happy home-anniversary! Hard to believe it's been ${years} year${years === 1 ? "" : "s"} since you closed. Hope you're loving the place as much as day one 🏡`
        : `Hi ${firstName} — happy home-anniversary! Hope you're loving the place as much as day one 🏡`;
    }

    // 4 — buyer agreement not signed
    case 4: {
      const where = clientTown ? ` in ${clientTown}` : "";
      return `Hey ${firstName} — whenever you get a sec, can you sign the buyer agreement? I want to keep sending you listings${where} without any holdup.`;
    }

    // 5 — new MLS match
    case 5: {
      if (propertyAddress) {
        const budget = clientBudgetMax ? `, and it's right in your budget at ${fmtMoney(clientBudgetMax)}` : "";
        return `Hey ${firstName} — a new listing just hit the market at ${propertyAddress}${budget}. Want me to send details or set up a showing?`;
      }
      const where = locationBudgetPhrase(clientTown, clientBudgetMax);
      return `Hey ${firstName} — a new listing just hit the market that looks like a great fit${where ? ` for your ${where} search` : ""}. Want me to send it over?`;
    }

    default:
      return `Hi ${firstName} — wanted to check in. Let me know how things are going on your end.`;
  }
}
