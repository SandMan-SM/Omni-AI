// Per-business welcome email for new subscribers.
//
// Every /subscribe form across the federation funnels through the central
// inbound ingest (/api/inbound/<slug>/events) carrying the brand identity in
// the event `slug` + `properties`. This resolves the right brand and builds a
// clean, on-brand welcome email the subscriber receives the instant they join.
//
// Deliverability: the email is SENT from the verified omnileadsagi.com domain
// (with the brand's display name) — never from an unverified brand domain.

type Props = Record<string, unknown>;

function str(p: Props, k: string): string | null {
  const v = p[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

type Brand = { name: string; site: string };

// Direct slug → brand (single-brand ingests).
const SLUG_BRAND: Record<string, Brand> = {
  omni: { name: 'Omni AI', site: 'https://omnileadsagi.com' },
  omnileads: { name: 'Omni AI', site: 'https://omnileadsagi.com' },
  mythos: { name: 'Mythos AIS', site: 'https://mythosais.com' },
  mythosais: { name: 'Mythos AIS', site: 'https://mythosais.com' },
  utahmainstreet: { name: 'Utah Main Street', site: 'https://utahmainstreet.com' },
  theixnetwork: { name: 'The IX Network', site: 'https://theixnetwork.com' },
};

// The utahmainstreet ingest is shared by three newsroom mastheads; `source`
// tells us which paper the reader actually signed up on.
const SOURCE_BRAND: Record<string, Brand> = {
  wasatch: { name: 'The Wasatch Post', site: 'https://thewasatchpost.com' },
  beehive: { name: 'Beehive Biz Pulse', site: 'https://beehivebizpulse.com' },
  utahmainstreet: { name: 'Utah Main Street', site: 'https://utahmainstreet.com' },
};

function resolveBrand(slug: string, props: Props): Brand | null {
  const source = (str(props, 'source') || '').toLowerCase();
  const brandProp = str(props, 'brand') || str(props, 'from_name');
  const brandDomain = str(props, 'brand_domain');

  // Newsroom network: brand by the specific masthead.
  if (slug === 'utahmainstreet' && SOURCE_BRAND[source]) return SOURCE_BRAND[source];

  // IX Network members each pass their own brand + domain.
  if (slug === 'theixnetwork' && brandProp) {
    const site = brandDomain
      ? `https://${brandDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : 'https://theixnetwork.com';
    return { name: brandProp, site };
  }

  if (SLUG_BRAND[slug]) return SLUG_BRAND[slug];

  // Fallback: any ingest that passed an explicit brand.
  if (brandProp) {
    const site = brandDomain
      ? `https://${brandDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
      : 'https://omnileadsagi.com';
    return { name: brandProp, site };
  }
  return null;
}

export type WelcomeEmail = {
  fromName: string;
  subject: string;
  html: string;
  text: string;
  site: string;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildWelcomeEmail(slug: string, props: Props): WelcomeEmail | null {
  const brand = resolveBrand(slug, props);
  if (!brand) return null;

  const name = brand.name;
  const site = brand.site;
  const host = site.replace(/^https?:\/\//, '');
  const address = process.env.OMNI_PHYSICAL_ADDRESS || '';

  const subject = `Welcome to ${name}`;
  const lede = `You're in. Thanks for subscribing to ${name}.`;
  const body =
    `You'll start getting our best updates, stories, and offers — no spam, and you can unsubscribe anytime.`;

  const text = [
    lede,
    '',
    body,
    '',
    `Visit us: ${site}`,
    '',
    `You're receiving this because you subscribed at ${host}. Not you? Reply to this email and we'll remove you.`,
    address ? address : '',
  ]
    .filter(Boolean)
    .join('\n');

  const html = `<!doctype html><html><body style="margin:0;background:#0a0a12;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e9e7f5;">
  <div style="max-width:520px;margin:0 auto;padding:40px 28px;">
    <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#8b7cff;font-weight:700;">${esc(name)}</div>
    <h1 style="margin:14px 0 0;font-size:26px;line-height:1.2;color:#ffffff;">${esc(lede)}</h1>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#b9b6cf;">${esc(body)}</p>
    <p style="margin:28px 0 0;">
      <a href="${esc(site)}" style="display:inline-block;background:#8b7cff;color:#0a0a12;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;">Visit ${esc(name)}</a>
    </p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,.1);margin:32px 0 18px;">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#75728c;">
      You're receiving this because you subscribed at ${esc(host)}. Not you? Just reply to this email and we'll remove you.${address ? `<br>${esc(address)}` : ''}
    </p>
  </div></body></html>`;

  return { fromName: name, subject, html, text, site };
}
