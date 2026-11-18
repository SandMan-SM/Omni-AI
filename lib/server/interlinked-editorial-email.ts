import { footer, header, section, sectionHeading, THEME, wrapper } from "@/lib/email-template";
import { newsletterSourceLinks } from "@/lib/newsletter-source-links";
import { isEditorialSourceUrl } from "./interlinked-daily-edition";

const interlinkedSite = "https://omnileadsagi.com";

export type EditorialEmailIssue = {
  free_slug: string;
  subject: string;
  intro: string | null;
  insights: unknown;
  power_move: string | null;
};

export function interlinkedIssueUrl(slug: string) {
  if (!/^interlinked-free-\d{4}-\d{2}-\d{2}$/.test(slug)) throw new Error("Invalid public Interlinked issue slug");
  return `${interlinkedSite}/newsletter/${slug}`;
}

function text(value: unknown) {
  return typeof value === "string"
    ? value.replace(/(?:\bhttps?:\/\/|\bwww\.)\S+/gi, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

function html(value: string) {
  const escaped: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, character => escaped[character]);
}

function link(label: string, href: string) {
  return `<a href="${html(href)}" style="color:#c4b5fd;text-decoration:underline;">${html(label)}</a>`;
}

function paragraph(value: string) {
  return `<p style="margin:0 0 13px;font-size:16px;line-height:1.65;color:${THEME.text};">${html(value)}</p>`;
}

export function renderInterlinkedEditorialEmail(issue: EditorialEmailIssue, unsubscribeUrl: string) {
  const subject = text(issue.subject);
  const intro = text(issue.intro);
  const move = text(issue.power_move);
  const issueUrl = interlinkedIssueUrl(issue.free_slug);
  const subscribeUrl = `${interlinkedSite}/reader`;
  const sources = new Map<string, { label: string; context: string }>();
  const exercise: string[] = [];
  const entries = Array.isArray(issue.insights) ? issue.insights : [];

  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    const parts = newsletterSourceLinks(entry);
    const linked = parts.filter(part => part.href);
    if (!linked.length) {
      if (/\]\(/.test(entry)) continue;
      const step = text(entry);
      if (step) exercise.push(step);
      continue;
    }
    for (const part of linked) {
      if (part.href && isEditorialSourceUrl(part.href)) {
        sources.set(part.href, {
          label: text(part.text),
          context: text(parts.filter(item => !item.href).map(item => item.text).join(" ")),
        });
      }
    }
  }

  const [audience, ...steps] = exercise.slice(0, 4);
  if (!subject || !audience || steps.length !== 3) throw new Error("Interlinked issue has no complete lesson");
  const sourceLines = Array.from(sources).slice(0, 3);
  const copy = [
    subject, intro,
    "Try it today", audience,
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    move,
    ...(sourceLines.length ? ["Primary sources", ...sourceLines.map(([url, source]) => `${source.context} ${source.label}: ${url}`.trim())] : []),
    `Read the issue: ${issueUrl}`,
    `Forwarded this email? Get the next issue: ${subscribeUrl}`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].filter(Boolean).join("\n\n");

  const body = [
    header({ eyebrow: "AIS Interlinked", title: subject, accent: "purple" }),
    ...(intro ? [section(paragraph(intro))] : []),
    sectionHeading("Try it today", "purple"),
    section(paragraph(audience) +
      `<ol style="margin:0 0 16px;padding-left:22px;color:${THEME.text};line-height:1.65;">${steps.map(step => `<li style="margin-bottom:8px;">${html(step)}</li>`).join("")}</ol>` +
      (move ? paragraph(move) : "")),
    ...(sourceLines.length ? [
      sectionHeading("Primary sources", "purple"),
      section(sourceLines.map(([url, source]) =>
        `<p style="margin:0 0 14px;color:${THEME.text};line-height:1.65;">${html(source.context)} ${link(source.label, url)}</p>`).join("")),
    ] : []),
    section(`<p style="margin:0 0 12px;">${link("Read the issue", issueUrl)}</p><p style="margin:0;color:${THEME.text};">Forwarded this email? ${link("Get the next issue", subscribeUrl)}</p>`),
    footer({ tagline: "AIS Interlinked", links: [{ label: "Unsubscribe", href: unsubscribeUrl }] }),
  ].join("");
  return { subject, html: wrapper({ title: subject, preheader: intro.slice(0, 140), body }), text: copy };
}
