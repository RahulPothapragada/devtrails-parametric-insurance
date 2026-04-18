/**
 * Tiny in-browser cache for GET requests.
 *
 * Two modes:
 *   cachedFetch(url, { ttl })  — returns cached within TTL, else network.
 *   swrFetch(url, { maxAge })  — stale-while-revalidate: returns cached
 *     *immediately* (even if stale, up to maxAge) AND kicks a background
 *     refetch. Caller gets { cached, promise } — render cached, then
 *     update state when the promise resolves.
 *
 * Storage choice per call:
 *   storage: "local"   — localStorage. Survives tab close + browser restart.
 *                        Use for PUBLIC or ADMIN-shared data (stats, cities,
 *                        actuarial) so the very first load of a new day is
 *                        still instant.
 *   storage: "session" — sessionStorage (default). Clears when the tab closes.
 *                        Use for RIDER-AUTHENTICATED data (/riders/me,
 *                        /claims, /policies) so one rider's data doesn't
 *                        bleed into another rider's session on the same
 *                        browser.
 *
 * All entries are namespaced by a schema VERSION — bump VERSION when you
 * change API shapes and every old cached entry is ignored automatically.
 */

type CacheEntry<T> = { data: T; ts: number };
type StorageKind = "local" | "session";

// ── Schema version ────────────────────────────────────────────────────────────
// Bump this when a cached endpoint's response shape changes. Old entries
// under a different prefix will simply be unreachable and cleaned up on the
// next successful write.
const VERSION = "v1";
const PREFIX = `cf:${VERSION}:`;

// In-memory layer — alive across SPA route changes. Keyed by `${storage}|${url}`
// so the same URL cached into local vs session storage doesn't collide.
const mem = new Map<string, CacheEntry<unknown>>();

function safeStorage(kind: StorageKind): Storage | null {
  try {
    return kind === "local" ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

function memKey(kind: StorageKind, url: string) {
  return `${kind}|${url}`;
}

function readStore<T>(kind: StorageKind, url: string): CacheEntry<T> | null {
  const store = safeStorage(kind);
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + url);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writeStore<T>(kind: StorageKind, url: string, entry: CacheEntry<T>) {
  const store = safeStorage(kind);
  if (!store) return;
  try {
    store.setItem(PREFIX + url, JSON.stringify(entry));
  } catch {
    // Quota exceeded / disabled — in-memory cache still works.
  }
}

function getEntry<T>(kind: StorageKind, url: string): CacheEntry<T> | null {
  const mk = memKey(kind, url);
  const hit = mem.get(mk) as CacheEntry<T> | undefined;
  if (hit) return hit;
  const fromDisk = readStore<T>(kind, url);
  if (fromDisk) mem.set(mk, fromDisk);
  return fromDisk;
}

function setEntry<T>(kind: StorageKind, url: string, data: T) {
  const entry: CacheEntry<T> = { data, ts: Date.now() };
  mem.set(memKey(kind, url), entry);
  writeStore(kind, url, entry);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * TTL cache. Returns cached data if fresh; otherwise fetches.
 * Throws on network error — caller handles like a regular fetch.
 */
export async function cachedFetch<T>(
  url: string,
  opts: {
    ttl?: number;
    init?: RequestInit;
    bustCache?: boolean;
    storage?: StorageKind;
  } = {},
): Promise<T> {
  const { ttl = 30_000, init, bustCache = false, storage = "session" } = opts;

  if (!bustCache) {
    const hit = getEntry<T>(storage, url);
    if (hit && Date.now() - hit.ts < ttl) return hit.data;
  }

  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const data = (await res.json()) as T;
  setEntry(storage, url, data);
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
  opts: {
    maxAge?: number;
    init?: RequestInit;
    storage?: StorageKind;
  } = {},
): { cached: T | null; promise: Promise<T> } {
  const { maxAge = 5 * 60_000, init, storage = "session" } = opts;

  const hit = getEntry<T>(storage, url);
  const cached = hit && Date.now() - hit.ts < maxAge ? hit.data : null;

  const promise = (async () => {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const data = (await res.json()) as T;
    setEntry(storage, url, data);
    return data;
  })();

  return { cached, promise };
}

/**
 * Drop any cache entry whose URL contains `prefix`, across both storages.
 * Call after a mutation — e.g., after cancelling a policy, bust "/riders/me"
 * and "/policies/active".
 */
export function invalidateCache(prefix: string) {
  for (const mk of Array.from(mem.keys())) {
    // mk format: `${kind}|${url}` — match on url portion.
    const pipeIdx = mk.indexOf("|");
    const url = pipeIdx >= 0 ? mk.slice(pipeIdx + 1) : mk;
    if (url.includes(prefix)) mem.delete(mk);
  }
  for (const kind of ["local", "session"] as StorageKind[]) {
    const store = safeStorage(kind);
    if (!store) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(PREFIX) && k.slice(PREFIX.length).includes(prefix)) {
          keys.push(k);
        }
      }
      keys.forEach((k) => store.removeItem(k));
    } catch {
      /* noop */
    }
  }
}

/**
 * Drop every rider-authenticated cache entry. Call this from logout +
 * after switching accounts so rider A's dashboard never shows on rider B's
 * screen. These live in sessionStorage + in-memory.
 */
export function clearAuthedCache() {
  for (const mk of Array.from(mem.keys())) {
    if (mk.startsWith("session|")) mem.delete(mk);
  }
  const store = safeStorage("session");
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => store.removeItem(k));
  } catch {
    /* noop */
  }
}

/** Wipe every cached entry — memory, session, local. */
export function clearCache() {
  mem.clear();
  for (const kind of ["local", "session"] as StorageKind[]) {
    const store = safeStorage(kind);
    if (!store) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach((k) => store.removeItem(k));
    } catch {
      /* noop */
    }
  }
}
