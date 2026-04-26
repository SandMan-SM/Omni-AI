import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Generate an HTML email signature using business branding + sender info
export async function POST(req: NextRequest) {
  try {
    const { business_id } = await req.json();
    if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

    const { data: business } = await supabase
      .from('omni_businesses').select('*').eq('id', business_id).single();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const b = business as Record<string, unknown>;
    const senderName = (b.sender_name as string) ?? '[Your Name]';
    const senderEmail = (b.sender_email as string) ?? '';
    const senderPhone = (b.sender_phone as string) ?? '';
    const bookingUrl = (b.booking_url as string) ?? '';
    const primary = (b.brand_primary_color as string) ?? '#10b981';

    // Manual HTML signature (always works, no Claude needed)
    const html = `<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;font-size:13px;line-height:1.5">
  <tr>
    <td style="border-left:3px solid ${primary};padding-left:14px">
      <div style="font-weight:700;font-size:14px;color:#0f172a">${senderName}</div>
      <div style="color:#64748b;font-size:12px;margin-top:2px">${b.industry ?? ''} · ${b.name}</div>
      <div style="margin-top:8px;color:#475569;font-size:12px">
        ${senderEmail ? `<a href="mailto:${senderEmail}" style="color:${primary};text-decoration:none">${senderEmail}</a>` : ''}
        ${senderPhone ? ` &nbsp;·&nbsp; ${senderPhone}` : ''}
      </div>
      ${bookingUrl ? `<div style="margin-top:10px"><a href="${bookingUrl}" style="background:${primary};color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;display:inline-block">📅 Book a 15-min</a></div>` : ''}
    </td>
  </tr>
</table>`;

    // Optionally let Claude write a tagline if API key is set
    let tagline: string | null = null;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const resp = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: `Write a 6-9 word email signature tagline for ${b.name} (${b.industry}). Conversational, no buzzwords. Return just the tagline, no quotes.`,
          }],
        });
        const tb = resp.content.find(b => b.type === 'text');
        if (tb && tb.type === 'text') tagline = tb.text.trim();
      } catch { /* swallow */ }
    }

    const finalHtml = tagline
      ? html.replace('</table>', `<tr><td style="padding-top:8px;color:#94a3b8;font-style:italic;font-size:11px">${tagline}</td></tr></table>`)
      : html;

    await supabase
      .from('omni_businesses')
      .update({ brand_signature_html: finalHtml })
      .eq('id', business_id);

    return NextResponse.json({ ok: true, html: finalHtml, tagline });
  } catch (err) {
    console.error('[signature/generate]', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
