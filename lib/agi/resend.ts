// Resend send + tracking helper.
// Wraps the Resend SDK and updates outreach asset status in Supabase after send.

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { notifyReply } from './telegram';

// Lazy-instantiate so we don't throw at module load when key is missing.
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type SendInput = {
  asset_id: string;
  to: string;
  from?: string;
  subject: string;
  body: string;
};

export async function sendOutreachEmail(input: SendInput): Promise<{
  ok: boolean;
  message_id?: string;
  error?: string;
}> {
  const from = input.from ?? process.env.RESEND_FROM ?? 'OmniLeads AGI <agent@omnileadsagi.com>';

  // Check suppression list first (unsubscribes are legally must-respect)
  // Skip the system booking confirmation email (no asset to update).
  if (input.asset_id !== 'system-booking-confirm') {
    const { data: asset } = await supabase
      .from('omni_outreach_assets')
      .select('business_id')
      .eq('id', input.asset_id)
      .single();
    if (asset?.business_id) {
      const { data: isSuppressed } = await supabase.rpc('omni_is_suppressed', {
        p_business_id: asset.business_id,
        p_email: input.to,
      });
      if (isSuppressed) {
        await supabase
          .from('omni_outreach_assets')
          .update({ status: 'bounced' })
          .eq('id', input.asset_id);
        return { ok: false, error: 'Recipient is on the suppression list (previously unsubscribed/bounced)' };
      }
    }
  }

  const resend = getResend();
  if (!resend) {
    // Stub mode: mark as sent but skip actual delivery.
    await supabase
      .from('omni_outreach_assets')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        resend_message_id: `stub-${Date.now()}`,
      })
      .eq('id', input.asset_id);
    return { ok: true, message_id: `stub-${Date.now()}` };
  }

  // Render plaintext body to HTML with line breaks.
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#1e293b;max-width:560px">${input.body.replace(/\n/g, '<br>')}</div>`;

  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html,
    text: input.body,
    headers: {
      'X-Asset-Id': input.asset_id,
    },
    tags: [{ name: 'asset_id', value: input.asset_id }],
  });

  if (error) {
    await supabase
      .from('omni_outreach_assets')
      .update({ status: 'bounced' })
      .eq('id', input.asset_id);
    return { ok: false, error: error.message };
  }

  await supabase
    .from('omni_outreach_assets')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      resend_message_id: data?.id,
    })
    .eq('id', input.asset_id);

  return { ok: true, message_id: data?.id };
}

// Webhook handler for Resend events (opens, clicks, replies, bounces).
// On 'replied': mark lead as qualified and CANCEL any later-touch scheduled emails.
export async function handleResendWebhook(event: {
  type: string;
  data: { email_id?: string; tags?: Record<string, string> };
}) {
  const messageId = event.data.email_id;
  if (!messageId) return;

  const updates: Record<string, string> = {};
  // Only "opened" advances the status; "clicked" alone doesn't transition
  // the row out of opened (it just records clicked_at). "replied" and
  // "bounced" are stronger terminal signals that we never want to roll
  // back to "opened" — see the targeted update query below.
  switch (event.type) {
    case 'email.opened':
      updates.status = 'opened';
      updates.opened_at = new Date().toISOString();
      break;
    case 'email.clicked':
      updates.clicked_at = new Date().toISOString();
      break;
    case 'email.bounced':
      updates.status = 'bounced';
      break;
    case 'email.replied':
      updates.status = 'replied';
      updates.replied_at = new Date().toISOString();
      break;
  }

  if (Object.keys(updates).length === 0) return;

  // Build the update with a status-aware guard: an out-of-order or retried
  // 'opened' webhook used to clobber an already-replied/bounced row, which
  // hid genuine replies in the inbox/dashboard. For 'opened' we restrict
  // the UPDATE to rows whose current status is still 'sent' so a stronger
  // terminal status survives. The other event types remain authoritative.
  let q = supabase
    .from('omni_outreach_assets')
    .update(updates)
    .eq('resend_message_id', messageId);
  if (event.type === 'email.opened') {
    q = q.eq('status', 'sent');
  }
  // Include the asset's own id so we can populate
  // omni_suppressions.source_asset_id correctly on bounce — the prior
  // version passed lead_id (a foreign-key into a different table)
  // which made the audit trail useless and broke any later joins.
  const { data: asset } = await q
    .select('id, lead_id, touch_number, business_id')
    .single();

  // Auto-suppress on hard bounce
  if (event.type === 'email.bounced' && asset?.business_id) {
    const { data: lead } = await supabase
      .from('omni_leads_generated')
      .select('email')
      .eq('id', asset.lead_id)
      .single();
    if (lead?.email) {
      await supabase
        .from('omni_suppressions')
        .upsert({
          business_id: asset.business_id,
          email: lead.email.toLowerCase(),
          reason: 'bounce',
          source_asset_id: asset.id,
        }, { onConflict: 'business_id,email' });
    }
  }

  // On reply: auto-promote lead to 'qualified' and cancel later touches.
  //
  // The previous filter only promoted leads still in 'new' status. But
  // most replies happen AFTER the first send moved the lead to
  // 'contacted' — the contacted→qualified transition is exactly what
  // a reply signals. Promote both 'new' and 'contacted' so the dashboard's
  // qualified count reflects the actual sales-funnel reality.
  // We still skip already-qualified / converted / lost leads so a reply
  // doesn't roll back a manually-classified terminal state.
  if (event.type === 'email.replied' && asset) {
    await supabase
      .from('omni_leads_generated')
      .update({ status: 'qualified' })
      .eq('id', asset.lead_id)
      .in('status', ['new', 'contacted']);

    // Cancel scheduled emails with higher touch numbers (don't keep sending if they replied)
    await supabase
      .from('omni_outreach_assets')
      .update({ status: 'draft' })
      .eq('lead_id', asset.lead_id)
      .eq('asset_type', 'email')
      .eq('status', 'scheduled')
      .gt('touch_number', asset.touch_number);

    // Telegram notification (fire-and-forget; ignore errors)
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const { data: lead } = await supabase
        .from('omni_leads_generated')
        .select('first_name, last_name, company, email')
        .eq('id', asset.lead_id)
        .single();

      const fullName = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || lead?.email || 'A lead';

      notifyReply({
        leadName: fullName,
        company: lead?.company ?? null,
        category: null, // categorized later by /api/replies/categorize
        snippet: 'Replied to your outreach. Later touches auto-paused.',
      }).catch(() => {});
    }
  }
}
