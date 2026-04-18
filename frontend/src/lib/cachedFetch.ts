/**
 * Tiny in-browser cache for GET requests.
 *
 * Two modes:
 *   cachedFetch(url, { ttl })  — returns cached within TTL, else network.
 *   swrFetch(url, { maxAge })  — stale-while-revalidate: returns cached
 *     *immediately* (even if stale, up to maxAge) AND kicks a background
 *     refetch. The caller gets { cached, promise } — render cached, then
 *     update state when the promise resolves.
 *
 * Storage layers (checked in order):
 *   1. Module-level Map  — alive across page navigations within a tab.
 *   2. sessionStorage    — survives SPA route changes + hard refresh in tab.
 *
 * No external dependency. Safe on SSR (guards sessionStorage).
 */

type CacheEntry<T> = { data: T; ts: number };

const mem = new Map<string, CacheEntry<unknown>>();
const PREFIX = "cf:";

function readSession<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writeSession<T>(key: string, entry: CacheEntry<T>) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota / disabled — memory cache still works.
  }
}

function getEntry<T>(key: string): CacheEntry<T> | null {
  const hit = mem.get(key) as CacheEntry<T> | undefined;
  if (hit) return hit;
  const fromSession = readSession<T>(key);
  if (fromSession) mem.set(key, fromSession);
  return fromSession;
}

function setEntry<T>(key: string, data: T) {
  const entry: CacheEntry<T> = { data, ts: Date.now() };
  mem.set(key, entry);
  writeSession(key, entry);
}

/**
 * Simple TTL cache. Returns cached data if fresh; otherwise fetches.
 * Throws on network error — caller handles like a regular fetch.
 */
export async function cachedFetch<T>(
  url: string,
  opts: { ttl?: number; init?: RequestInit; bustCache?: boolean } = {},
): Promise<T> {
  const { ttl = 30_000, init, bustCache = false } = opts;
  const key = url;

  if (!bustCache) {
    const hit = getEntry<T>(key);
    if (hit && Date.now() - hit.ts < ttl) return hit.data;
  }

  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const data = (await res.json()) as T;
  setEntry(key, data);
  return data;
}

/**
 * Stale-while-revalidate.
 * Returns { cached, promise } — render `cached` instantly (may be null or
 * up to `maxAge` old), then update from `promise` when it lands. The promise
 * also writes to the cache so the *next* page visit is instant too.
 */
export function swrFetch<T>(
  url: string,
  opts: { maxAge?: number; init?: RequestInit } = {},
): { cached: T | null; promise: Promise<T> } {
  const { maxAge = 5 * 60_000, init } = opts;
  const key = url;

  const hit = getEntry<T>(key);
  const cached = hit && Date.now() - hit.ts < maxAge ? hit.data : null;

  const promise = (async () => {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const data = (await res.json()) as T;
    setEntry(key, data);
    return data;
  })();

  return { cached, promise };
}

/**
 * Drop any cache entry whose key contains `prefix`. Call after a mutation
 * that invalidates what you just cached — e.g., after cancelling a policy,
 * bust "/riders/me" and "/policies/active".
 */
export function invalidateCache(prefix: string) {
  for (const k of Array.from(mem.keys())) {
    if (k.includes(prefix)) mem.delete(k);
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIX) && k.includes(prefix)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* noop */
  }
}

/** Wipe every cached entry this helper owns. */
export function clearCache() {
  mem.clear();
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* noop */
  }
}
