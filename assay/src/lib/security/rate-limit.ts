/**
 * Rate limits protect the endpoints an attacker would hammer: login, bidding,
 * uploads. This is an in-memory sliding window — correct for a single
 * instance (which is what this app runs as). A multi-instance production
 * deployment would swap this module for a shared store (e.g. Upstash Redis)
 * without changing any call site, since every route only calls
 * `enforceRateLimit(name, identifier)`.
 */
export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many requests. Please slow down.");
  }
}

type Limiter = { max: number; windowMs: number };

const limiters = {
  auth: { max: 5, windowMs: 60_000 },
  bid: { max: 10, windowMs: 10_000 },
  upload: { max: 5, windowMs: 60_000 },
  default: { max: 30, windowMs: 10_000 },
} satisfies Record<string, Limiter>;

const hits = new Map<string, number[]>();

// Periodically forget old buckets so this doesn't grow unbounded in a
// long-running process.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hits) {
    if (timestamps.every((t) => now - t > 10 * 60_000)) hits.delete(key);
  }
}, 5 * 60_000);
sweep.unref?.();

export async function enforceRateLimit(
  name: keyof typeof limiters,
  identifier: string,
): Promise<void> {
  const limiter = limiters[name];
  const key = `${name}:${identifier}`;
  const now = Date.now();
  const windowStart = now - limiter.windowMs;

  const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= limiter.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((timestamps[0] + limiter.windowMs - now) / 1000));
    throw new RateLimitError(retryAfterSeconds);
  }
  timestamps.push(now);
  hits.set(key, timestamps);
}

export { limiters };
