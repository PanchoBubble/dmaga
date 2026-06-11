import "server-only";

/**
 * Tiny in-process TTL cache for expensive provider solves (each VyManga
 * series/chapter fetch is a ~20s byparr Cloudflare solve). A single app instance
 * serves all requests, so a module-level Map is enough — no Redis round-trip.
 * In-flight promises are shared too, so concurrent hits for the same key (e.g.
 * a Next.js prefetch racing the real click) collapse into one solve.
 */
type Entry<T> = { value: Promise<T>; expires: number };

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) {
    return hit.value;
  }

  const value = fn();
  store.set(key, { value, expires: now + ttlMs });
  // If the solve rejects, don't cache the failure — drop it so the next call retries.
  value.catch(() => {
    if (store.get(key)?.value === value) {
      store.delete(key);
    }
  });
  return value;
}
