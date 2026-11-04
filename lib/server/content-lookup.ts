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
 * THE OTHER HALF OF THE TRAP
 *
 * "No such row" does not always arrive as `{ data: null }`. Supabase's
 * `.single()` asks PostgREST for `application/vnd.pgrst.object+json`,
 * which cannot represent "no rows", so an absent row comes back as a
 * PGRST116 **error**. A classifier that only looks at `error` therefore
 * calls an absent row a FAILURE — and the route answers 500 for a page
 * that does not exist. This was not hypothetical: the first version of
 * this file did exactly that, and the live probe suite caught it on the
 * three routes that use `.single()` (`/[slug]`, `/lp/[slug]`,
 * `/p/[business]/[slug]`) the day it shipped. `lookupContent` maps
 * PGRST116 to "missing" — except when the details string says the query
 * returned MORE than one row, which is a data-integrity failure and must
 * never become a 404.
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

/**
 * PostgREST's code for "the query did not return exactly one row".
 *
 * THIS IS THE SUBTLE PART. A read that finds nothing does not always come
 * back as `{ data: null }`:
 *
 *   `.maybeSingle()`  ->  `{ data: null, error: null }`   (absence is not an error)
 *   `.single()`       ->  `{ data: null, error: PGRST116 }` (absence IS an error)
 *
 * PostgREST's `single()` asks for `application/vnd.pgrst.object+json`,
 * which cannot represent "no rows", so it answers 406 with a PGRST116
 * error instead of an empty object.
 *
 * That matters here: a route that uses `.single()` and expects a clean 404
 * for an absent row would, without this mapping, have its PGRST116 read as
 * a FAILED lookup — and answer HTTP 500 for a page that does not exist.
 * The live probe suite caught exactly that on 2026-11-04, on the three
 * routes that use `.single()`.
 */
const POSTGREST_NOT_ONE_ROW = "PGRST116";

/**
 * Is this error the database saying "there is no such row"?
 *
 * PostgREST uses ONE code for both "no rows" and "more than one row", and
 * the two want different answers: no rows is a 404, more than one row is a
 * data-integrity failure and must never become a 404. The `details` string
 * is what separates them — a multi-row result says "Results contain N
 * rows", an empty result says nothing.
 */
function isAbsence(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; details?: unknown };
  if (e.code !== POSTGREST_NOT_ONE_ROW) return false;
  const details = typeof e.details === "string" ? e.details : "";
  return !/results contain \d+ row/i.test(details);
}

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
  if (result?.error) {
    // A `.single()` read reports "no such row" as an error. That is an
    // ABSENCE, not a failure — only a genuine absence may reach notFound().
    if (isAbsence(result.error)) return { kind: "missing" };
    return { kind: "failed", error: result.error };
  }
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
