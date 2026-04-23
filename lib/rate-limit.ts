/**
 * In-memory sliding-window rate limiter for public POST endpoints.
 *
 * Context — why this exists:
 *   After Cycles 25-26 every public lead endpoint (landing-lead,
 *   demo-booking, webinar-registration, affiliate/*) validates input,
 *   escapes output, and drops honeypot hits. But none of them cared
 *   how *often* you hit them. An attacker who views source once,
 *   sees the honeypot field name, and strips it, can POST 10,000
 *   times in a minute — flooding `landing_page_leads` / `leads` /
 *   `demo_bookings` with junk and burning the Resend monthly quota
 *   (each successful POST fires 1–2 Resend emails). Both outcomes
 *   are cheap to inflict and expensive to clean up.
 *
 * Why in-memory (not Upstash / Vercel KV / Supabase):
 *   CLAUDE.md forbids autonomous env changes and autonomous
 *   migrations. Both external options need both. In-memory is
 *   zero-dep, zero-infra, and scoped to the Vercel Lambda instance
 *   — a speed bump, not a vault. The common case we're defending
 *   against (one script hammering from one IP) routes through one
 *   instance for long enough that this catches it. Determined
 *   distributed attackers still need a real limiter; that's a future
 *   cycle when we can add Upstash.
 *
 * Algorithm:
 *   Per-key array of request timestamps; on each call we drop any
 *   timestamp older than the window, reject if count >= limit,
 *   otherwise append. O(1) amortized because arrays stay small
 *   (bounded by `limit`).
 *
 * Memory:
 *   Bounded by MAX_BUCKETS. When we hit the ceiling we evict the
 *   oldest key (Map iteration order = insertion order). Prevents an
 *   attacker who rotates IPs from OOMing the lambda.
 */

type Bucket = { timestamps: number[] };

// ~10k distinct keys × up to `limit` timestamps each ≈ sub-MB.
// Evict oldest on overflow.
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  /** Requests remaining in this window after this call. */
  remaining: number;
  /** Milliseconds until the oldest request in the window expires. 0 when ok. */
  resetMs: number;
}

/**
 * Check and record a request. Call once per incoming request, at the
 * top of the POST handler, BEFORE any DB or email work.
 *
 * @param key     Stable identifier (e.g. `"landing-lead:${ip}"`).
 *                Namespace by endpoint so a noisy IP on one route
 *                doesn't lock them out of unrelated ones.
 * @param limit   Max requests per window.
 * @param windowMs  Sliding window length in ms.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) {
      // Evict oldest bucket by insertion order. Map iteration order is
      // insertion order in JS, so the first key is the oldest-touched.
      const firstKey = buckets.keys().next().value;
      if (firstKey !== undefined) buckets.delete(firstKey);
    }
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  const cutoff = now - windowMs;
  // Drop expired timestamps. Array stays small (bounded by `limit`) so
  // this filter is effectively O(limit), not O(n).
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    return {
      ok: false,
      remaining: 0,
      resetMs: Math.max(0, windowMs - (now - oldest)),
    };
  }

  bucket.timestamps.push(now);
  return {
    ok: true,
    remaining: limit - bucket.timestamps.length,
    resetMs: 0,
  };
}

/**
 * Extract the best-guess client IP from request headers. Vercel sets
 * `x-forwarded-for` (comma-separated, client first) on every request;
 * `x-real-ip` is the fallback. "unknown" if neither is present — which
 * shouldn't happen in production but means everyone-with-no-header
 * shares a bucket instead of crashing the handler.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

/**
 * Convenience wrapper — returns a 429 `NextResponse` when the caller
 * wants a one-liner for the common "reject and surface Retry-After"
 * pattern. Intentionally lives in this file so callers can import one
 * symbol instead of two and so the 429 body copy stays consistent
 * across endpoints.
 */
export function rateLimitResponse(resetMs: number): Response {
  const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again in a few minutes.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}
