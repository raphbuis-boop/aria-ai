import { fmtMoney } from "./utils";

/**
 * Turns the matching engine's raw per-component reason strings (e.g.
 * "preferred town ✅", "budget ✅ ($625K)", "townhouse ✅", "new listing")
 * into one natural sentence an agent would actually read — used everywhere
 * match reasons are shown (property detail's Aria match section, the
 * properties list card). Reads real values off the property record rather
 * than parsing numbers out of the raw reason text, so it's accurate even if
 * the raw reason wording varies between the seed data and the live scoring
 * engine (lib/matching.ts).
 */

export type MatchProperty = {
  town: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  propertyType: string | null;
};

function firstNameOf(name: string): string {
  return name.split(/\s+(?:&|and)\s+/i)[0].split(" ")[0];
}

function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** "single_family" → "single family" — used inline in a sentence, lowercase on purpose. */
export function humanizePropertyType(type: string | null): string | null {
  if (!type) return null;
  return type.replace(/_/g, " ");
}

/** "single_family" → "Single family" — used as a standalone field value. */
export function titleCasePropertyType(type: string | null): string | null {
  const lower = humanizePropertyType(type);
  if (!lower) return null;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function humanizeMatchReasons(
  clientName: string,
  reasons: string[],
  property: MatchProperty,
): string {
  const first = firstNameOf(clientName);
  const poss = possessive(first);
  const joined = reasons.join(" | ").toLowerCase();
  const clauses: string[] = [];
  // Only the first clause uses the client's name possessively ("Amanda's
  // preferred town") — every clause after that says "their" instead, so the
  // sentence doesn't repeat the name.
  let namedOnce = false;
  function theirs(): string {
    if (namedOnce) return "their";
    namedOnce = true;
    return poss;
  }

  // Town — highest-weighted signal, leads the sentence when present.
  if (/preferred town/.test(joined) && property.town) {
    clauses.push(`in ${theirs()} preferred town of ${property.town}`);
  } else if (/adjacent/.test(joined) && property.town) {
    clauses.push(`just outside ${theirs()} preferred area, in ${property.town}`);
  } else if (property.town) {
    clauses.push(`in ${property.town}`);
  }

  // Budget
  if (property.price) {
    if (/over budget|% over|stretch/.test(joined)) {
      clauses.push(`a bit above ${theirs()} budget, but close enough to be worth a look`);
    } else if (/under budget|% under/.test(joined)) {
      clauses.push(`comfortably under ${theirs()} budget at ${fmtMoney(property.price)}`);
    } else if (/budget|within/.test(joined)) {
      clauses.push(`right at ${theirs()} budget of ${fmtMoney(property.price)}`);
    }
  }

  // Property type — only when the match data actually called it out.
  const humanType = humanizePropertyType(property.propertyType);
  if (humanType && new RegExp(humanType.split(" ")[0], "i").test(joined)) {
    clauses.push(`the ${humanType} style they're after`);
  }

  // Beds/baths — lower priority, only included if we still have room.
  if (clauses.length < 3 && (property.beds || property.baths)) {
    const wantsBeds = /\dbr|beds? ✓|bd \(wants/.test(joined);
    const wantsBaths = /\dba|baths? ✓|ba \(wants/.test(joined);
    if (wantsBeds && wantsBaths && property.beds && property.baths) {
      clauses.push(`the ${property.beds}-bed, ${property.baths}-bath layout they need`);
    } else if (wantsBeds && property.beds) {
      clauses.push(`the ${property.beds}-bedroom space they need`);
    } else if (wantsBaths && property.baths) {
      clauses.push(`the ${property.baths}-bath count they need`);
    }
  }

  const picked = clauses.slice(0, 3);
  let sentence: string;
  if (picked.length === 0) {
    sentence = `A solid match for ${first} based on their saved criteria`;
  } else if (picked.length === 1) {
    sentence = `A fit for ${first} — ${picked[0]}`;
  } else {
    sentence = picked.slice(0, -1).join(", ") + ", and " + picked[picked.length - 1];
  }

  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  sentence += /new listing/.test(joined) ? " — just hit the market." : ".";
  return sentence;
}
