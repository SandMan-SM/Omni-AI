/**
 * Telling "this content does not exist" apart from "the lookup failed".
 *
 * WHY THIS FILE EXISTS
 *
 * Supabase never throws. A read that fails — a dropped connection, a
 * statement timeout, a pool exhaustion — comes back as `{ data: null,
 * error: {...} }`, which is **byte-for-byte the same shape** as a read that
 * found nothing. Every caller that destructures `{ data }` and then calls
 * `notFound()` on a falsy value is therefore making a claim it cannot
 * support: it is saying "this page does not exist" when the truth is "I
 * could not find out".
 *
 * That is not a theoretical distinction. On 2026-11-04 the live sweep
 * caught five published newsletter issues answering HTTP 404 — five URLs
 * the sitemap advertises — because their database read ran past a 2.5 s
 * timeout and the timeout's `null` was read as "no row with that slug".
 * Every one of them answered HTTP 200 when asked again a minute later.
 *
 * The two answers mean opposite things to a search engine:
 *
 *   no row            -> 404 is correct. The URL should leave the index.
 *   the lookup FAILED -> 404 is a lie. The URL should stay, and be retried.
 *
 * A 404 tells a crawler to forget the page; a 500 tells it to come back.
 * Only the first is true when the row is genuinely missing.
 *
 * THE RULE
 *
 *   const row = requireLookup(await lookupContent(() => sb.from(…).maybeSingle()));
 *   if (!row) notFound();
 *
 * `lookupContent` classifies the outcome; `requireLookup` turns a failed
 * lookup into a thrown error, which the route's `error.tsx` renders as a
 * retryable error page with a 500 status — and a genuine absence still
 * produces a clean 404.
 */

/** The outcome of reading one row of public content. */
export type ContentLookup<T> =
  /** The row exists. */
  | { kind: "found"; value: T }
  /** The read succeeded and there is no such row. A 404 is correct. */
  | { kind: "missing" }
  /** The read itself failed. A 404 would be a lie. */
  | { kind: "failed"; error: unknown };

/**
 * The shape `lookupContent` reads from a Supabase response.
 *
 * The generic is on the RESPONSE, not on the row: Supabase's builder types
 * are deeply self-referential, and inferring a row type through a generic
 * parameter in a callback position collapses to `unknown` or `never`. The
 * row type is read off the response instead, which TypeScript infers
 * exactly.
 */
type LookupResponse = { data: unknown; error: unknown };

/** Render an unknown error value as something a log line can carry. */
function describeError(error: unknown): string {
  if (!error) return "unknown error";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as { message?: unknown; code?: unknown };
    const message = typeof e.message === "string" ? e.message : JSON.stringify(error);
    const code = typeof e.code === "string" ? ` (${e.code})` : "";
    return `${message}${code}`;
  }
  return String(error);
}

/**
 * Run a single-row read and classify the outcome.
 *
 * @example
 *   const row = await lookupContent(() =>
 *     sb.from("omni_businesses").select("id, name").eq("id", id).maybeSingle(),
 *   );
 */
export async function lookupContent<R extends LookupResponse>(
  read: () => PromiseLike<R>,
): Promise<ContentLookup<NonNullable<R["data"]>>> {
  let result: R;
  try {
    result = await read();
  } catch (error) {
    // Some builders reject rather than resolving with an error object.
    return { kind: "failed", error };
  }
  if (result?.error) return { kind: "failed", error: result.error };
  if (result?.data === null || result?.data === undefined) return { kind: "missing" };
  return { kind: "found", value: result.data as NonNullable<R["data"]> };
}

/**
 * Reduce a lookup to its value, throwing when the lookup itself failed.
 *
 * The throw is the point: it stops the route from reaching `notFound()`,
 * so a transient database problem renders the segment's error boundary
 * (HTTP 500) instead of a 404 that would drop a real page out of the
 * index.
 */
export function requireLookup<T>(lookup: ContentLookup<T>): T | null {
  if (lookup.kind === "failed") {
    throw new Error(`content lookup failed: ${describeError(lookup.error)}`);
  }
  return lookup.kind === "found" ? lookup.value : null;
}
