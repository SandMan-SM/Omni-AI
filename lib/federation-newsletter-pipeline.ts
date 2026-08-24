// Federation newsletter draft-approval pipeline.
//
// generateDraftFor(site)  → calls Claude with the site's brief, inserts a
//                            federation_newsletter_posts row in status='draft',
//                            emails the operator a preview with Approve/Reject
//                            HMAC links.
//
// approvePost(postId,site) → flips status to 'approved' then 'published',
//                            stamps published_at, dispatches the post to the
//                            site's business owner via Resend (cc operator),
//                            and to any newsletter subscribers if present.
//
// rejectPost(postId,site)  → flips status to 'rejected', no fan-out, returns.
//
// All Resend sends are routed through the federation Resend account (the same
// one that has the 10 federation domains verified).
//
// Claude calls go direct to /v1/messages (mirror of lib/newsletter-sender.ts
// — no Anthropic SDK to keep the Vercel bundle small).

import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildApproveUrl,
  buildRejectUrl,
} from '@/lib/federation-newsletter-tokens';
import {
  FEDERATION_OPERATOR_EMAIL,
  getFederationBrief,
  getBusinessSlugForFederationSite,
  type FederationNewsletterBrief,
} from '@/lib/federation-newsletter-briefs';
import { sendTelegram } from '@/lib/telegram';
import { resolveSender } from '@/lib/sender-registry';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SITE_BASE = 'https://omnileadsagi.com';

// ── Public types ─────────────────────────────────────────────────────────

export type FederationPostRow = {
  id: string;
  site: string;
  slug: string;
  title: string;
  body_md: string;
  kind: string;
  status: 'draft' | 'approved' | 'published' | 'rejected';
  draft_sent_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  owner_dispatched_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type GeneratedDraft = {
  title: string;
  slug: string;
  body_md: string;
  kind: string;
};

// ── Generation ───────────────────────────────────────────────────────────

/**
 * Generate today's draft for a federation site, persist it, email the
 * operator. Idempotent per (site, today) — if a draft already exists for
 * today, returns it without regenerating.
 */
export async function generateDraftFor(site: string): Promise<{
  ok: boolean;
  postId?: string;
  status?: string;
  error?: string;
}> {
  const brief = getFederationBrief(site);
  if (!brief) {
    return { ok: false, error: `unknown site: ${site}` };
  }

  const sb = createAdminClient();

  // Idempotency: if there's already a row for this site today (in draft,
  // approved, published, OR rejected status), don't generate a second one.
  const todayUtc = new Date().toISOString().slice(0, 10);
  const startOfToday = `${todayUtc}T00:00:00Z`;
  const { data: existing } = await sb
    .from('federation_newsletter_posts')
    .select('id, status')
    .eq('site', site)
    .gte('created_at', startOfToday)
    .order('created_at', { ascending: false })
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: true, postId: existing[0].id, status: existing[0].status };
  }

  // 1. Generate via Claude.
  let draft: GeneratedDraft;
  try {
    draft = await callClaudeForDraft(brief);
  } catch (e) {
    return {
      ok: false,
      error: `claude generation failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 2. Insert as draft.
  const { data: row, error: insertErr } = await sb
    .from('federation_newsletter_posts')
    .insert({
      site,
      slug: draft.slug,
      title: draft.title,
      body_md: draft.body_md,
      kind: draft.kind,
      status: 'draft',
      draft_sent_at: null,
    })
    .select('*')
    .single();

  if (insertErr || !row) {
    return {
      ok: false,
      error: `insert failed: ${insertErr?.message ?? 'no row returned'}`,
    };
  }

  // 3. Email the operator the preview + Approve/Reject links.
  const emailRes = await sendDraftPreviewToOperator(row, brief);
  if (!emailRes.ok) {
    // Don't roll back the row — the operator can also approve/reject from a
    // backstop admin view (TODO). Surface the error in the response so the
    // cron log shows it.
    return {
      ok: true,
      postId: row.id,
      status: 'draft',
      error: `draft inserted but operator email failed: ${emailRes.error}`,
    };
  }

  // Stamp draft_sent_at after the email succeeds.
  await sb
    .from('federation_newsletter_posts')
    .update({ draft_sent_at: new Date().toISOString() })
    .eq('id', row.id);

  return { ok: true, postId: row.id, status: 'draft' };
}

// ── Approve / Reject ─────────────────────────────────────────────────────

export async function approvePost(
  postId: string,
  site: string,
): Promise<{ ok: boolean; published?: boolean; error?: string }> {
  const sb = createAdminClient();
  const brief = getFederationBrief(site);
  if (!brief) return { ok: false, error: `unknown site: ${site}` };

  const { data: row } = await sb
    .from('federation_newsletter_posts')
    .select('*')
    .eq('id', postId)
    .eq('site', site)
    .single();
  if (!row) return { ok: false, error: 'post not found' };
  if (row.status === 'published') return { ok: true, published: true };
  if (row.status === 'rejected') {
    return { ok: false, error: 'post already rejected' };
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await sb
    .from('federation_newsletter_posts')
    .update({
      status: 'published',
      approved_at: row.approved_at ?? now,
      published_at: now,
    })
    .eq('id', postId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Fire dispatch to business owner (best-effort; record outcome on the row).
  const dispatchRes = await dispatchPublishedToOwner(row as FederationPostRow, brief);
  if (dispatchRes.ok) {
    await sb
      .from('federation_newsletter_posts')
      .update({ owner_dispatched_at: now })
      .eq('id', postId);
  }

  return { ok: true, published: true };
}

export async function rejectPost(
  postId: string,
  site: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  const { data: row } = await sb
    .from('federation_newsletter_posts')
    .select('id, status')
    .eq('id', postId)
    .eq('site', site)
    .single();
  if (!row) return { ok: false, error: 'post not found' };
  if (row.status === 'published') {
    return { ok: false, error: 'cannot reject already-published post' };
  }
  const { error } = await sb
    .from('federation_newsletter_posts')
    .update({ status: 'rejected', rejection_reason: reason ?? null })
    .eq('id', postId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Public-read helper (sibling sites call this server-side) ─────────────

export async function getPublishedPost(
  site: string,
  slug: string,
): Promise<FederationPostRow | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from('federation_newsletter_posts')
    .select('*')
    .eq('site', site)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return (data as FederationPostRow | null) ?? null;
}

export async function getPublishedPostsForSite(
  site: string,
  limit = 30,
): Promise<FederationPostRow[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from('federation_newsletter_posts')
    .select('*')
    .eq('site', site)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  return (data as FederationPostRow[] | null) ?? [];
}

// ── Internals ────────────────────────────────────────────────────────────

async function callClaudeForDraft(
  brief: FederationNewsletterBrief,
): Promise<GeneratedDraft> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY missing in env');
  }

  const today = new Date().toISOString().slice(0, 10);
  const sys = `You are writing today's daily dispatch for ${brief.brandName} (${brief.domain}).
Voice: ${brief.voice}
Audience: ${brief.audience}
Niche: ${brief.niche}
Hard constraints — NEVER use any of these words/phrases: ${brief.doNotSay.join(', ')}.

Output FORMAT (strict JSON, no prose around it):
{
  "title": "<short headline, max 70 chars>",
  "slug": "<url-safe slug for ${today}, kebab-case, max 60 chars>",
  "kind": "<one of: dispatch | feature | announcement>",
  "body_md": "<markdown body, 250-450 words, no h1 (the title is rendered separately), 2-4 paragraphs, optional 1 sub-heading>"
}

The body should read like one piece of original writing for today's date (${today}).
Don't reference the date in the title. Don't pad. Don't sign off with a name.`;

  const userMsg = `Write today's dispatch.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      system: sys,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const text =
    json?.content?.[0]?.type === 'text' ? json.content[0].text : '';
  if (!text) throw new Error('No text in Claude response');

  // Extract the JSON blob — Claude often wraps it in code fences.
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error('No JSON object in Claude response');
  }
  let parsed: GeneratedDraft;
  try {
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch {
    throw new Error('Claude returned non-JSON');
  }

  // Sanity / safety pass.
  if (
    !parsed.title ||
    !parsed.slug ||
    !parsed.body_md ||
    !parsed.kind
  ) {
    throw new Error('Claude response missing required fields');
  }
  // Slug hardening: lowercase, ascii kebab, drop weird chars, max 60.
  const safeSlug = parsed.slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (!safeSlug) throw new Error('Empty slug after sanitization');

  // Re-write body to strip any forbidden words Claude slipped in.
  const lower = parsed.body_md.toLowerCase();
  for (const phrase of brief.doNotSay) {
    if (lower.includes(phrase.toLowerCase())) {
      // Don't auto-fix — fail noisily so the operator sees the brief is
      // being violated and can tighten it.
      throw new Error(
        `Claude used forbidden phrase "${phrase}" — regenerate or update the brief`,
      );
    }
  }

  return {
    title: parsed.title.slice(0, 200),
    slug: safeSlug,
    body_md: parsed.body_md,
    kind: parsed.kind,
  };
}

async function sendDraftPreviewToOperator(
  row: FederationPostRow,
  brief: FederationNewsletterBrief,
): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY missing' };

  const approveUrl = buildApproveUrl(row.id, row.site, SITE_BASE);
  const rejectUrl = buildRejectUrl(row.id, row.site, SITE_BASE);

  const subject = `[${brief.brandName}] Draft for ${new Date()
    .toISOString()
    .slice(0, 10)}: ${row.title}`;

  // Resolved against the verified-domain registry; falls back to the house
  // sender rather than handing Resend a domain it will reject.
  const fromEmail = brief.fromEmail
    ? brief.fromEmail
    : resolveSender(brief.brandName, brief.domain, 'dispatch').from;

  // Resolve owner email at draft-preview time too — the operator's
  // approval email needs to tell them WHO will receive the dispatch
  // when they approve. Null → [NO-OWNER] notice in the body so the
  // operator knows they need to SQL-UPDATE before approving.
  const ownerEmail = await resolveOwnerEmail(row.site);
  const dispatchTargetText = ownerEmail
    ? `Approve to publish + dispatch to ${escapeHtml(ownerEmail)}:`
    : `Approve to publish (NO OWNER EMAIL ON FILE — only the operator will receive the dispatch; update omni_businesses.contact_email to enable owner delivery):`;

  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:640px;margin:0 auto;padding:24px">
      <p style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px">
        ${brief.brandName} · daily dispatch draft
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">${escapeHtml(row.title)}</h1>
      <div style="white-space:pre-wrap;line-height:1.6;color:#222;font-size:15px;border-left:3px solid #d4af37;padding:8px 0 8px 16px;margin:24px 0;background:#fafafa">${escapeHtml(row.body_md)}</div>
      <div style="margin-top:32px;padding:16px;background:#f5f5f5;border-radius:8px">
        <p style="margin:0 0 12px;font-weight:bold">${dispatchTargetText}</p>
        <p style="margin:0">
          <a href="${approveUrl}" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:8px">✅ Approve</a>
          <a href="${rejectUrl}" style="display:inline-block;padding:10px 20px;background:#ef4444;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">❌ Reject</a>
        </p>
        <p style="margin:12px 0 0;font-size:11px;color:#888">
          Approve → publishes to https://${brief.domain}/newsletter/${row.slug}${ownerEmail ? ` AND emails ${escapeHtml(ownerEmail)}` : ''}.
          Reject → discards. Tokens expire in 7 days.
        </p>
      </div>
    </div>
  `;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail.includes('<') ? fromEmail : `${brief.brandName} <${fromEmail}>`,
      to: [FEDERATION_OPERATOR_EMAIL],
      subject,
      html,
    }),
  });
  if (!r.ok) {
    return { ok: false, error: `Resend ${r.status}: ${await r.text().catch(() => '')}` };
  }

  // OmniClaw Telegram one-tap approve. Fires AFTER the Resend email so a
  // failing Telegram never blocks the email path. lib/telegram.ts no-
  // ops gracefully when TELEGRAM_BOT_TOKEN is unset, so federation
  // sites without a Telegram bot just get email-only — no error path.
  // Body is plain text + raw URLs so Telegram renders them as one-tap
  // links on iOS/Android without any markdown escaping headaches.
  try {
    const telegramBody = [
      `📰 [${brief.brandName}] Draft ready`,
      ``,
      row.title,
      ``,
      `✅ Approve:`,
      approveUrl,
      ``,
      `❌ Reject:`,
      rejectUrl,
    ].join('\n');
    await sendTelegram(telegramBody);
  } catch {
    // Telegram failure is non-fatal — operator still has the email.
  }

  return { ok: true };
}

// Look up the business owner's email from omni_businesses.contact_email.
// Returns null when the business row is missing or contact_email is NULL —
// caller falls back to operator-only with a [NO-OWNER-ON-FILE] subject
// prefix so the operator can SQL-UPDATE the row to unblock per-site
// owner dispatch without a code change.
async function resolveOwnerEmail(
  federationSlug: string,
): Promise<string | null> {
  const businessSlug = getBusinessSlugForFederationSite(federationSlug);
  if (!businessSlug) return null;
  const sb = createAdminClient();
  const { data } = await sb
    .from('omni_businesses')
    .select('contact_email')
    .eq('slug', businessSlug)
    .maybeSingle();
  const email = data?.contact_email;
  if (!email || typeof email !== 'string' || !email.includes('@')) return null;
  return email;
}

// Load active (unsubscribed=false) subscriber emails for a site.
async function loadSubscriberEmails(federationSlug: string): Promise<string[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from('federation_newsletter_subscribers')
    .select('email')
    .eq('site', federationSlug)
    .eq('unsubscribed', false);
  return (data ?? [])
    .map((r: { email?: string }) => (r.email || '').trim().toLowerCase())
    .filter(Boolean);
}

async function dispatchPublishedToOwner(
  row: FederationPostRow,
  brief: FederationNewsletterBrief,
): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY missing' };

  const fromEmail = brief.fromEmail
    ? brief.fromEmail
    : resolveSender(brief.brandName, brief.domain, 'dispatch').from;
  const publicUrl = `https://${brief.domain}/newsletter/${row.slug}`;
  const ownerEmail = await resolveOwnerEmail(row.site);
  const subscribers = await loadSubscriberEmails(row.site);

  // Subject carries [NO-OWNER-ON-FILE] when contact_email is missing so
  // the operator sees in their inbox which sites still need a SQL UPDATE.
  const subject = ownerEmail
    ? row.title
    : `[NO-OWNER-ON-FILE · ${brief.brandName}] ${row.title}`;

  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:640px;margin:0 auto;padding:24px">
      <p style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px">
        ${brief.brandName} · today's dispatch
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">${escapeHtml(row.title)}</h1>
      <div style="white-space:pre-wrap;line-height:1.6;color:#222;font-size:15px;margin:24px 0">${escapeHtml(row.body_md)}</div>
      <p style="margin-top:32px;font-size:13px;color:#666">
        Read on the web: <a href="${publicUrl}" style="color:#d4af37">${publicUrl}</a>
      </p>
    </div>
  `;

  // Send to the resolved primary recipient (owner if known, else operator).
  // Operator is always on cc so they have a record of every dispatch.
  // Subscribers fan-out happens as a separate Resend batch below to avoid
  // CC'ing every subscriber on the owner email (privacy + inbox-noise).
  const primaryTo = ownerEmail ?? FEDERATION_OPERATOR_EMAIL;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail.includes('<') ? fromEmail : `${brief.brandName} <${fromEmail}>`,
      to: [primaryTo],
      cc: ownerEmail ? [FEDERATION_OPERATOR_EMAIL] : undefined,
      subject,
      html,
    }),
  });
  if (!r.ok) {
    return { ok: false, error: `Resend ${r.status}: ${await r.text().catch(() => '')}` };
  }

  // Fan out to active newsletter subscribers, BCC'd (everyone gets their
  // own copy without seeing the rest of the list). Each batched send is
  // best-effort — a single Resend failure on the subscriber batch does
  // NOT roll back the owner dispatch since the public post already
  // published. We log + continue.
  if (subscribers.length > 0) {
    // Resend's max recipients-per-call is 50; batch as needed.
    for (let i = 0; i < subscribers.length; i += 50) {
      const batch = subscribers.slice(i, i + 50);
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail.includes('<') ? fromEmail : `${brief.brandName} <${fromEmail}>`,
            to: [fromEmail],   // dummy primary; real recipients on BCC
            bcc: batch,
            subject: row.title,
            html,
          }),
        });
      } catch {
        // continue — owner already got it; per-batch subscriber failure
        // is logged in Resend dashboard
      }
    }
  }

  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
