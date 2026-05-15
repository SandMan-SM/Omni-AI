import { authFetch } from "@/lib/auth";
import type { Business } from "@/lib/agi-supabase";

/**
 * Fetch the workspaces the caller can see.
 *
 * Wraps GET /api/dashboard/businesses — the server endpoint that uses
 * the service-role key to bypass the omni_businesses service_role_all
 * RLS policy. Returns the same `{ data }` shape PostgREST returned so
 * existing call sites stay drop-in compatible:
 *
 *     loadBusinesses().then(({ data }) => { ... })
 *
 * On error or unauth the helper resolves to `{ data: [] }` rather than
 * throwing — matches how the previous direct supabase call behaved
 * when RLS quietly returned zero rows.
 */
export async function loadBusinesses(): Promise<{ data: Business[]; isAdmin: boolean }> {
  try {
    const r = await authFetch("/api/dashboard/businesses");
    if (!r.ok) return { data: [], isAdmin: false };
    const j = (await r.json()) as { businesses?: Business[]; isAdmin?: boolean };
    return { data: j?.businesses ?? [], isAdmin: j?.isAdmin === true };
  } catch {
    return { data: [], isAdmin: false };
  }
}

/**
 * Resolve a single workspace by display name (case-insensitive). Used
 * by sponsor / affiliate pipelines which pin to the Omni AI workspace.
 * Returns `{ data: null }` if not found or if the caller doesn't have
 * access to it (per-brand users only see their mapped workspaces).
 */
export async function loadBusinessByName(
  name: string,
): Promise<{ data: Business | null }> {
  const { data } = await loadBusinesses();
  const lower = name.toLowerCase();
  const found = data.find((b) => (b.name ?? "").toLowerCase() === lower);
  return { data: found ?? null };
}
