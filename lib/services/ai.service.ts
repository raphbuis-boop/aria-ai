/**
 * AiService — thin adapter over lib/ai.ts
 *
 * Wraps callClaude, safeJsonParse, and sanitizeDraft.
 * Does NOT change model, token limits, or system prompts.
 */

import { callClaude, safeJsonParse, sanitizeDraft } from "@/lib/ai";

export interface IAiService {
  call(system: string, user: string, maxTokens: number): Promise<string>;
  parseJson<T>(raw: string): T | null;
  sanitizeDraft(raw: string): string;
}

export const AiService: IAiService = {
  call(system, user, maxTokens) {
    return callClaude(system, user, maxTokens);
  },

  parseJson<T>(raw: string): T | null {
    return safeJsonParse<T>(raw);
  },

  sanitizeDraft(raw) {
    return sanitizeDraft(raw);
  },
};
