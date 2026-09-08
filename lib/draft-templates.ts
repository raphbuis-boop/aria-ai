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

// Stable per-client variant selection: the same client always gets the same
// phrasing, but different clients in the same scenario get different ones —
// so a demo list never reads as the same sentence over and over.
function seedIndex(seed: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % n;
}
function pick(variants: string[], seed: string): string {
  return variants[seedIndex(seed, variants.length)];
}

export function smartTemplateDraft(item: TodayItem): string {
  const first = firstNameOf(item.clientName);
  const seed = item.clientId || item.clientName;

  switch (item.urgencyRank) {
    // 1 — closing at risk
    case 1: {
      const address = item.reason.match(/^Closing at (.+)$/)?.[1];
      return address
        ? pick(
            [
              `Hi ${first} — your closing at ${address} is almost here! Everything's on track on my end. Anything you need before we get there?`,
              `${first}, we're in the home stretch on ${address}! I've got it all lined up — just shout if anything comes up before closing.`,
              `Big week ahead, ${first} — closing on ${address} is right around the corner. All good on my side; let me know if you need anything.`,
            ],
            seed,
          )
        : pick(
            [
              `Hi ${first} — your closing is almost here! Everything's on track on my end — let me know if anything comes up.`,
              `${first}, we're in the home stretch! I've got everything lined up on my side. Anything you need before we close?`,
            ],
            seed,
          );
    }

    // 2 — hot lead gone quiet
    case 2: {
      const where = locationBudgetPhrase(item.clientTown, item.clientBudgetMax);
      return where
        ? pick(
            [
              `Hey ${first} — it's been a minute since we caught up on your ${where} search. Still watching the market for you — want me to send a few fresh listings this week?`,
              `${first}! Haven't talked in a bit about your ${where} hunt. A couple new places came up worth a look — want me to send them over?`,
              `Hi ${first} — didn't want your ${where} search to go quiet on my end. Should I pull together some new options for you this week?`,
            ],
            seed,
          )
        : pick(
            [
              `Hey ${first} — it's been a minute since we caught up. Still keeping an eye out for you — want me to send a few new places this week?`,
              `${first}! Been a bit — want me to round up some fresh listings for you?`,
            ],
            seed,
          );
    }

    // 3 — birthday or home-purchase anniversary
    case 3: {
      if (/birthday/i.test(item.reason)) {
        return pick(
          [
            `Happy birthday, ${first}! 🎉 Hope today's a great one.`,
            `${first}, happy birthday! 🎉 Wishing you a fantastic day.`,
          ],
          seed,
        );
      }
      const years = yearsFromReason(item.reason);
      return years
        ? pick(
            [
              `Hi ${first} — happy home-anniversary! Hard to believe it's been ${years} year${years === 1 ? "" : "s"} since you closed. Hope the place still feels like home 🏡`,
              `${first} — ${years} year${years === 1 ? "" : "s"} in the house already! Happy home-anniversary. Hope you're still loving it 🏡`,
            ],
            seed,
          )
        : `Hi ${first} — happy home-anniversary! Hope you're loving the place as much as day one 🏡`;
    }

    // 4 — buyer agreement not signed
    case 4: {
      const where = item.clientTown ? ` in ${item.clientTown}` : "";
      return pick(
        [
          `Hey ${first} — whenever you get a sec, mind signing the buyer agreement? It lets me keep sending you listings${where} with no hold-ups.`,
          `${first} — quick one: could you sign the buyer agreement when you have a moment? Then I can keep the listings${where} coming your way.`,
          `Hi ${first} — one small thing: the buyer agreement still needs your signature. Once that's in, I'll keep the${where} places flowing.`,
        ],
        seed,
      );
    }

    // 5 — new MLS match
    case 5: {
      if (item.propertyAddress) {
        const budget = item.clientBudgetMax ? `, right in your budget at ${fmtMoney(item.clientBudgetMax)}` : "";
        return pick(
          [
            `Hey ${first} — a new listing just hit at ${item.propertyAddress}${budget}. Want details or should I set up a showing?`,
            `${first} — just spotted ${item.propertyAddress}${budget}. Looks like a fit — want more info or a tour?`,
            `New one for you, ${first}: ${item.propertyAddress}${budget}. Should I send details or book a showing?`,
          ],
          seed,
        );
      }
      const where = locationBudgetPhrase(item.clientTown, item.clientBudgetMax);
      const tail = where ? ` for your ${where} search` : "";
      return pick(
        [
          `Hey ${first} — a new listing just came up that looks like a great fit${tail}. Want me to send it over?`,
          `${first} — something new hit the market that matches what you're after${tail}. Want a look?`,
        ],
        seed,
      );
    }

    default:
      return pick(
        [
          `Hi ${first} — wanted to check in. How are things going on your end?`,
          `Hey ${first} — just thinking about you. Anything I can help with right now?`,
          `${first} — checking in! Let me know if there's anything you need from me.`,
        ],
        seed,
      );
  }
}
