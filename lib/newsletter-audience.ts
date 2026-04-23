// ─── Newsletter Audience — single source of truth ─────────────────────────
//
// Historically the site had TWO sources feeding the newsletter send job:
//   1. profiles.newsletter_subscribed = true
//   2. newsletter_subscriptions.subscribed = true
// And an explicit deactivation override: profiles.newsletter_subscribed = false
// always wins (that email NEVER receives, even if it's still listed in
// newsletter_subscriptions from an old import).
//
// The admin UI was reading ONLY (2) and showing it as "your subscribers",
// which drifted badly from what the send job actually hit. This helper
// centralises the merge so the admin view, export CSV, stat cards, and the
// actual send job all compute the same set from the same query.
//
// Every caller must pass an admin Supabase client — we're touching profiles,
// which is RLS-locked for non-admin sessions.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AudienceSource = "profile" | "subscription" | "both";

export interface AudienceMember {
  /** Canonical lowercased email. Used as the dedupe key. */
  email: string;
  /** Best available display name across sources. */
  first_name: string | null;
  /** Which table this person came from (or both). */
  source: AudienceSource;
  /**
   * Will the next newsletter send job deliver to this email? True when the
   * user is active in at least one source AND not explicitly opted out in
   * profiles. This is the only flag the send job should care about.
   */
  active: boolean;
  /** Has this email explicitly unsubscribed somewhere? */
  unsubscribed: boolean;
  /**
   * True if the user gets the Premium newsletter. Either they're flagged
   * as premium on their profile (is_premium / subscription_status='active')
   * or their newsletter_subscriptions row is tier='premium'.
   */
  is_premium: boolean;
  profile_id: string | null;
  subscription_id: string | null;
  /** Raw tier from newsletter_subscriptions, if the row exists. */
  subscription_tier: string | null;
  /** Earliest signup across both sources. */
  created_at: string | null;
}

export interface AudienceStats {
  /** All distinct emails we know about (any source, any state). */
  total: number;
  /** Will receive the next newsletter send. */
  active: number;
  /** Active AND premium. */
  premium: number;
  /** Active AND not premium. */
  free: number;
  /** Explicitly opted out in at least one source. */
  unsubscribed: number;
  /** Breakdown so admins can tell which table each person lives in. */
  from_profiles_only: number;
  from_subscriptions_only: number;
  from_both: number;
}

interface ProfileRow {
  id: string;
  email: string | null;
  first_name: string | null;
  newsletter_subscribed: boolean | null;
  is_premium: boolean | null;
  subscription_status: string | null;
  created_at: string | null;
}

interface SubscriptionRow {
  id: string;
  email: string | null;
  first_name: string | null;
  subscription_tier: string | null;
  subscribed: boolean | null;
  created_at: string | null;
}

/**
 * Return the canonical newsletter audience. This is the EXACT set the send
 * job operates on — any divergence is a bug.
 *
 * The returned array is sorted newest-first by created_at.
 */
export async function getNewsletterAudience(
  admin: SupabaseClient,
): Promise<AudienceMember[]> {
  // Pull both tables in parallel. Intentionally select everything the merge
  // needs in one round trip each — no N+1s.
  const [profilesRes, subsRes] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, email, first_name, newsletter_subscribed, is_premium, subscription_status, created_at",
      ),
    admin
      .from("newsletter_subscriptions")
      .select("id, email, first_name, subscription_tier, subscribed, created_at"),
  ]);

  const profiles: ProfileRow[] = (profilesRes.data || []) as ProfileRow[];
  const subs: SubscriptionRow[] = (subsRes.data || []) as SubscriptionRow[];

  // Dedupe by lowercased email. The map values get mutated as we merge.
  const byEmail = new Map<string, AudienceMember>();

  // Pass 1: profiles. Every profile with a valid email becomes an entry.
  for (const p of profiles) {
    const email = (p.email || "").trim().toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email);
    const premiumFromProfile =
      p.is_premium === true || p.subscription_status === "active";
    if (existing) {
      existing.profile_id = p.id;
      existing.first_name = existing.first_name || p.first_name || null;
      existing.source = "both";
      existing.is_premium = existing.is_premium || premiumFromProfile;
      // explicit profile opt-out dominates
      if (p.newsletter_subscribed === false) {
        existing.unsubscribed = true;
      }
      // active depends on the merged rule below — computed in the finalize pass
      if (p.created_at && existing.created_at && p.created_at < existing.created_at) {
        existing.created_at = p.created_at;
      }
    } else {
      byEmail.set(email, {
        email,
        first_name: p.first_name || null,
        source: "profile",
        active: false, // computed below
        unsubscribed: p.newsletter_subscribed === false,
        is_premium: premiumFromProfile,
        profile_id: p.id,
        subscription_id: null,
        subscription_tier: null,
        created_at: p.created_at || null,
      });
    }
  }

  // Pass 2: subscriptions table.
  for (const s of subs) {
    const email = (s.email || "").trim().toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email);
    const premiumFromSub = s.subscription_tier === "premium";
    if (existing) {
      existing.subscription_id = s.id;
      existing.subscription_tier = s.subscription_tier;
      existing.source = existing.source === "profile" ? "both" : existing.source;
      existing.first_name = existing.first_name || s.first_name || null;
      existing.is_premium = existing.is_premium || premiumFromSub;
      if (s.subscribed === false) {
        existing.unsubscribed = true;
      }
      if (s.created_at && existing.created_at && s.created_at < existing.created_at) {
        existing.created_at = s.created_at;
      }
    } else {
      byEmail.set(email, {
        email,
        first_name: s.first_name || null,
        source: "subscription",
        active: false, // computed below
        unsubscribed: s.subscribed === false,
        is_premium: premiumFromSub,
        profile_id: null,
        subscription_id: s.id,
        subscription_tier: s.subscription_tier,
        created_at: s.created_at || null,
      });
    }
  }

  // Finalize `active` using the merged rule:
  //   1. If the profile row exists and says newsletter_subscribed=false → NEVER active
  //      (explicit opt-out wins even if the subscription row still says subscribed=true)
  //   2. Else active if EITHER profiles.newsletter_subscribed=true OR
  //      newsletter_subscriptions.subscribed=true
  //
  // The loop re-reads the original rows because the merged member doesn't
  // preserve the per-source booleans directly — they're rolled up into
  // `unsubscribed`. We materialise per-source booleans below for clarity.
  const profilesByEmail = new Map<string, ProfileRow>();
  for (const p of profiles) {
    const e = (p.email || "").trim().toLowerCase();
    if (e) profilesByEmail.set(e, p);
  }
  const subsByEmail = new Map<string, SubscriptionRow>();
  for (const s of subs) {
    const e = (s.email || "").trim().toLowerCase();
    if (e) subsByEmail.set(e, s);
  }

  // Array.from around the MapIterator so the build target stays compatible
  // with the project's current downlevelIteration settings.
  const materialized = Array.from(byEmail.values());
  for (const m of materialized) {
    const p = profilesByEmail.get(m.email);
    const s = subsByEmail.get(m.email);
    const profileOptOut = p?.newsletter_subscribed === false;
    const profileOptIn = p?.newsletter_subscribed === true;
    const subOptIn = s?.subscribed === true;
    m.active = !profileOptOut && (profileOptIn || subOptIn);
  }

  // Sort newest-first by created_at (null → end).
  return materialized.sort((a, b) => {
    if (!a.created_at && !b.created_at) return 0;
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

/** Derive stats from the audience array — no second DB query. */
export function computeAudienceStats(members: AudienceMember[]): AudienceStats {
  let active = 0;
  let premium = 0;
  let free = 0;
  let unsubscribed = 0;
  let fromProfilesOnly = 0;
  let fromSubscriptionsOnly = 0;
  let fromBoth = 0;

  for (const m of members) {
    if (m.active) {
      active++;
      if (m.is_premium) premium++;
      else free++;
    }
    if (m.unsubscribed) unsubscribed++;
    if (m.source === "profile") fromProfilesOnly++;
    else if (m.source === "subscription") fromSubscriptionsOnly++;
    else fromBoth++;
  }

  return {
    total: members.length,
    active,
    premium,
    free,
    unsubscribed,
    from_profiles_only: fromProfilesOnly,
    from_subscriptions_only: fromSubscriptionsOnly,
    from_both: fromBoth,
  };
}

/**
 * Return only the emails the next send job will deliver to. Used directly
 * by runDailyNewsletter / runPremiumNewsletter so the send set can never
 * drift from what the admin panel shows.
 */
export function audienceSendList(members: AudienceMember[]): {
  freeRecipients: string[];
  premiumRecipients: string[];
} {
  const freeRecipients: string[] = [];
  const premiumRecipients: string[] = [];
  for (const m of members) {
    if (!m.active) continue;
    freeRecipients.push(m.email);
    if (m.is_premium) premiumRecipients.push(m.email);
  }
  return { freeRecipients, premiumRecipients };
}
