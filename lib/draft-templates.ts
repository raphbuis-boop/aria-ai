import type { TodayItem } from "./today-items";
import { fmtMoney } from "./utils";

/**
 * Client-side draft templates, tailored per follow-up reason (urgencyRank).
 * Used when the real AI drafting endpoint (/api/ai/draft-text) is
 * unavailable or falls back to its own generic line — see isGenericAiFallback
 * below. Each branch pulls the client's actual data (town, budget, property,
 * reason text) so no two drafts read the same, matching the "money-first,
 * genuinely tailored" bar the follow-ups queue is built to.
 */

/** Detects the /api/ai/draft-text route's own hardcoded fallback strings. */
export function isGenericAiFallback(draft: string): boolean {
  return (
    /just wanted to check in on your search/i.test(draft) ||
    /found a property that might check your boxes/i.test(draft)
  );
}

function firstNameOf(name: string): string {
  return name.split(" ")[0];
}

/** "Tenafly" / "$1.2M–1.5M" / "Tenafly, budget up to $1.2M" — whatever real fields exist. */
function locationBudgetPhrase(town: string | null, budgetMax: number | null): string {
  if (town && budgetMax) return `${town}, up to ${fmtMoney(budgetMax)}`;
  if (town) return town;
  if (budgetMax) return `up to ${fmtMoney(budgetMax)}`;
  return "";
}

function yearsFromReason(reason: string): number | null {
  const m = reason.match(/(\d+)\s+years?\s+ago/i);
  return m ? Number(m[1]) : null;
}

export function smartTemplateDraft(item: TodayItem): string {
  const first = firstNameOf(item.clientName);

  switch (item.urgencyRank) {
    // 1 — closing at risk
    case 1: {
      const addressMatch = item.reason.match(/^Closing at (.+)$/);
      const address = addressMatch?.[1];
      return address
        ? `Hi ${first} — your closing at ${address} is almost here! Everything looks good on my end — let me know if anything comes up before then.`
        : `Hi ${first} — your closing is coming up soon! Everything looks good on my end — let me know if anything comes up.`;
    }

    // 2 — hot lead gone quiet
    case 2: {
      const where = locationBudgetPhrase(item.clientTown, item.clientBudgetMax);
      return where
        ? `Hey ${first} — it's been a bit since we caught up on your ${where} search. Still keeping an eye out for you — want me to send over a few new places this week?`
        : `Hey ${first} — it's been a bit since we caught up. Still keeping an eye out for you — want me to send over a few new places this week?`;
    }

    // 3 — birthday or home-purchase anniversary
    case 3: {
      if (/birthday/i.test(item.reason)) {
        return `Happy birthday, ${first}! 🎉 Hope you're having a great day — thinking of you!`;
      }
      const years = yearsFromReason(item.reason);
      return years
        ? `Hi ${first} — happy home-anniversary! Hard to believe it's been ${years} year${years === 1 ? "" : "s"} since you closed. Hope you're loving the place as much as day one 🏡`
        : `Hi ${first} — happy home-anniversary! Hope you're loving the place as much as day one 🏡`;
    }

    // 4 — buyer agreement not signed
    case 4: {
      const where = item.clientTown ? ` in ${item.clientTown}` : "";
      return `Hey ${first} — whenever you get a sec, can you sign the buyer agreement? I want to keep sending you listings${where} without any holdup.`;
    }

    // 5 — new MLS match
    case 5: {
      if (item.propertyAddress) {
        const budget = item.clientBudgetMax ? `, and it's right in your budget at ${fmtMoney(item.clientBudgetMax)}` : "";
        return `Hey ${first} — a new listing just hit the market at ${item.propertyAddress}${budget}. Want me to send details or set up a showing?`;
      }
      const where = locationBudgetPhrase(item.clientTown, item.clientBudgetMax);
      return `Hey ${first} — a new listing just hit the market that looks like a great fit${where ? ` for your ${where} search` : ""}. Want me to send it over?`;
    }

    default:
      return `Hi ${first} — wanted to check in. Let me know how things are going on your end.`;
  }
}
