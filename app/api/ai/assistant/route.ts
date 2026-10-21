// POST /api/ai/assistant — Ask Aria.
//
// Answers the agent's questions about their own business with the tool-calling
// agent (lib/ai/agent.ts): it starts grounded in the live CRM snapshot, then
// calls read-only tools (hottest leads, stale clients, today's priorities,
// client lookups) to answer from real rows. The client never supplies context.
// The one write it can make is create_client ("add Dana Mockley, 201-555-0134,
// buyer in Teaneck"), through the same intake as Quick add.
//
// If Claude can't be reached (no ANTHROPIC_API_KEY, or the API call fails) the
// common questions are still answered straight from the data
// (lib/ai/insights); anything else gets an honest "can't answer" plus a
// clarifying question — never a canned stat.
//
// Request body:
//   { question: string, mode?: "chat" | "voice", history?: [{role, content}] }
//
// Response:
//   { reply: string, action: {label, href} | null, degraded: "no_api_key" | "api_error" | null }
//   (degraded is set when Claude is unreachable, so the UI can say the answer came from rules)

import { NextResponse } from "next/server";
import { getRouteSupabase } from "@/lib/api-auth";
import { runAriaAgent, type AgentMessage, type ToolCallLog } from "@/lib/ai/agent";
import { askAriaTools } from "@/lib/ai/tools/tool-definitions";
import { answerFromData, detectIntent, type AskIntent } from "@/lib/ai/insights";

type ChatAction = { label: string; href: string };

function askAriaSystemPrompt(mode: "chat" | "voice"): string {
  return [
    "You are Aria, the assistant inside a New Jersey real estate agent's CRM. You answer the agent's questions about their own clients and business using their live data.",
    "",
    "HOW TO ANSWER",
    "— Answer the exact question asked. Look the answer up with your tools rather than guessing from the summary below: get_hottest_leads for who's hottest / most likely to buy, get_stale_clients for who they haven't talked to, get_today_priorities for what to do today, search_clients / get_client_profile for a specific person.",
    "— Name specific clients and give the one-line reason from the data (lead score, stage, upcoming showing, last contact). For today's priorities, lead with the most time-sensitive real item (a showing, something Aria needs them for, a closing, a new lead, a task due).",
    "— Pending follow-up drafts are a background chore, not an answer. Mention them only when asked about drafts, follow-ups or the inbox, or when nothing more specific is pending — and describe them by who they're for, never by a raw count.",
    "— If the data and tools can't answer the question, say so plainly in one sentence and ask one short clarifying question. Never substitute an unrelated stat.",
    "— ADDING A CLIENT: when the agent asks you to add someone, call create_client with what they said (name, phone and/or email, buyer/seller/renter, towns, budget, a one-line note). It needs a phone or email — if neither was given, ask for one. After it returns, confirm in one sentence what was saved (or that they were already in the clients). Never claim a client was added unless create_client returned success.",
    "— Apart from adding a client, you can only read data here, not send messages or change records. If asked to, say where in the app to do it.",
    "— No markdown or bullet lists. Use the names exactly as they appear in the data.",
    mode === "voice"
      ? "— VOICE: 1–2 short spoken sentences."
      : "— CHAT: 2–4 sentences, direct and specific.",
  ].join("\n");
}

function clientAction(c: { id: string; name: string }): ChatAction {
  const first = c.name.includes("&") ? c.name : c.name.split(" ")[0];
  return { label: `Open ${first}`, href: `/clients/${c.id}` };
}

/** First client a tool returned, so the answer can carry a one-tap "Open …". */
function topClientFromTools(toolCalls: ToolCallLog[], tool: string, key: string): { id: string; name: string } | null {
  const call = [...toolCalls].reverse().find((t) => t.name === tool && t.result.success);
  const rows = call?.result[key];
  const first = Array.isArray(rows) ? (rows[0] as { id?: unknown; name?: unknown } | undefined) : undefined;
  return first && typeof first.id === "string" && typeof first.name === "string" ? { id: first.id, name: first.name } : null;
}

function deriveAction(
  intent: AskIntent | null,
  focusClient: { id: string; name: string } | null,
): ChatAction | null {
  switch (intent) {
    case "hottest":
    case "stale":
      return focusClient ? clientAction(focusClient) : { label: "See Clients", href: "/clients" };
    case "today":
      return { label: "Open Today", href: "/dashboard" };
    case "showings":
      return { label: "View Showings", href: "/showings" };
    case "drafts":
      return { label: "Review Follow-ups", href: "/inbox" };
    default:
      return null;
  }
}

export async function POST(req: Request) {
  const { supabase, user } = await getRouteSupabase();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    question?: unknown;
    mode?: unknown;
    history?: unknown;
  };

  const question = String(body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const mode = String(body.mode ?? "chat") === "voice" ? "voice" : "chat";
  const history: AgentMessage[] = (Array.isArray(body.history) ? body.history : [])
    .filter(
      (h): h is { role: "user" | "assistant"; content: unknown } =>
        typeof h === "object" && h !== null &&
        ((h as { role?: unknown }).role === "user" || (h as { role?: unknown }).role === "assistant"),
    )
    .map((h) => ({ role: h.role, content: String(h.content ?? "") }))
    .filter((h) => h.content.trim())
    .slice(-6);
  // The API requires the conversation to start with a user turn.
  while (history[0]?.role === "assistant") history.shift();

  const intent = detectIntent(question);

  const result = await runAriaAgent({
    system: askAriaSystemPrompt(mode),
    history,
    userMessage: question,
    ctx: { supabase, agentId: user.id },
    tools: askAriaTools,
    maxTokens: 1024,
    mode,
  });

  let reply = result.reply;
  let focusClient =
    intent === "hottest"
      ? topClientFromTools(result.toolCalls, "get_hottest_leads", "leads")
      : intent === "stale"
        ? topClientFromTools(result.toolCalls, "get_stale_clients", "clients")
        : null;

  if (result.usedFallback) {
    if (result.fallbackReason === "no_api_key") {
      console.error("[/api/ai/assistant] ANTHROPIC_API_KEY is missing — Ask Aria is answering from data rules only.");
    }
    const answer = await answerFromData(supabase, user.id, question, mode);
    reply = answer.reply;
    focusClient = answer.focusClient;
  }

  // "degraded" means the AI itself is unreachable — the UI says so.
  const degraded =
    result.fallbackReason === "no_api_key" || result.fallbackReason === "api_error" ? result.fallbackReason : null;

  // A client was just added (or found): offer to open them.
  const added = [...result.toolCalls].reverse().find((t) => t.name === "create_client" && t.result.success);
  const addedClient = added?.result.client as { id?: unknown; name?: unknown } | undefined;
  const action =
    !result.usedFallback && typeof addedClient?.id === "string" && typeof addedClient.name === "string"
      ? clientAction({ id: addedClient.id, name: addedClient.name })
      : deriveAction(intent, focusClient);

  return NextResponse.json({ reply, action, degraded });
}
