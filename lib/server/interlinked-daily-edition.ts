import type { SupabaseClient } from "@supabase/supabase-js";
import { editorialUsefulness, practiceForSource, writePractice } from "./interlinked-editorial";

type Feed = { name: string; url: string; hosts: readonly string[] };
type Story = { publisher: string; title: string; description: string; url: string; published: Date; hosts: readonly string[] };

const feeds: readonly Feed[] = [
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", hosts: ["openai.com"] },
  { name: "Google AI", url: "https://blog.google/innovation-and-ai/technology/ai/rss/", hosts: ["blog.google"] },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", hosts: ["deepmind.google"] },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", hosts: ["huggingface.co"] },
  { name: "Google Research", url: "https://research.google/blog/rss/", hosts: ["research.google"] },
];

const field = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\/${tag}>`, "i"))?.[1] || "";

function cleanFeedText(value: string) {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  const decoded = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, raw: string) => {
      const key = raw.toLowerCase();
      if (!key.startsWith("#")) return entities[key] || entity;
      const point = key.startsWith("#x") ? Number.parseInt(key.slice(2), 16) : Number(key.slice(1));
      return point > 31 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    });
  return decoded.replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function allowedUrl(value: string, hosts: readonly string[]) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port && hosts.includes(url.hostname)) {
      return url;
    }
  } catch { /* A malformed feed entry is discarded. */ }
  return null;
}

const editorialHosts = feeds.flatMap(feed => feed.hosts);

export function isEditorialSourceUrl(value: string) {
  return Boolean(allowedUrl(value, editorialHosts));
}

export function parseInterlinkedFeed(xml: string, feed: Feed, now: Date): Story[] {
  return Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)).slice(0, 20).flatMap(([, item]) => {
    const title = cleanFeedText(field(item, "title"));
    const link = allowedUrl(cleanFeedText(field(item, "link")), feed.hosts);
    const published = new Date(cleanFeedText(field(item, "pubDate")));
    const age = now.getTime() - published.getTime();
    if (!title || title.length > 250 || !link || !Number.isFinite(age) || age < 0 || age > 14 * 86400000) return [];
    link.hash = "";
    return [{
      publisher: feed.name, title, url: link.toString(), published, hosts: feed.hosts,
      description: cleanFeedText(field(item, "description")).slice(0, 450),
    }];
  });
}

async function sourceRequest(url: string, hosts: readonly string[], method = "GET") {
  const signal = AbortSignal.timeout(6500);
  for (let redirects = 0; redirects < 3; redirects++) {
    const target = allowedUrl(url, hosts);
    if (!target) throw new Error("Source left the approved host");
    const response = await fetch(target, {
      method, redirect: "manual", signal, cache: "no-store",
      headers: { "User-Agent": "InterlinkedEditorial/1.0" },
    });
    if (response.ok) return response;
    const location = response.headers.get("location");
    if (response.status < 300 || response.status > 399 || !location) break;
    url = new URL(location, target).toString();
  }
  throw new Error("Official source was unavailable");
}

async function boundedFeedText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Official feed returned no body");
  const decoder = new TextDecoder();
  let result = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return result + decoder.decode();
      bytes += value.byteLength;
      if (bytes > 2_000_000) throw new Error("Official feed exceeded the size limit");
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

const subjectWords = (title: string) => new Set(title.toLowerCase().match(/[a-z0-9]{3,}/g) || []);

function sameTopic(a: string, b: string) {
  const left = subjectWords(a);
  const right = subjectWords(b);
  const overlap = Array.from(left).filter(word => right.has(word)).length;
  return overlap >= 3 && overlap / Math.max(left.size, right.size) >= 0.7;
}

async function gatherStories(now: Date, used: ReadonlySet<string>, recentTitles: readonly string[]) {
  const results = await Promise.allSettled(feeds.map(async (feed) => {
    const response = await sourceRequest(feed.url, feed.hosts);
    return parseInterlinkedFeed(await boundedFeedText(response), feed, now);
  }));
  const priority = (story: Story) => editorialUsefulness(story) - (now.getTime() - story.published.getTime()) / 86400000;
  const candidates = results.flatMap(result => result.status === "fulfilled" ? result.value : [])
    .sort((a, b) => priority(b) - priority(a));
  const seen = new Set<string>(recentTitles);
  const tried = new Map<string, number>();
  const selected = candidates.filter(story => {
    const count = tried.get(story.publisher) ?? 0;
    if (count >= 3 || used.has(story.url) || Array.from(seen).some(title => title === story.title || sameTopic(title, story.title))) return false;
    tried.set(story.publisher, count + 1);
    seen.add(story.title);
    return true;
  });
  const checked = await Promise.allSettled(selected.map(async story => {
    await sourceRequest(story.url, story.hosts, "HEAD");
    return story;
  }));
  const publishers = new Set<string>();
  return checked.flatMap(result => {
    if (result.status !== "fulfilled" || publishers.has(result.value.publisher)) return [];
    publishers.add(result.value.publisher);
    return [result.value];
  }).slice(0, 3);
}

const reference = (story: Story) => `[${story.publisher} · ${story.published.toISOString().slice(0, 10)}](${story.url})`;

function sourceNote(story: Story) {
  const excerpt = story.description.split(/\s+/).slice(0, 16).join(" ");
  return `${story.title.replace(/[\[\]]/g, "")}. ${excerpt ? `The source describes it as “${excerpt.replace(/[\[\]]/g, "").replace(/[.!?]$/, "")}…”. ` : ""}${reference(story)}`;
}

async function recentEditorialSignals(supabase: SupabaseClient, now: Date) {
  const { data, error } = await supabase.from("newsletter_posts").select("subject,insights,send_feedback")
    .like("slug", "interlinked-free-%").eq("status", "published").not("published_at", "is", null)
    .gte("published_at", new Date(now.getTime() - 14 * 86400000).toISOString())
    .order("published_at", { ascending: false }).limit(16);
  if (error) throw new Error("Recent Interlinked source history unavailable");
  const previous = data || [];
  return {
    links: new Set(previous.flatMap(row => Array.isArray(row.insights) ? row.insights : [])
      .flatMap((item: unknown) => typeof item === "string" ? Array.from(item.matchAll(/\]\((https:\/\/[^\s)]+)\)/g), match => match[1]) : [])),
    titles: previous.map(row => String(row.subject || "")),
    practices: new Set(previous.slice(0, 6).flatMap(row =>
      typeof row.send_feedback === "string" && row.send_feedback.startsWith("ais-editorial/v1/")
        ? [row.send_feedback.slice("ais-editorial/v1/".length)] : [])),
  };
}

export async function publishInterlinkedEdition(supabase: SupabaseClient, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const freeSlug = `interlinked-free-${day}`;
  const premiumSlug = `interlinked-premium-${day}`;
  const { data: existing, error: lookupError } = await supabase.from("newsletter_posts").select("slug,status,published_at,subject")
    .in("slug", [freeSlug, premiumSlug]);
  if (lookupError) throw new Error("Today's Interlinked issue lookup failed");
  if (existing?.length === 2 && existing.every(row => row.status === "published" && row.published_at)) {
    return { day, freeSlug, premiumSlug, skipped: true };
  }

  const recent = await recentEditorialSignals(supabase, now);
  const stories = await gatherStories(now, recent.links, recent.titles);
  const lead = stories[0];
  const practice = practiceForSource(lead, recent.practices);
  const lesson = await writePractice(lead, practice);
  const sourceNotes = stories.map(sourceNote);
  const article = {
    intro: lead
      ? lesson.opening
      : `${lesson.opening} Today's issue is a practical field guide. We did not verify a fresh announcement for this brief.`,
    closing: "Interlinked is an AIS Empire publication built from the original Omni Interlinked project.",
    keywords: ["AIS Interlinked", "applied AI", "AI operations"],
    send_feedback: `ais-editorial/v1/${practice.id}`,
    status: "published",
    published_at: now.toISOString(),
  };
  const rows = [
    {
      ...article, slug: freeSlug, tier: "free",
      subject: lead?.title || `${practice.subject} · ${day}`,
      insights: lead ? sourceNotes : [practice.audience + ". " + lesson.steps[0]],
      power_move: practice.move,
    },
    {
      ...article, slug: premiumSlug, tier: "premium",
      subject: lead ? `${practice.subject} · ${lead.title.slice(0, 108)}` : `${practice.subject} · ${day}`,
      insights: [...sourceNotes, practice.audience + ".", ...lesson.steps], power_move: practice.move,
      exclusive_insight: lesson.steps[2],
      ai_recommendation: lesson.steps[0],
    },
  ];
  // A unique slug protects retries. Never rewrite an issue that has already been published or replace someone's editorial draft.
  const missing = rows.filter(row => !existing?.some(current => current.slug === row.slug));
  if (missing.length) {
    const { error } = await supabase.from("newsletter_posts").upsert(missing, { onConflict: "slug", ignoreDuplicates: true });
    if (error) throw new Error("Interlinked issue publication failed");
  }
  const { data: published, error: readError } = await supabase.from("newsletter_posts").select("slug")
    .in("slug", [freeSlug, premiumSlug]).eq("status", "published").not("published_at", "is", null);
  if (readError || published?.length !== 2) throw new Error("The published Interlinked issue pair could not be confirmed");
  return { day, freeSlug, premiumSlug, skipped: false };
}
