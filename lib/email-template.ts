/**
 * OMNI AI — EMAIL DESIGN SYSTEM (locked)
 * ----------------------------------------------------------------------------
 * Read `docs/email-design-system.md` BEFORE editing this file. The rules there
 * are enforced by code review: if you "simplify" a <table> into a flex <div>,
 * or replace a hex color with rgba(), you are reverting to broken behavior.
 *
 * Every Omni AI transactional + newsletter email routes through these helpers.
 * They exist because email clients (Gmail, Apple Mail, Outlook, Yahoo) do NOT
 * support: flex, grid, CSS variables, <style> blocks (Gmail strips them),
 * linear-gradient on non-button elements, rgba() backgrounds, viewport units.
 *
 * If something renders wrong in production, first assumption: one of those
 * rules was violated somewhere in the caller. Check before you "fix" this file.
 */

export type Accent = 'green' | 'cyan' | 'purple' | 'amber' | 'red';

/** Locked palette — hex only. No rgba. No tailwind tokens. */
export const THEME = {
  // Canvas (outer body bg — matches site `bg-gray-950` feel)
  canvas: '#0a0a0f',
  // Card surface (sections, KPI rows)
  surface: '#13131a',
  surfaceRaised: '#1a1a22',
  // Borders (hex, no rgba — rgba borders look washed-out in Outlook)
  border: '#262631',
  borderStrong: '#3a3a48',
  // Text
  textPrimary: '#f1f5f9',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  textSubtle: '#6b7280',
  // Accents (each template picks exactly one primary accent)
  green: '#10b981',
  greenBg: '#0d2a22', // flat hex alternative to rgba(16,185,129,.08)
  cyan: '#06b6d4',
  cyanBg: '#082530',
  purple: '#a855f7',
  purpleBg: '#1f1230',
  amber: '#f59e0b',
  amberBg: '#2a1f0a',
  red: '#ef4444',
  redBg: '#2d1215',
  // Fonts (system stacks — email-safe, no web fonts)
  fontBody: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace",
} as const;

const ACCENT_HEX: Record<Accent, string> = {
  green: THEME.green,
  cyan: THEME.cyan,
  purple: THEME.purple,
  amber: THEME.amber,
  red: THEME.red,
};
const ACCENT_BG: Record<Accent, string> = {
  green: THEME.greenBg,
  cyan: THEME.cyanBg,
  purple: THEME.purpleBg,
  amber: THEME.amberBg,
  red: THEME.redBg,
};

export const accentColor = (a: Accent) => ACCENT_HEX[a];
export const accentBg = (a: Accent) => ACCENT_BG[a];

export const fmtMoney = (n: number): string =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${Math.round(n).toLocaleString()}`;

/** Outer document wrapper — 640px centered table, canvas bg, body font. */
export function wrapper(opts: {
  title: string;
  preheader?: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escape(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${THEME.canvas};color:${THEME.text};font-family:${THEME.fontBody};-webkit-font-smoothing:antialiased;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${THEME.canvas};">${escape(opts.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${THEME.canvas};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;">
      ${opts.body}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Brand header: monospace eyebrow + bold title. */
export function header(opts: { eyebrow: string; title: string; meta?: string; accent?: Accent }): string {
  const acc = opts.accent ? ACCENT_HEX[opts.accent] : THEME.green;
  return `
<tr><td style="padding:0 0 24px;">
  <p style="margin:0 0 6px;font-family:${THEME.fontMono};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${acc};">${escape(opts.eyebrow)}</p>
  <h1 style="margin:0;font-family:${THEME.fontBody};font-size:28px;line-height:1.2;font-weight:800;color:${THEME.textPrimary};letter-spacing:-0.01em;">${escape(opts.title)}</h1>
  ${opts.meta ? `<p style="margin:8px 0 0;font-size:13px;color:${THEME.textMuted};">${escape(opts.meta)}</p>` : ''}
</td></tr>`;
}

/** KPI grid — table (NOT flex) with N equal cells. Values big, labels small & muted. */
export interface Kpi {
  value: string;
  label: string;
  color?: string; // override; defaults to THEME.textPrimary
}
export function kpiRow(kpis: Kpi[]): string {
  const cells = kpis
    .map(
      (k) => `
      <td width="${Math.floor(100 / kpis.length)}%" align="left" valign="top" style="padding:8px 12px;">
        <div style="font-family:${THEME.fontBody};font-size:26px;line-height:1.1;font-weight:700;color:${k.color || THEME.textPrimary};">${escape(k.value)}</div>
        <div style="margin-top:6px;font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${THEME.textSubtle};">${escape(k.label)}</div>
      </td>`
    )
    .join('');
  return `
<tr><td style="padding:0 0 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${THEME.surface};border:1px solid ${THEME.border};border-radius:12px;">
    <tr>${cells}</tr>
  </table>
</td></tr>`;
}

/** Section heading — mono uppercase accent label. Use before section(). */
export function sectionHeading(label: string, accent: Accent = 'green'): string {
  return `
<tr><td style="padding:8px 0 10px;">
  <p style="margin:0;font-family:${THEME.fontMono};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${ACCENT_HEX[accent]};">${escape(label)}</p>
</td></tr>`;
}

/** Card container — dark surface w/ border. Children passed as raw HTML. */
export function section(innerHtml: string, opts?: { accent?: Accent; padding?: string }): string {
  return `
<tr><td style="padding:0 0 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${THEME.surface};border:1px solid ${THEME.border};border-radius:12px;">
    <tr><td style="padding:${opts?.padding || '20px 22px'};">${innerHtml}</td></tr>
  </table>
</td></tr>`;
}

/** Callout — colored left border, soft bg, for highlighted advice. */
export function callout(label: string, body: string, accent: Accent = 'amber'): string {
  const acc = ACCENT_HEX[accent];
  const bg = ACCENT_BG[accent];
  return `
<tr><td style="padding:0 0 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-radius:10px;border-left:3px solid ${acc};">
    <tr><td style="padding:16px 20px;">
      <p style="margin:0 0 6px;font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${acc};font-weight:700;">${escape(label)}</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${THEME.text};">${body}</p>
    </td></tr>
  </table>
</td></tr>`;
}

/** Paragraph — standard prose line. */
export function p(html: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:${THEME.text};">${html}</p>`;
}

/** Bulleted row item — used for ship timelines, lists. */
export function listRow(opts: { kind?: string; when?: string; title: string; detail?: string; unlocks?: string; accent?: Accent }): string {
  const acc = opts.accent ? ACCENT_HEX[opts.accent] : THEME.green;
  const meta: string[] = [];
  if (opts.kind) meta.push(`<span style="font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${acc};">${escape(opts.kind)}</span>`);
  if (opts.when) meta.push(`<span style="font-family:${THEME.fontMono};font-size:10px;color:${THEME.textSubtle};">${escape(opts.when)}</span>`);
  return `
<tr><td style="padding:10px 0;border-bottom:1px solid ${THEME.border};">
  ${meta.length ? `<div style="margin:0 0 4px;">${meta.join(' <span style="color:' + THEME.textSubtle + ';">·</span> ')}</div>` : ''}
  <div style="font-size:14px;line-height:1.5;color:${THEME.textPrimary};font-weight:600;">${escape(opts.title)}</div>
  ${opts.detail ? `<div style="margin-top:4px;font-size:13px;line-height:1.55;color:${THEME.textMuted};">${escape(opts.detail)}</div>` : ''}
  ${opts.unlocks ? `<div style="margin-top:4px;font-size:12px;line-height:1.5;color:${acc};">→ unlocks: ${escape(opts.unlocks)}</div>` : ''}
</td></tr>`;
}

/** Data table — for KPI-per-client matrices. Returns a <table>. */
export interface TableRow {
  cells: Array<{ content: string; align?: 'left' | 'right' | 'center'; color?: string }>;
}
export function dataTable(header: string[], rows: TableRow[]): string {
  const head = header
    .map(
      (h, i) =>
        `<th align="${i === 0 ? 'left' : 'right'}" style="padding:10px 8px;font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${THEME.textSubtle};font-weight:600;border-bottom:1px solid ${THEME.border};">${escape(h)}</th>`
    )
    .join('');
  const body = rows
    .map(
      (r) =>
        `<tr>${r.cells
          .map(
            (c) =>
              `<td align="${c.align || 'left'}" style="padding:10px 8px;font-size:14px;color:${c.color || THEME.text};border-bottom:1px solid ${THEME.border};">${c.content}</td>`
          )
          .join('')}</tr>`
    )
    .join('');
  return `
<tr><td style="padding:0 0 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${THEME.surface};border:1px solid ${THEME.border};border-radius:12px;">
    <tr><td style="padding:6px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </td></tr>
  </table>
</td></tr>`;
}

/** CTA button — table-based (the only email-safe way). */
export function button(opts: { href: string; label: string; accent?: Accent }): string {
  const acc = opts.accent ? ACCENT_HEX[opts.accent] : THEME.green;
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr><td align="center" style="background:${acc};border-radius:8px;">
    <a href="${escape(opts.href)}" style="display:inline-block;padding:14px 28px;font-family:${THEME.fontBody};font-size:15px;font-weight:700;color:#0a0a0f;text-decoration:none;letter-spacing:0.01em;">${escape(opts.label)}</a>
  </td></tr>
</table>`;
}

/** Two-button row (primary + secondary outline). */
export function buttonRow(
  primary: { href: string; label: string; accent?: Accent },
  secondary?: { href: string; label: string }
): string {
  const acc = primary.accent ? ACCENT_HEX[primary.accent] : THEME.green;
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
  <tr>
    <td style="padding:0 6px;background:${acc};border-radius:8px;">
      <a href="${escape(primary.href)}" style="display:inline-block;padding:14px 26px;font-family:${THEME.fontBody};font-size:15px;font-weight:700;color:#0a0a0f;text-decoration:none;">${escape(primary.label)}</a>
    </td>
    ${secondary ? `<td style="padding:0 6px;border:1px solid ${THEME.borderStrong};border-radius:8px;">
      <a href="${escape(secondary.href)}" style="display:inline-block;padding:13px 24px;font-family:${THEME.fontBody};font-size:14px;font-weight:600;color:${THEME.text};text-decoration:none;">${escape(secondary.label)}</a>
    </td>` : ''}
  </tr>
</table>`;
}

/** Centered CTA block with tagline + button(s). */
export function ctaBlock(opts: {
  tagline: string;
  primary: { href: string; label: string; accent?: Accent };
  secondary?: { href: string; label: string };
}): string {
  return `
<tr><td style="padding:8px 0 20px;" align="center">
  <p style="margin:0 0 14px;font-size:14px;color:${THEME.textMuted};line-height:1.55;text-align:center;">${opts.tagline}</p>
  ${buttonRow(opts.primary, opts.secondary)}
</td></tr>`;
}

/** Footer — small muted text + links. */
export function footer(opts: { tagline: string; links?: Array<{ label: string; href: string }> }): string {
  const linksHtml = (opts.links || [])
    .map((l) => `<a href="${escape(l.href)}" style="color:${THEME.textMuted};text-decoration:underline;">${escape(l.label)}</a>`)
    .join(` <span style="color:${THEME.textSubtle};">·</span> `);
  return `
<tr><td style="padding:28px 0 0;border-top:1px solid ${THEME.border};">
  <p style="margin:0 0 6px;text-align:center;font-family:${THEME.fontMono};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${THEME.textSubtle};">${escape(opts.tagline)}</p>
  ${linksHtml ? `<p style="margin:0;text-align:center;font-size:12px;color:${THEME.textSubtle};">${linksHtml}</p>` : ''}
</td></tr>`;
}

/** Vertical spacer. */
export function spacer(px: number = 12): string {
  return `<tr><td style="font-size:0;line-height:0;height:${px}px;">&nbsp;</td></tr>`;
}

/** Emoji/severity dot — ALWAYS use text, never CSS-drawn circles (Outlook kills them). */
export const dot = (sev: 'red' | 'yellow' | 'green'): string => (sev === 'red' ? '🔴' : sev === 'yellow' ? '🟡' : '🟢');

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] as string);
}
