/**
 * NJ town options + adjacency map for smart vicinity matching.
 *
 * The adjacency map is approximate — it covers the core Northern NJ / Essex /
 * Bergen / Union / Morris markets that our agents operate in. If a town isn't
 * in the map, `getAdjacentTowns` returns an empty array and the matcher falls
 * back to exact-match only for that town.
 *
 * Keys and values are canonicalized via `normalizeTown()` — compare with
 * `normalizeTown` before lookup.
 */
export const NJ_TOWN_OPTIONS = [
  "Ridgewood",
  "Montclair",
  "Summit",
  "Hoboken",
  "Westfield",
  "Short Hills",
  "Maplewood",
  "Glen Ridge",
  "Jersey City",
  "Princeton",
  "Madison",
  "Chatham",
  "Millburn",
  "South Orange",
  "Edgewater",
  "Englewood",
  "Tenafly",
  "Alpine",
  "Cresskill",
  "Glen Rock",
  "Ho-Ho-Kus",
  "Wyckoff",
  "Franklin Lakes",
  "Fair Lawn",
  "Paramus",
  "Demarest",
  "Haworth",
  "West Orange",
  "Livingston",
  "Morristown",
  "New Providence",
  "Berkeley Heights",
  "Scotch Plains",
  "Cranford",
  "Garwood",
  "Mountainside",
  "Springfield",
  "Union",
  "Clifton",
] as const;

export type NjTown = (typeof NJ_TOWN_OPTIONS)[number];

/**
 * Canonical form for town lookups: trimmed, lowercased, collapse whitespace,
 * normalize "ho-ho-kus" vs "ho ho kus", strip trailing ", NJ".
 */
export function normalizeTown(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/,\s*nj\s*$/i, "")
    .replace(/[\s-]+/g, " ")
    .trim();
}

// Adjacency is expressed using normalized keys/values so lookups are simple.
// Each town lists its geographically-adjacent towns (border-sharing or one
// short drive away) within the same broad market. Bidirectional where
// appropriate — we normalize the graph in `buildBidirectional()` below.
const RAW_ADJACENCY: Record<string, string[]> = {
  // Bergen County
  Ridgewood: ["Glen Rock", "Ho-Ho-Kus", "Wyckoff", "Paramus", "Fair Lawn"],
  "Glen Rock": ["Ridgewood", "Fair Lawn", "Paramus"],
  "Ho-Ho-Kus": ["Ridgewood", "Wyckoff", "Waldwick"],
  Wyckoff: ["Ho-Ho-Kus", "Ridgewood", "Franklin Lakes"],
  "Franklin Lakes": ["Wyckoff", "Oakland"],
  "Fair Lawn": ["Glen Rock", "Ridgewood", "Paramus", "Clifton"],
  Paramus: ["Ridgewood", "Fair Lawn", "Glen Rock", "Hackensack", "River Edge"],
  Tenafly: ["Englewood", "Cresskill", "Demarest", "Alpine"],
  Englewood: ["Tenafly", "Cresskill", "Edgewater"],
  Cresskill: ["Tenafly", "Demarest", "Englewood"],
  Demarest: ["Cresskill", "Haworth", "Tenafly"],
  Haworth: ["Demarest", "Cresskill"],
  Alpine: ["Tenafly", "Cresskill"],
  Edgewater: ["Englewood", "Cliffside Park"],

  // Hudson County
  Hoboken: ["Jersey City", "Weehawken"],
  "Jersey City": ["Hoboken", "Bayonne", "Weehawken"],

  // Essex County
  Montclair: ["Glen Ridge", "Bloomfield", "Verona", "Cedar Grove", "West Orange"],
  "Glen Ridge": ["Montclair", "Bloomfield"],
  "West Orange": ["Montclair", "Livingston", "South Orange", "Orange"],
  "South Orange": ["Maplewood", "West Orange", "Orange"],
  Maplewood: ["South Orange", "Millburn", "Irvington"],
  Millburn: ["Maplewood", "Short Hills", "Summit", "Livingston", "Springfield"],
  "Short Hills": ["Millburn", "Summit", "Livingston"],
  Livingston: ["West Orange", "Millburn", "Short Hills", "Florham Park", "Roseland"],

  // Union County
  Summit: [
    "Short Hills",
    "New Providence",
    "Berkeley Heights",
    "Springfield",
    "Chatham",
    "Millburn",
  ],
  "New Providence": ["Summit", "Berkeley Heights", "Murray Hill"],
  "Berkeley Heights": ["New Providence", "Summit", "Mountainside"],
  Westfield: ["Cranford", "Garwood", "Scotch Plains", "Mountainside", "Clark"],
  "Scotch Plains": ["Westfield", "Fanwood", "Mountainside", "Plainfield"],
  Cranford: ["Westfield", "Garwood", "Clark", "Kenilworth"],
  Garwood: ["Westfield", "Cranford"],
  Mountainside: ["Westfield", "Scotch Plains", "Berkeley Heights", "Springfield"],
  Springfield: ["Summit", "Millburn", "Mountainside", "Union"],
  Union: ["Springfield", "Kenilworth", "Hillside"],

  // Morris County
  Chatham: ["Madison", "Summit", "Florham Park"],
  Madison: ["Chatham", "Morristown", "Florham Park"],
  Morristown: ["Madison", "Morris Township", "Convent Station"],

  // Passaic / Clifton corridor
  Clifton: ["Paterson", "Nutley", "Passaic", "Fair Lawn"],
};

function buildBidirectional(
  raw: Record<string, string[]>,
): Record<string, string[]> {
  const map = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    const ka = normalizeTown(a);
    const kb = normalizeTown(b);
    if (!ka || !kb || ka === kb) return;
    if (!map.has(ka)) map.set(ka, new Set());
    if (!map.has(kb)) map.set(kb, new Set());
    map.get(ka)!.add(kb);
    map.get(kb)!.add(ka);
  };
  for (const [town, neighbors] of Object.entries(raw)) {
    for (const n of neighbors) add(town, n);
  }
  const out: Record<string, string[]> = {};
  map.forEach((v, k) => {
    out[k] = Array.from(v).sort();
  });
  return out;
}

export const NJ_TOWN_ADJACENCY: Record<string, string[]> =
  buildBidirectional(RAW_ADJACENCY);

/**
 * Returns normalized names of towns adjacent to `town`. Empty array if the
 * town isn't in the adjacency map.
 */
export function getAdjacentTowns(town: string | null | undefined): string[] {
  const key = normalizeTown(town);
  if (!key) return [];
  return NJ_TOWN_ADJACENCY[key] ?? [];
}

/**
 * True if `a` and `b` are the same town (normalized) OR `b` is adjacent to `a`.
 */
export function isTownAdjacentOrEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = normalizeTown(a);
  const kb = normalizeTown(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const neighbors = NJ_TOWN_ADJACENCY[ka];
  return !!neighbors && neighbors.includes(kb);
}
