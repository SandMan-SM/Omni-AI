// Federation Marketing System — owner-network newsletters + brand-deal funnels.
//
// One library, three responsibilities:
//   1. Read campaigns/landings/audiences from the marketing_* tables.
//   2. Schedule sends respecting per-domain warm-up + hourly throttles.
//   3. Fire scheduled sends via Resend with the spam-safety guardrails
//      every send must carry (sender persona, Reply-To, List-Unsubscribe,
//      CAN-SPAM footer, suppression-list check at both enqueue + send).
//
// The 10 verified domains live in VERIFIED_DOMAINS below; sender_email
// validation rejects any campaign whose domain isn't in the list. That
// guard is what keeps us from accidentally trying to send from a
// non-DKIM-signed address and getting bounced.

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token';

// ── env ─────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://omnileadsagi.com';
const OMNI_PHYSICAL_ADDRESS =
  process.env.OMNI_PHYSICAL_ADDRESS ||
  'Omni AI · 1234 Federation Way · Salt Lake City, UT 84101';

// ── verified domains ────────────────────────────────────────────────
// Source: 10 domains DKIM/SPF-verified in Resend dashboard 2026-05-10.
// Keep this in sync with `mcp__resend__list-domains`. enqueueCampaign
// rejects any sender_email whose host doesn't appear here.

export const VERIFIED_DOMAINS = [
  'alira.live',
  'beehivebizpulse.com',
  'lovethybarber.shop',
  'omnileadsagi.com', // Alfred persona — DKIM+SPF verified, only tracking CNAME failed (non-blocking for sending).
  'psychandcustodyevaluations.com',
  'renelaveau.com',
  'secretimperium.com',
  'thewasatchpost.com',
  'utahdeckandbasementremodel.com',
  'utahmainstreet.com',
  'youngscabinetrefinishing.com',
] as const;

const NOREPLY_LOCAL = /^(noreply|no-reply|do-not-reply|donotreply)$/i;

// ── types ───────────────────────────────────────────────────────────

export type MarketingLanding = {
  id: string;
  business_slug: string;
  kind: 'product' | 'brand_deal';
  slug: string;
  headline: string;
  subhead: string | null;
  hero_visual_url: string | null;
  body_md: string | null;
  cta_label: string | null;
  cta_url: string | null;
  price: string | null;
  share_pct: number | null;
  status: 'draft' | 'published' | 'archived';
};

export type MarketingCampaign = {
  id: string;
  business_slug: string;
  landing_id: string | null;
  kind: 'product' | 'brand_deal';
  subject_template: string;
  body_md_template: string;
  sender_display: string;
  sender_email: string;
  reply_to_email: string;
  audience_kind: 'owner_network' | 'brand_deal_prospects';
  daily_throttle: number;
  hourly_throttle: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
};

export type Recipient = {
  email: string;
  first_name: string | null;
};

export type EnqueueResult = {
  ok: boolean;
  audience_size: number;
  scheduled: Array<{ email: string; scheduled_at: string }>;
  throttle_ok: boolean;
  skipped: Array<{ email: string; reason: string }>;
  error?: string;
};

// ── helpers ─────────────────────────────────────────────────────────

export function senderDomain(email: string): string {
  const at = email.indexOf('@');
  return at < 0 ? '' : email.slice(at + 1).toLowerCase().trim();
}

export function senderLocal(email: string): string {
  const at = email.indexOf('@');
  return at < 0 ? email : email.slice(0, at);
}

export function isVerifiedDomain(domain: string): boolean {
  return (VERIFIED_DOMAINS as readonly string[]).includes(domain.toLowerCase());
}

/** Replaces {{first_name}} / {{business_name}} / {{landing_url}} /
 *  {{sender_display}}. Throws if any {{token}} remains so we never
 *  ship a "Hi {{first_name}}" bug. */
export function personalize(
  template: string,
  vars: { first_name: string; business_name: string; landing_url: string; sender_display: string },
): string {
  const out = template
    .replaceAll('{{first_name}}', vars.first_name)
    .replaceAll('{{business_name}}', vars.business_name)
    .replaceAll('{{landing_url}}', vars.landing_url)
    .replaceAll('{{sender_display}}', vars.sender_display);
  const leftover = out.match(/\{\{[^}]+\}\}/);
  if (leftover) {
    throw new Error(`[business-marketing] Unresolved token in template: ${leftover[0]}`);
  }
  return out;
}

// ── warm-up curve ───────────────────────────────────────────────────
// Per-domain ramp: day 1–3 → 50/day, 4–7 → 100/day, 8–14 → 200/day,
// 15+ → 500/day. Hourly cap = min(25, daily/4). Day 1 is the first
// day we've ever sent from this domain (earliest sent_at on any
// marketing_sends row joined through a campaign with this business_slug).

export type WarmupCap = { day_offset: number; daily_cap: number; hourly_cap: number };

export async function enforceWarmup(
  sb: SupabaseClient,
  business_slug: string,
  now: Date = new Date(),
): Promise<WarmupCap> {
  // Earliest send from any campaign for this business_slug.
  const { data } = await sb
    .from('marketing_sends')
    .select('sent_at, marketing_campaigns!inner(business_slug)')
    .eq('marketing_campaigns.business_slug', business_slug)
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: true })
    .limit(1);

  const firstSentAt =
    data && data.length > 0 && data[0].sent_at ? new Date(data[0].sent_at) : null;

  const day_offset = firstSentAt
    ? Math.max(1, Math.floor((now.getTime() - firstSentAt.getTime()) / (24 * 3600 * 1000)) + 1)
    : 1;

  let daily_cap = 500;
  if (day_offset <= 3) daily_cap = 50;
  else if (day_offset <= 7) daily_cap = 100;
  else if (day_offset <= 14) daily_cap = 200;

  const hourly_cap = Math.min(25, Math.floor(daily_cap / 4));
  return { day_offset, daily_cap, hourly_cap };
}

// ── audience ────────────────────────────────────────────────────────

export async function selectAudience(
  sb: SupabaseClient,
  campaign: Pick<MarketingCampaign, 'audience_kind' | 'business_slug'>,
): Promise<Recipient[]> {
  if (campaign.audience_kind === 'owner_network') {
    const { data: owners } = await sb
      .from('federation_owners')
      .select('email, first_name')
      .is('unsubscribed_at', null);

    if (!owners || owners.length === 0) return [];

    // Filter out anyone with a global suppression (business_id IS NULL).
    const emails = owners.map((o) => o.email.toLowerCase());
    const { data: suppressed } = await sb
      .from('omni_suppressions')
      .select('email')
      .is('business_id', null)
      .in('email', emails);
    const suppressedSet = new Set((suppressed ?? []).map((s) => s.email.toLowerCase()));

    return owners
      .filter((o) => !suppressedSet.has(o.email.toLowerCase()))
      .map((o) => ({ email: o.email, first_name: o.first_name }));
  }

  // brand_deal_prospects: only 'approved' rows.
  const { data: prospects } = await sb
    .from('brand_deal_prospects')
    .select('prospect_email, first_name')
    .eq('target_business_slug', campaign.business_slug)
    .eq('status', 'approved');

  return (prospects ?? []).map((p) => ({
    email: p.prospect_email,
    first_name: p.first_name,
  }));
}

// ── enqueue ─────────────────────────────────────────────────────────

export async function loadCampaign(
  sb: SupabaseClient,
  id: string,
): Promise<MarketingCampaign | null> {
  const { data } = await sb.from('marketing_campaigns').select('*').eq('id', id).single();
  return (data as MarketingCampaign) || null;
}

export async function loadLanding(
  sb: SupabaseClient,
  id: string,
): Promise<MarketingLanding | null> {
  const { data } = await sb.from('marketing_landings').select('*').eq('id', id).single();
  return (data as MarketingLanding) || null;
}

/**
 * Plan + (optionally) write marketing_sends rows for a campaign.
 *
 * Idempotent: re-running an enqueue on the same campaign won't double
 * up — rows already in marketing_sends for this campaign are filtered
 * out of the audience.
 *
 * Schedule shape: pack `hourly_cap` sends per hour into the next
 * day's working window (9:00 — 16:00 local-server-time = ET on
 * Vercel by default), spilling to the following day(s) when the
 * daily_cap is exceeded.
 */
export async function enqueueCampaign(
  sb: SupabaseClient,
  campaign_id: string,
  opts: { dry_run: boolean },
): Promise<EnqueueResult> {
  const campaign = await loadCampaign(sb, campaign_id);
  if (!campaign) {
    return {
      ok: false,
      audience_size: 0,
      scheduled: [],
      throttle_ok: false,
      skipped: [],
      error: 'campaign_not_found',
    };
  }

  // Sender persona checks (Phase 4 guardrails 1).
  const domain = senderDomain(campaign.sender_email);
  if (!isVerifiedDomain(domain)) {
    return {
      ok: false,
      audience_size: 0,
      scheduled: [],
      throttle_ok: false,
      skipped: [],
      error: `sender_domain_not_verified:${domain}`,
    };
  }
  if (NOREPLY_LOCAL.test(senderLocal(campaign.sender_email))) {
    return {
      ok: false,
      audience_size: 0,
      scheduled: [],
      throttle_ok: false,
      skipped: [],
      error: 'noreply_sender_blocked',
    };
  }
  if ((campaign.sender_display || '').trim().length < 2) {
    return {
      ok: false,
      audience_size: 0,
      scheduled: [],
      throttle_ok: false,
      skipped: [],
      error: 'sender_display_too_short',
    };
  }

  // Audience + dedup against already-enqueued rows.
  const audience = await selectAudience(sb, campaign);
  const { data: existing } = await sb
    .from('marketing_sends')
    .select('recipient_email')
    .eq('campaign_id', campaign.id);
  const existingSet = new Set(
    (existing ?? []).map((r) => (r.recipient_email || '').toLowerCase()),
  );

  const skipped: EnqueueResult['skipped'] = [];
  const eligible: Recipient[] = [];
  for (const r of audience) {
    if (existingSet.has(r.email.toLowerCase())) {
      skipped.push({ email: r.email, reason: 'already_enqueued' });
      continue;
    }
    if (!r.first_name || r.first_name.trim().length === 0) {
      skipped.push({ email: r.email, reason: 'no_first_name' });
      continue;
    }
    eligible.push(r);
  }

  // Warm-up window. Pack hourly_cap per hour across business hours,
  // up to daily_cap per day, spilling to next day(s).
  const warm = await enforceWarmup(sb, campaign.business_slug);
  const hourlyCap = Math.min(warm.hourly_cap, campaign.hourly_throttle);
  const dailyCap = Math.min(warm.daily_cap, campaign.daily_throttle);

  const scheduled: EnqueueResult['scheduled'] = [];
  const now = new Date();
  let cursor = new Date(now);
  // Start sending from the next 5-minute boundary, in business hours.
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(Math.ceil(cursor.getUTCMinutes() / 5) * 5);

  let sentThisHour = 0;
  let sentThisDay = 0;
  let currentHour = cursor.getUTCHours();
  let currentDay = cursor.getUTCDate();

  for (const r of eligible) {
    while (sentThisDay >= dailyCap || sentThisHour >= hourlyCap) {
      if (sentThisDay >= dailyCap) {
        // Roll to next day, 14:00 UTC (~9am ET).
        cursor = new Date(cursor.getTime() + 24 * 3600 * 1000);
        cursor.setUTCHours(14, 0, 0, 0);
        sentThisDay = 0;
        sentThisHour = 0;
      } else {
        // Roll to next hour.
        cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
        cursor.setUTCMinutes(0, 0, 0);
        sentThisHour = 0;
      }
      currentHour = cursor.getUTCHours();
      currentDay = cursor.getUTCDate();
      // Keep within business-hours-ish (13:00–22:00 UTC = ~8am–5pm ET).
      if (currentHour < 13) {
        cursor.setUTCHours(13, 0, 0, 0);
      } else if (currentHour >= 22) {
        cursor = new Date(cursor.getTime() + 24 * 3600 * 1000);
        cursor.setUTCHours(14, 0, 0, 0);
        sentThisDay = 0;
      }
    }

    scheduled.push({ email: r.email, scheduled_at: cursor.toISOString() });
    sentThisHour++;
    sentThisDay++;
  }

  if (!opts.dry_run && scheduled.length > 0) {
    const rows = scheduled.map((s) => {
      const rec = eligible.find((e) => e.email === s.email)!;
      return {
        campaign_id: campaign.id,
        recipient_email: s.email.toLowerCase(),
        recipient_first_name: rec.first_name,
        scheduled_at: s.scheduled_at,
      };
    });
    const { error } = await sb.from('marketing_sends').insert(rows);
    if (error) {
      return {
        ok: false,
        audience_size: audience.length,
        scheduled,
        throttle_ok: true,
        skipped,
        error: `insert_failed:${error.message}`,
      };
    }
  }

  return {
    ok: true,
    audience_size: audience.length,
    scheduled,
    throttle_ok: true,
    skipped,
  };
}

// ── render + send ───────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Minimal markdown → HTML — paragraph blocks only. Operator authors
 *  prose, not full markdown. Anything fancier ships as a future
 *  upgrade if operators ask for it. */
function bodyMdToHtml(md: string): string {
  return md
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function renderEmailHtml(args: {
  bodyHtml: string;
  ctaLabel: string | null;
  ctaUrl: string;
  unsubscribeUrl: string;
  senderDisplay: string;
  businessName: string;
}): string {
  const cta = args.ctaLabel
    ? `<p style="margin:24px 0"><a href="${args.ctaUrl}" style="display:inline-block;background:#9C27B0;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(args.ctaLabel)}</a></p>`
    : '';
  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222">
${args.bodyHtml}
${cta}
<hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0">
<p style="font-size:12px;color:#888;line-height:1.5;margin:0">
${escapeHtml(args.senderDisplay)} · ${escapeHtml(args.businessName)}<br>
${escapeHtml(OMNI_PHYSICAL_ADDRESS)}<br>
You're receiving this because you opted into the federation owner network.<br>
<a href="${args.unsubscribeUrl}" style="color:#888">Unsubscribe</a>
</p>
</body></html>`;
}

export type SendArgs = {
  from_display: string;
  from_email: string;
  to: string;
  reply_to: string;
  subject: string;
  html: string;
  unsubscribe_url: string;
};

export async function sendMarketingEmail(args: SendArgs): Promise<{
  ok: boolean;
  resend_id?: string;
  error?: string;
}> {
  if (!RESEND_API_KEY) return { ok: false, error: 'no_resend_key' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${args.from_display} <${args.from_email}>`,
      to: [args.to],
      reply_to: args.reply_to,
      subject: args.subject,
      html: args.html,
      headers: {
        'List-Unsubscribe': `<${args.unsubscribe_url}>, <mailto:${args.reply_to}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `resend_${res.status}:${text.slice(0, 200)}` };
  }
  const j = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, resend_id: j.id };
}

// ── runner ──────────────────────────────────────────────────────────

export type RunResult = {
  ok: boolean;
  picked: number;
  sent: number;
  suppressed: number;
  failed: number;
  details: Array<{
    send_id: string;
    email: string;
    status: 'sent' | 'suppressed' | 'failed';
    error?: string;
    resend_id?: string;
  }>;
};

/**
 * Pick every due marketing_sends row, render the email, fire it via
 * Resend, record the resend_id + sent_at. If recipient was suppressed
 * between enqueue and now, write suppressed_reason instead of sending.
 */
export async function runScheduledSends(
  sb: SupabaseClient,
  now: Date = new Date(),
  options: { limit?: number; campaign_id?: string } = {},
): Promise<RunResult> {
  let q = sb
    .from('marketing_sends')
    .select(
      'id, campaign_id, recipient_email, recipient_first_name, scheduled_at, marketing_campaigns(*)',
    )
    .is('sent_at', null)
    .is('suppressed_reason', null)
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(options.limit ?? 100);

  if (options.campaign_id) q = q.eq('campaign_id', options.campaign_id);

  const { data: due, error } = await q;
  if (error || !due) {
    return { ok: false, picked: 0, sent: 0, suppressed: 0, failed: 0, details: [] };
  }

  const result: RunResult = {
    ok: true,
    picked: due.length,
    sent: 0,
    suppressed: 0,
    failed: 0,
    details: [],
  };

  // Last-mile suppression check.
  const emails = due.map((d) => (d.recipient_email || '').toLowerCase());
  const { data: supRows } = await sb
    .from('omni_suppressions')
    .select('email')
    .is('business_id', null)
    .in('email', emails);
  const suppressedSet = new Set((supRows ?? []).map((s) => (s.email || '').toLowerCase()));

  for (const row of due) {
    const campaign = (row as any).marketing_campaigns as MarketingCampaign | null;
    if (!campaign) {
      result.failed++;
      result.details.push({
        send_id: row.id,
        email: row.recipient_email,
        status: 'failed',
        error: 'campaign_missing',
      });
      continue;
    }
    if (campaign.status === 'paused') {
      // Don't send paused campaigns even if rows are due.
      continue;
    }

    const recipientEmail = (row.recipient_email || '').toLowerCase();
    if (suppressedSet.has(recipientEmail)) {
      await sb
        .from('marketing_sends')
        .update({ suppressed_reason: 'suppressed_global' })
        .eq('id', row.id);
      result.suppressed++;
      result.details.push({
        send_id: row.id,
        email: row.recipient_email,
        status: 'suppressed',
      });
      continue;
    }

    // Resolve landing for CTA URL.
    let landing: MarketingLanding | null = null;
    if (campaign.landing_id) {
      landing = await loadLanding(sb, campaign.landing_id);
    }
    const landingUrl =
      landing && landing.status === 'published'
        ? `${SITE_URL}/p/${landing.business_slug}/${landing.slug}`
        : SITE_URL;

    const vars = {
      first_name: row.recipient_first_name || 'there',
      business_name: campaign.business_slug,
      landing_url: landingUrl,
      sender_display: campaign.sender_display,
    };

    let subject: string;
    let bodyMd: string;
    try {
      subject = personalize(campaign.subject_template, vars);
      bodyMd = personalize(campaign.body_md_template, vars);
    } catch (e) {
      result.failed++;
      result.details.push({
        send_id: row.id,
        email: row.recipient_email,
        status: 'failed',
        error: e instanceof Error ? e.message : 'personalize_failed',
      });
      continue;
    }

    const unsubUrl = buildUnsubscribeUrl(recipientEmail, SITE_URL, 'nl');
    const html = renderEmailHtml({
      bodyHtml: bodyMdToHtml(bodyMd),
      ctaLabel: landing?.cta_label || 'Visit page',
      ctaUrl: landingUrl,
      unsubscribeUrl: unsubUrl,
      senderDisplay: campaign.sender_display,
      businessName: campaign.business_slug,
    });

    const send = await sendMarketingEmail({
      from_display: campaign.sender_display,
      from_email: campaign.sender_email,
      to: recipientEmail,
      reply_to: campaign.reply_to_email,
      subject,
      html,
      unsubscribe_url: unsubUrl,
    });

    if (!send.ok) {
      result.failed++;
      result.details.push({
        send_id: row.id,
        email: row.recipient_email,
        status: 'failed',
        error: send.error,
      });
      continue;
    }

    await sb
      .from('marketing_sends')
      .update({ sent_at: now.toISOString(), resend_id: send.resend_id ?? null })
      .eq('id', row.id);

    // Mirror into the universal email_sends log so the AGI dashboard
    // sees every federation marketing send alongside transactional
    // and outreach mail. Best-effort: failures don't break the send.
    if (send.resend_id) {
      await sb
        .from('email_sends')
        .insert({
          resend_id: send.resend_id,
          template_kind: 'federation_marketing',
          to_email: recipientEmail,
          subject,
          sent_at: now.toISOString(),
          payload: {
            campaign_id: campaign.id,
            business_slug: campaign.business_slug,
            kind: campaign.kind,
            sender_display: campaign.sender_display,
            sender_email: campaign.sender_email,
            reply_to_email: campaign.reply_to_email,
            audience_kind: campaign.audience_kind,
            landing_id: campaign.landing_id,
          },
        })
        .then(() => {}, () => {});
    }

    result.sent++;
    result.details.push({
      send_id: row.id,
      email: row.recipient_email,
      status: 'sent',
      resend_id: send.resend_id,
    });
  }

  // Reputation auto-pause: any domain with bounce+complaint+unsub
  // exceeding 5% on its 30-day window flips every campaign on that
  // domain to 'paused'. Run after each batch.
  await autoPauseUnhealthyDomains(sb);

  return result;
}

// ── reputation / auto-pause ─────────────────────────────────────────

export async function autoPauseUnhealthyDomains(sb: SupabaseClient): Promise<void> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await sb
    .from('marketing_sends')
    .select(
      'sent_at, bounced_at, complained_at, unsubscribed_at, marketing_campaigns!inner(business_slug)',
    )
    .gt('sent_at', since);

  if (!rows || rows.length === 0) return;

  const perSlug = new Map<string, { sent: number; bad: number }>();
  for (const r of rows as any[]) {
    const slug = r.marketing_campaigns?.business_slug;
    if (!slug) continue;
    const cur = perSlug.get(slug) ?? { sent: 0, bad: 0 };
    cur.sent++;
    if (r.bounced_at || r.complained_at || r.unsubscribed_at) cur.bad++;
    perSlug.set(slug, cur);
  }

  const entries: Array<[string, { sent: number; bad: number }]> = [];
  perSlug.forEach((v, k) => entries.push([k, v]));
  for (const [slug, stat] of entries) {
    if (stat.sent < 20) continue; // too small to judge
    const rate = stat.bad / stat.sent;
    if (rate > 0.05) {
      await sb
        .from('marketing_campaigns')
        .update({ status: 'paused' })
        .eq('business_slug', slug)
        .neq('status', 'paused');
    }
  }
}

// ── brand-deal Apollo enrichment ────────────────────────────────────
// NOTE: actual Apollo MCP call lives at the route layer (we can't import
// MCP tools into a library). This function is the DB-write half: route
// passes pre-fetched people[] payload here. enqueueCampaign will only
// see them after operator manually flips status to 'approved'.

export type ApolloPerson = {
  email?: string;
  first_name?: string;
  organization?: { name?: string };
  title?: string;
  [k: string]: unknown;
};

export async function ingestApolloProspects(
  sb: SupabaseClient,
  target_business_slug: string,
  people: ApolloPerson[],
): Promise<{ inserted: number; skipped: number }> {
  if (!people || people.length === 0) return { inserted: 0, skipped: 0 };

  const rows = people
    .filter((p) => typeof p.email === 'string' && p.email.includes('@'))
    .map((p) => ({
      target_business_slug,
      prospect_email: (p.email as string).toLowerCase(),
      first_name: p.first_name ?? null,
      company: p.organization?.name ?? null,
      role: p.title ?? null,
      source: 'apollo' as const,
      status: 'pending_approval' as const,
      discovery_payload: p as object,
    }));

  if (rows.length === 0) return { inserted: 0, skipped: people.length };

  const { data, error } = await sb
    .from('brand_deal_prospects')
    .upsert(rows, { onConflict: 'target_business_slug,prospect_email', ignoreDuplicates: true })
    .select('id');

  if (error) return { inserted: 0, skipped: people.length };
  return { inserted: (data ?? []).length, skipped: people.length - (data ?? []).length };
}
