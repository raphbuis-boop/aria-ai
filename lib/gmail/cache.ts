/**
 * Tiny in-memory per-instance cache for Gmail responses.
 *
 * Caveats:
 *   • Per-instance: on Vercel, different function invocations may hit
 *     different workers — the cache is best-effort, not authoritative.
 *   • 60-second TTL as spec'd.  Enough to debounce repeated "open client
 *     detail" clicks without hammering Gmail's quota.
 *
 * Keys are scoped by agent id to ensure one agent can never read another's
 * cached data.  We clone the returned value on read so callers can't mutate
 * the cached object.
 */

const TTL_MS = 60 * 1000;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function cacheKey(agentId: string, ...parts: string[]): string {
  return [agentId, ...parts].join("::");
}

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return structuredClone(e.value) as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = TTL_MS): void {
  store.set(key, {
    value: structuredClone(value) as T,
    expiresAt: Date.now() + ttlMs,
  });
  // Cheap passive GC: every ~100 sets, sweep expired entries.
  if (store.size % 100 === 0) {
    const now = Date.now();
    store.forEach((entry, k) => {
      if (entry.expiresAt < now) store.delete(k);
    });
  }
}

export function cacheInvalidate(prefix: string): void {
  const keys: string[] = [];
  store.forEach((_, k) => {
    if (k.startsWith(prefix)) keys.push(k);
  });
  for (const k of keys) store.delete(k);
}
