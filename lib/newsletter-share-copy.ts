export type NewsletterSharePost = {
  subject?: unknown;
  intro?: unknown;
  insights?: unknown;
  power_move?: unknown;
  keywords?: unknown;
  tier?: unknown;
};

function text(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (value && typeof value === "object") {
    const item = value as { body?: unknown; text?: unknown; heading?: unknown; title?: unknown };
    return [item.body, item.text, item.heading, item.title]
      .map(text)
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function firstInsight(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = text(item);
      if (candidate) return candidate;
    }
    return "";
  }
  return text(value);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function isDistinct(candidate: string, subject: string): boolean {
  const a = normalize(candidate);
  const b = normalize(subject);
  return Boolean(a && a !== b && a.length >= 28);
}

function hash(value: string): number {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

function sentenceLead(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim().replace(/^[—–-]+\s*/, "");
  if (/^[A-Z][a-z]/.test(clean)) return clean[0].toLowerCase() + clean.slice(1);
  return clean;
}

function clip(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const shortened = clean.slice(0, Math.max(0, maxLength - 1));
  const boundary = shortened.lastIndexOf(" ");
  return `${(boundary > maxLength * 0.7 ? shortened.slice(0, boundary) : shortened).trim()}…`;
}

const hooks = [
  "I know you're curious—",
  "You can feel the shift—",
  "Here's the part most people miss—",
  "This gets interesting fast—",
  "The headline is only the beginning—",
  "You'll want to see what happens next—",
];

/** Builds issue-specific teaser copy instead of repeating the headline. */
export function newsletterShareDescription(post: NewsletterSharePost, maxLength = 155): string {
  const subject = text(post.subject) || "this shift";
  const hook = hooks[hash(subject) % hooks.length];
  const candidate = [text(post.intro), firstInsight(post.insights), text(post.power_move)]
    .find((item) => isDistinct(item, subject));

  if (candidate) return clip(`${hook}${sentenceLead(candidate)}`, maxLength);

  const tier = text(post.tier).toLowerCase() === "premium" ? "premium briefing" : "briefing";
  return clip(`${hook}this ${tier} reveals what ${subject} changes, what others will miss, and the move to make next.`, maxLength);
}
