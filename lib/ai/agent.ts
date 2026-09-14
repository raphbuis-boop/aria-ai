import type Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropic } from "@/lib/ai";
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

const MODEL = "claude-sonnet-4-20250514";
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
  /** True when no API key was configured and a fallback string was returned. */
  usedFallback: boolean;
};

export type RunAgentOptions = {
  /** Base behavioral / tool-rules prompt. Live CRM context is appended to it. */
  system: string;
  /** Prior turns (already trimmed by the caller). */
  history?: AgentMessage[];
  /** The new user turn. */
  userMessage: string;
  ctx: ToolContext;
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
    return {
      reply: fallbackReply,
      toolCalls: [],
      iterations: 0,
      usedFallback: true,
    };
  }

  const messages: AnthropicMessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];

  const toolCalls: ToolCallLog[] = [];
  let iterations = 0;

  for (let i = 0; i < maxIterations; i++) {
    iterations += 1;

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: groundedSystem,
        tools: ariaTools,
        messages,
      });
    } catch (err) {
      console.error("[aria-agent] Claude call failed:", err);
      return {
        reply: collectTextSoFar(toolCalls, fallbackReply),
        toolCalls,
        iterations,
        usedFallback: true,
      };
    }

    // No tool requested → this is the final answer.
    if (response.stop_reason !== "tool_use") {
      return {
        reply: collectText(response.content) || fallbackReply,
        toolCalls,
        iterations,
        usedFallback: false,
      };
    }

    // Record the assistant's tool-call turn verbatim (required for the next
    // request so the tool_result blocks line up with their tool_use ids).
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
  // so we never leave the agent mid-loop.
  try {
    const finalResp = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system:
        groundedSystem +
        "\n\nYou have used the maximum number of tool calls. Give your best final answer now based on the tool results already gathered. Do not request more tools.",
      messages,
    });
    return {
      reply: collectText(finalResp.content) || fallbackReply,
      toolCalls,
      iterations,
      usedFallback: false,
    };
  } catch (err) {
    console.error("[aria-agent] final synthesis failed:", err);
    return {
      reply: collectTextSoFar(toolCalls, fallbackReply),
      toolCalls,
      iterations,
      usedFallback: true,
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
