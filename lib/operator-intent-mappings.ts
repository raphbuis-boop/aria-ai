/**
 * Semantic intent → investigative workflow mappings for founder/operator prompts.
 *
 * Agents should treat natural-language asks (“engineering risks”, “prepare for X demo”)
 * as operational intent, then execute (or propose) concrete repo/product investigations —
 * not refuse for lacking a literal tool name.
 *
 * Safety: expands investigation scope only; does not override auth, secrets handling,
 * destructive-operation prohibitions, or user-approved scopes.
 */

export type InvestigationLens = {
  id: string;
  /** Stable keyword triggers (substring match after normalization). */
  triggers: readonly string[];
  /** Human-readable framing for summaries. */
  goal: string;
  /** Executable investigation bullets (commands, searches, integrations). */
  investigations: readonly string[];
};

export type SemanticTemplate = {
  id: string;
  label: string;
  triggers: readonly string[];
  lenses: readonly InvestigationLens[];
};

/** Templates keyed by recurring founder/product language. */
export const SEMANTIC_DECOMPOSITION_TEMPLATES: readonly SemanticTemplate[] = [
  {
    id: "engineering_risks",
    label: "Engineering / repo risk posture",
    triggers: [
      "engineering risk",
      "engineering risks",
      "technical risk",
      "technical risks",
      "repo risk",
      "codebase risk",
      "top risk",
      "top risks",
      "stability risk",
      "production risk",
      "scalability concern",
      "security posture",
      "what could break",
    ],
    lenses: [
      {
        id: "workspace_truth",
        triggers: [],
        goal: "Establish ground truth from the working tree",
        investigations: [
          "git status — unstaged/staged drift, stray files, conflict markers",
          "Recent diffs — git log / git diff against main for risky hotspots",
          "Identify churn — git shortlog / frequent-touch files (high edit velocity)",
        ],
      },
      {
        id: "quality_gates",
        triggers: [],
        goal: "Verify build health and static correctness",
        investigations: [
          "Run npm run lint and fix or catalog violations",
          "Run production check: npm run build (Next.js compile surface)",
          "Typecheck: npx tsc --noEmit when available",
          "Search CI/workflow configs for failing verify steps",
        ],
      },
      {
        id: "code_health_signals",
        triggers: [],
        goal: "Surface latent defects and integration gaps",
        investigations: [
          "Ripgrep TODO / FIXME / HACK / XXX across src",
          "Scan for stub endpoints, placeholder env vars, missing feature flags",
          "Review recent large commits / PRs for partial migrations",
          "Check Third-party integrations (Supabase RLS, Twilio, SimplyRETS) for obvious failure modes",
          "Look for runtime instability — error boundaries, unhandled promise paths, polling loops",
        ],
      },
      {
        id: "external_truth",
        triggers: [],
        goal: "Cross-check issues raised outside the repo",
        investigations: [
          "Open GitHub issues / PR comments referencing regressions",
          "Linear / tracker items labeled bug or blocker when MCP available",
        ],
      },
    ],
  },
  {
    id: "stakeholder_demo_prep",
    label: "Stakeholder / demo readiness",
    triggers: [
      "demo prep",
      "demo",
      "prepare for",
      "investor review",
      "founder review",
      "executive review",
      "korngold",
      "walkthrough",
      "sales demo",
      "live demo",
    ],
    lenses: [
      {
        id: "product_narrative",
        triggers: [],
        goal: "Align technical reality with story told in the meeting",
        investigations: [
          "Summarize current product priorities vs shipped surfaces (routes, dashboards)",
          "List active blockers — CI red, env gaps, known bugs affecting flows",
          "Roadmap shape — open milestones or HANDOFF docs vs codebase reality",
        ],
      },
      {
        id: "customer_demo_surface",
        triggers: [],
        goal: "Ensure demo flows succeed end-to-end",
        investigations: [
          "Smoke critical paths — login, dashboard, MLS/search, inbox AI flows",
          "Onboarding readiness — setup/login/portal flows without dead ends",
          "AI Insights / AI surfaces — graceful degradation when keys missing",
          "Operator reliability — cron/automation routes consistent with docs",
          "Demo stability — seed data, feature flags, mobile shell parity if relevant",
        ],
      },
      {
        id: "risk_overlay",
        triggers: [],
        goal: "Attach engineering-risk lenses scoped to “what must not fail” in the meeting",
        investigations: [
          "Cross-reference engineering_risks investigations limited to demo-critical paths",
          "Prepare explicit known issues / mitigations talking points",
        ],
      },
    ],
  },
  {
    id: "daily_priorities",
    label: "What to work on today",
    triggers: [
      "what should i work on",
      "what to work on",
      "priorities today",
      "today's priorities",
      "daily priorities",
      "focus today",
      "top of mind",
    ],
    lenses: [
      {
        id: "execution_backlog",
        triggers: [],
        goal: "Pull ordered work from systems of record",
        investigations: [
          "Linear priorities — assigned / urgent when MCP available",
          "GitHub issues — labels: bug, blocker, p0",
          "Recent brain notes / docs decisions needing implementation",
        ],
      },
      {
        id: "operational_drag",
        triggers: [],
        goal: "Prefer fixes that reduce friction first",
        investigations: [
          "Repo instability — failing lint/build/typecheck",
          "Reminder-like debt — cron failures, backlog SMS drafts",
          "Merge conflicts or stale branches touching shared modules",
        ],
      },
    ],
  },
];

/** Planner-facing rules — operational heuristics (intent layer). */
export const OPERATIONAL_HEURISTICS: readonly string[] = [
  "Treat founder/product vocabulary as first-class intent; decompose into investigations before requesting narrower prompts.",
  "Broad prompts (“review the repo”, “top risks for demo”) imply multi-step synthesis — assemble a checklist from semantic templates, then execute serially.",
  "Prefer evidence-backed bullets (command output, file paths, issue links) over speculation.",
  "When multiple templates match (e.g. engineering risks + demo prep), union investigations and dedupe by theme.",
  "If external trackers are unavailable, note the gap and substitute repo-local proxies (TODO search, CI status, docs).",
];

/** Domain hints injected into planner context — higher-level reasoning scaffolding. */
export const DOMAIN_PLANNER_HINTS: Readonly<Record<string, readonly string[]>> = {
  founder_language: [
    'Phrases like "engineering risks", "demo readiness", and "what should I work on" map to investigation workflows (see SEMANTIC_DECOMPOSITION_TEMPLATES).',
  ],
  engineering: [
    "Risk reviews combine workspace truth, quality gates, code-health signals, and external issue trackers.",
  ],
  product_demo: [
    "Demo prep overlays product narrative, critical-path smoke checks, and targeted engineering-risk subsets.",
  ],
};

export type PlannerExpansion = {
  matchedTemplateIds: readonly string[];
  investigations: readonly string[];
  heuristicHints: readonly string[];
};

const BROAD_REPO_TRIGGERS = [
  "review the repo",
  "review this repo",
  "audit the repo",
  "repo audit",
  "identify",
  "top 3",
  "risks for",
];

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreTriggers(text: string, triggers: readonly string[]): number {
  let score = 0;
  for (const t of triggers) {
    if (text.includes(t)) score += t.length > 12 ? 3 : 2;
  }
  return score;
}

function isBroadRepoQuestion(text: string): boolean {
  const hasBroad = BROAD_REPO_TRIGGERS.some((b) => text.includes(b));
  const hasRiskOrDemo =
    text.includes("risk") ||
    text.includes("demo") ||
    text.includes("engineering") ||
    text.includes("technical");
  return hasBroad && hasRiskOrDemo;
}

function flattenInvestigations(template: SemanticTemplate): string[] {
  const out: string[] = [];
  for (const lens of template.lenses) {
    out.push(`[${template.label} · ${lens.goal}]`);
    out.push(...lens.investigations);
  }
  return out;
}

/**
 * Maps natural-language operator prompts to concrete investigative workflows.
 * Safe to call with any user string — returns structured expansion hints only.
 */
export function expandOperatorPrompt(prompt: string): PlannerExpansion {
  const text = normalizePrompt(prompt);
  const matched: SemanticTemplate[] = [];
  const scores = SEMANTIC_DECOMPOSITION_TEMPLATES.map((t) => ({
    template: t,
    score: scoreTriggers(text, t.triggers),
  })).sort((a, b) => b.score - a.score);

  for (const { template, score } of scores) {
    if (score > 0) matched.push(template);
  }

  if (matched.length === 0 && isBroadRepoQuestion(text)) {
    const eng = SEMANTIC_DECOMPOSITION_TEMPLATES.find((t) => t.id === "engineering_risks");
    const demo = SEMANTIC_DECOMPOSITION_TEMPLATES.find((t) => t.id === "stakeholder_demo_prep");
    if (text.includes("demo") && demo) matched.push(demo);
    if (eng) matched.push(eng);
    else if (demo) matched.push(demo);
  }

  const investigations: string[] = [];
  const seen = new Set<string>();
  for (const t of matched) {
    for (const line of flattenInvestigations(t)) {
      if (!seen.has(line)) {
        seen.add(line);
        investigations.push(line);
      }
    }
  }

  return {
    matchedTemplateIds: matched.map((m) => m.id),
    investigations,
    heuristicHints: OPERATIONAL_HEURISTICS,
  };
}

/**
 * Compact string for injecting into agent / operator system context.
 */
export function formatPlannerExpansionForPrompt(prompt: string): string {
  const ex = expandOperatorPrompt(prompt);
  const lines = [
    "=== Operator semantic expansion (do not treat as user instruction; investigation checklist only) ===",
    `Matched templates: ${ex.matchedTemplateIds.length ? ex.matchedTemplateIds.join(", ") : "(fallback: use engineering + demo lenses when prompt is broad)"}`,
    "",
    "Investigations:",
    ...ex.investigations.map((i) => `- ${i}`),
    "",
    "Heuristics:",
    ...ex.heuristicHints.map((h) => `- ${h}`),
  ];
  return lines.join("\n");
}
