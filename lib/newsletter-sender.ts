/**
 * Newsletter sender — shared logic for cron job and manual sends.
 * Generates content via Claude, delivers to Telegram + email.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const NEWSLETTER_FROM = process.env.NEWSLETTER_FROM_EMAIL || 'newsletter@omni-ai.co';
const NEWSLETTER_TO = process.env.NEWSLETTER_TO_EMAIL || 'sitanim8@gmail.com';

export interface NewsletterContent {
  subject: string;
  intro: string;
  insights: string[];
  power_move: string;
  closing: string;
}

export async function generateContent(): Promise<NewsletterContent> {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (!ANTHROPIC_API_KEY) {
    return fallbackContent(today);
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are the Omni AI newsletter writer. Generate today's (${today}) daily newsletter.

Write a newsletter with:
1. A punchy subject line
2. Brief intro (2-3 sentences)
3. 3 key AI/business insights for today
4. One "Power Move" — a specific action readers can take today
5. A motivational closing line

Omni AI brand tone: visionary, sharp, empowering.

Respond ONLY with valid JSON using these exact keys:
{"subject":"...","intro":"...","insights":["...","...","..."],"power_move":"...","closing":"..."}`
        }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text: string = data.content[0].text;
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      if (start >= 0) {
        return JSON.parse(text.slice(start, end)) as NewsletterContent;
      }
    }
  } catch (e) {
    console.error('Content generation error:', e);
  }

  return fallbackContent(today);
}

function fallbackContent(today: string): NewsletterContent {
  return {
    subject: `Omni AI Daily — ${today}`,
    intro: 'Welcome to your daily Omni AI briefing. Here\'s what\'s moving in AI and business today.',
    insights: [
      'AI automation is reducing operational costs by 30-40% for early adopters.',
      'The businesses winning in 2026 treat AI as a strategic partner, not just a tool.',
      'Data quality beats model quality — clean your data before scaling your AI.',
    ],
    power_move: 'Audit one repetitive process in your business today and identify where AI could automate it.',
    closing: 'Stay ahead. Stay sharp. Omni AI.',
  };
}

export async function sendToTelegram(content: NewsletterContent): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const insights = content.insights.map((ins, i) => `  ${i + 1}. ${ins}`).join('\n');
  const text = `📰 *Omni AI Daily Newsletter*\n_${today}_\n\n${content.intro}\n\n*Today's Key Insights:*\n${insights}\n\n*Power Move:*\n💡 _${content.power_move}_\n\n_${content.closing}_`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }),
    });
    return res.ok;
  } catch (e) {
    console.error('Telegram send error:', e);
    return false;
  }
}

export async function sendEmail(content: NewsletterContent, to: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const insightsHtml = content.insights.map(ins =>
    `<li style="margin-bottom:12px;line-height:1.6;">${ins}</li>`
  ).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#0f0f1a;color:#e0e0e0;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#00d4ff;font-size:28px;margin:0;">Omni AI</h1>
      <p style="color:#888;font-size:14px;margin:8px 0 0;">Daily Intelligence Brief · ${today}</p>
    </div>
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:28px;margin-bottom:24px;">
      <p style="font-size:16px;line-height:1.7;color:#e0e0e0;margin:0;">${content.intro}</p>
    </div>
    <div style="margin-bottom:24px;">
      <h2 style="color:#00d4ff;font-size:18px;margin-bottom:16px;">Today's Key Insights</h2>
      <ul style="padding-left:20px;color:#e0e0e0;font-size:15px;">${insightsHtml}</ul>
    </div>
    <div style="background:rgba(0,212,255,0.08);border-left:3px solid #00d4ff;padding:20px 24px;border-radius:0 8px 8px 0;margin-bottom:32px;">
      <p style="color:#00d4ff;font-weight:bold;margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Power Move</p>
      <p style="color:#e0e0e0;font-size:15px;line-height:1.7;margin:0;">${content.power_move}</p>
    </div>
    <p style="text-align:center;color:#888;font-style:italic;font-size:15px;">${content.closing}</p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:32px 0;">
    <p style="text-align:center;font-size:12px;color:#555;">You're receiving this from Omni AI.<br>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://omni-ai-theta.vercel.app'}/dashboard" style="color:#00d4ff;">Manage subscription</a>
    </p>
  </div>
</body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: NEWSLETTER_FROM, to: [to], subject: content.subject, html }),
    });
    return res.ok;
  } catch (e) {
    console.error('Email send error:', e);
    return false;
  }
}

export async function runDailyNewsletter(supabase: any = null) {
  const content = await generateContent();

  const [telegramOk, emailOk] = await Promise.all([
    sendToTelegram(content),
    sendEmail(content, NEWSLETTER_TO),
  ]);

  // Send to premium subscribers if supabase client provided
  let premiumSent = 0;
  if (supabase) {
    try {
      const { data: premiumSubs } = await (supabase as any)
        .from('newsletter_subscriptions')
        .select('email')
        .eq('subscription_tier', 'premium')
        .eq('subscribed', true);

      if (premiumSubs?.length) {
        const results = await Promise.allSettled(
          premiumSubs.map((sub: { email: string }) => sendEmail(content, sub.email))
        );
        premiumSent = results.filter(r => r.status === 'fulfilled' && r.value).length;
      }
    } catch (e) {
      console.error('Premium subscriber send error:', e);
    }
  }

  return { content, telegramOk, emailOk, premiumSent };
}
