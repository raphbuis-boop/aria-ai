import type Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { AI_MODEL, THINKING_HEADROOM_TOKENS, getAnthropic } from "@/lib/ai";
import { ariaTools } from "./tools/tool-definitions";
import { executeTool } from "./tools/tool-handlers";
import {
  deterministicFallback,
  fetchAgentSnapshot,
  renderContextBlock,
  type GroundingMode,
} from "./grounding";

export interface ToolContext {
  supabase: SupabaseClient;
  agentId: string;
}

/**
 * Tool-based agent orchestrator.
 *
 *   User input → LLM (decides if a tool is needed) → execute tool handler →
 *   feed real tool result back to LLM → repeat until the LLM stops calling
 *   tools → final natural-language reply.
 *
 * The model only ever "confirms" an action after the corresponding handler
 * returns a result. Because handlers return `success: true` exclusively on a
 * real backend confirmation (MLS 2xx, Supabase row), the model is
 * structurally prevented from hallucinating completed actions.
 */

const DEFAULT_MAX_ITERATIONS = 6;

export type AgentMessage = { role: "user" | "assistant"; content: string };

export type ToolCallLog = {
  name: string;
  input: unknown;
  result: Record<string, unknown> & { success: boolean };
};

export type AgentRunResult = {
  reply: string;
  toolCalls: ToolCallLog[];
  /** Number of LLM round-trips taken (1 = answered with no tools). */
  iterations: number;
  /** True when Claude couldn't be used (no API key, or the API call failed) and a fallback string was returned. */
  usedFallback: boolean;
  /** Why the fallback was used, when it was ("no_answer": the model replied with no text, e.g. a refusal). */
  fallbackReason?: "no_api_key" | "api_error" | "no_answer";
};

export type RunAgentOptions = {
  /** Base behavioral / tool-rules prompt. Live CRM context is appended to it. */
  system: string;
  /** Prior turns (already trimmed by the caller). */
  history?: AgentMessage[];
  /** The new user turn. */
  userMessage: string;
  ctx: ToolContext;
  /** Tools the model may call. Defaults to every Aria tool (reads and writes). */
  tools?: Anthropic.Tool[];
  maxTokens?: number;
  maxIterations?: number;
  fallbackReply?: string;
  /**
   * When true (default), the agent fetches the agent's live CRM snapshot and
   * prepends a grounded context block to `system` BEFORE the tool loop — so it
   * never starts "blank". Set false to run with only the base system prompt.
   */
  ground?: boolean;
  /** Tunes the (currently shared) context rendering; reserved for voice use. */
  mode?: GroundingMode;
};

type AnthropicMessageParam = Anthropic.MessageParam;

function collectText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function runAriaAgent(
  opts: RunAgentOptions,
): Promise<AgentRunResult> {
  const {
    system,
    history = [],
    userMessage,
    ctx,
    tools = ariaTools,
    maxTokens = 600,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    ground = true,
  } = opts;

  // ── Grounding: never start blank ──────────────────────────────────────────
  // Build the live CRM context (who the agent is, hot leads, today's calendar)
  // and prepend it to the base system prompt. Done before the API-key check so
  // even the no-API-key fallback can be data-aware. A DB hiccup degrades
  // gracefully to the base prompt rather than failing the request.
  let groundedSystem = system;
  let fallbackReply =
    opts.fallbackReply ??
    "I couldn't reach the AI service just now. Try again in a moment.";

  if (ground) {
    try {
      const snapshot = await fetchAgentSnapshot(ctx.supabase, ctx.agentId);
      groundedSystem = `${system}\n\n${renderContextBlock(snapshot)}`;
      if (!opts.fallbackReply) {
        fallbackReply = deterministicFallback(snapshot);
      }
    } catch (err) {
      console.error("[aria-agent] grounding failed, using base prompt:", err);
    }
  }

  const client = getAnthropic();
  if (!client) {
    console.error(
      "[aria-agent] ANTHROPIC_API_KEY is not set — Aria AI is OFF and every question gets a fallback reply. Set it in the deployment environment.",
    );
    return {
      reply: fallbackReply,
      toolCalls: [],
      iterations: 0,
      usedFallback: true,
      fallbackReason: "no_api_key",
    };
  }

  const messages: AnthropicMessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];

  const toolCalls: ToolCallLog[] = [];
  let iterations = 0;

  // Short Q&A over tool results: low effort keeps latency down. Thinking
  // counts toward max_tokens, so leave room for it on top of the reply.
  const request = {
    model: AI_MODEL,
    max_tokens: maxTokens + THINKING_HEADROOM_TOKENS,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "low" as const },
    system: groundedSystem,
    tools,
  };

  const finish = (content: Anthropic.ContentBlock[]): AgentRunResult => {
    const text = collectText(content);
    return text
      ? { reply: text, toolCalls, iterations, usedFallback: false }
      : { reply: fallbackReply, toolCalls, iterations, usedFallback: true, fallbackReason: "no_answer" };
  };

  for (let i = 0; i < maxIterations; i++) {
    iterations += 1;

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({ ...request, messages });
    } catch (err) {
      console.error("[aria-agent] Claude call failed:", err);
      return {
        reply: collectTextSoFar(toolCalls, fallbackReply),
        toolCalls,
        iterations,
        usedFallback: true,
        fallbackReason: "api_error",
      };
    }

    // No tool requested → this is the final answer.
    if (response.stop_reason !== "tool_use") return finish(response.content);

    // Record the assistant's tool-call turn verbatim (required for the next
    // request so the tool_result blocks line up with their tool_use ids, and
    // thinking blocks must be passed back unchanged).
    messages.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const result = await executeTool(block.name, block.input, ctx);
      toolCalls.push({ name: block.name, input: block.input, result });
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: result.success === false,
      });
    }

    messages.push({ role: "user", content: toolResultBlocks });
  }

  // Exhausted the loop budget — ask the model for a final answer without tools
  // so we never leave the agent mid-loop. The instruction rides on the newest
  // (not yet sent) user turn: editing system/tools or an earlier turn would
  // invalidate the thinking blocks already in the history.
  const last = messages[messages.length - 1];
  if (last.role === "user" && Array.isArray(last.content)) {
    last.content.push({
      type: "text",
      text: "You have used the maximum number of tool calls. Give your best final answer now based on the tool results already gathered.",
    });
  }
  try {
    const finalResp = await client.messages.create({
      ...request,
      tool_choice: { type: "none" },
      messages,
    });
    return finish(finalResp.content);
  } catch (err) {
    console.error("[aria-agent] final synthesis failed:", err);
    return {
      reply: collectTextSoFar(toolCalls, fallbackReply),
      toolCalls,
      iterations,
      usedFallback: true,
      fallbackReason: "api_error",
    };
  }
}

/**
 * Best-effort human summary when the LLM call fails mid-loop but tools already
 * produced real results — avoids returning a bare error after a real action
 * (e.g. an SMS that already went out) succeeded.
 */
function collectTextSoFar(
  toolCalls: ToolCallLog[],
  fallback: string,
): string {
  const sent = toolCalls.find(
    (t) => t.name === "send_client_message" && t.result.success === true,
  );
  if (sent) {
    const name = (sent.result.clientName as string | undefined) ?? "your client";
    return `The text to ${name} was sent successfully.`;
  }
  return fallback;
}
