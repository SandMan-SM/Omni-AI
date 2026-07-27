import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { getNewsletterFallbackPost } from "@/lib/newsletter-fallback";

export const runtime = "edge";

const size = { width: 1200, height: 630 };
const GENERATED_ARTWORK_EXTENSIONS = ["webp", "png", "jpg", "jpeg"] as const;

type ArtworkPost = {
  subject?: string | null;
  intro?: string | null;
  keywords?: string[] | string | null;
};

type ArtworkTheme = "operations" | "command" | "capital" | "neural" | "growth";

async function getGeneratedArtwork(request: Request, slug: string): Promise<Response | null> {
  const requestUrl = new URL(request.url);
  const encodedSlug = encodeURIComponent(slug);

  for (const extension of GENERATED_ARTWORK_EXTENSIONS) {
    const assetUrl = new URL(`/newsletter/generated/${encodedSlug}.${extension}`, requestUrl.origin);

    try {
      const asset = await fetch(assetUrl, { cache: "force-cache" });
      const contentType = asset.headers.get("content-type") || "";

      if (asset.ok && asset.body && contentType.startsWith("image/")) {
        return new Response(asset.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Newsletter-Artwork": assetUrl.pathname,
          },
        });
      }
    } catch {
      // Try the next supported extension before generating custom artwork.
    }
  }

  return null;
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function getArtworkPost(slug: string): Promise<ArtworkPost | null> {
  const fallback = getNewsletterFallbackPost(slug);
  if (fallback) return fallback;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const supabase = createClient(url, key);
    const result = await withTimeout(
      supabase
        .from("newsletter_posts")
        .select("subject, intro, keywords")
        .eq("slug", slug)
        .maybeSingle(),
      1200
    );
    return (result as { data?: ArtworkPost | null } | null)?.data || null;
  } catch {
    return null;
  }
}

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function classifyTheme(post: ArtworkPost | null, slug: string): ArtworkTheme {
  const keywords = Array.isArray(post?.keywords) ? post?.keywords.join(" ") : String(post?.keywords || "");
  const text = `${post?.subject || ""} ${post?.intro || ""} ${keywords} ${slug}`.toLowerCase();

  if (/clock|manual|operations|workflow|waiting|time|process/.test(text)) return "operations";
  if (/competitor|ceo|boardroom|executive|decision|command/.test(text)) return "command";
  if (/money|capital|funding|invest|market|valuation|revenue/.test(text)) return "capital";
  if (/growth|sales|customer|lead|scale/.test(text)) return "growth";
  return "neural";
}

function themeColors(theme: ArtworkTheme) {
  if (theme === "operations") return { primary: "#22d3ee", secondary: "#a78bfa", accent: "#fbbf24" };
  if (theme === "command") return { primary: "#60a5fa", secondary: "#c084fc", accent: "#fb7185" };
  if (theme === "capital") return { primary: "#fbbf24", secondary: "#22d3ee", accent: "#34d399" };
  if (theme === "growth") return { primary: "#34d399", secondary: "#38bdf8", accent: "#fbbf24" };
  return { primary: "#38bdf8", secondary: "#8b5cf6", accent: "#f59e0b" };
}

function TopicMotif({ theme, hash, colors }: { theme: ArtworkTheme; hash: number; colors: ReturnType<typeof themeColors> }) {
  const offset = hash % 34;

  if (theme === "operations") {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        <div style={{ position: "absolute", left: 690, top: 105, width: 350, height: 350, border: `18px solid ${colors.primary}`, borderRadius: 999, boxShadow: `0 0 70px ${colors.primary}`, opacity: 0.86, display: "flex" }} />
        <div style={{ position: "absolute", left: 848, top: 150, width: 14, height: 140, background: colors.accent, borderRadius: 20, transformOrigin: "7px 130px", transform: `rotate(${offset - 17}deg)`, display: "flex" }} />
        <div style={{ position: "absolute", left: 855, top: 272, width: 118, height: 14, background: "#ffffff", borderRadius: 20, transform: "rotate(22deg)", transformOrigin: "0 7px", display: "flex" }} />
        {[0, 1, 2, 3].map((step) => (
          <div key={step} style={{ position: "absolute", left: 160 + step * 205, top: 470 - step * 34, width: 112, height: 54, border: `3px solid ${step % 2 ? colors.secondary : colors.primary}`, borderRadius: 16, background: "rgba(2,6,23,0.72)", boxShadow: `0 0 24px ${step % 2 ? colors.secondary : colors.primary}`, display: "flex" }} />
        ))}
      </div>
    );
  }

  if (theme === "command") {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {[0, 1, 2].map((person) => (
          <div key={person} style={{ position: "absolute", left: 650 + person * 155, top: 135 + (person === 1 ? -35 : 25), width: 118, height: 118, borderRadius: 999, border: `6px solid ${person === 1 ? colors.accent : colors.primary}`, background: `radial-gradient(circle, ${person === 1 ? colors.accent : colors.primary} 0%, rgba(8,12,35,0.94) 58%)`, boxShadow: `0 0 55px ${person === 1 ? colors.accent : colors.primary}`, display: "flex" }} />
        ))}
        {[0, 1, 2].map((person) => (
          <div key={`body-${person}`} style={{ position: "absolute", left: 605 + person * 155, top: 280 + (person === 1 ? -35 : 25), width: 210, height: 215, border: `4px solid ${person === 1 ? colors.secondary : colors.primary}`, borderRadius: "90px 90px 26px 26px", background: "linear-gradient(180deg, rgba(30,41,90,0.88), rgba(3,7,18,0.96))", display: "flex" }} />
        ))}
        <div style={{ position: "absolute", left: 120, top: 315, width: 430, height: 4, background: `linear-gradient(90deg, transparent, ${colors.secondary}, ${colors.accent})`, boxShadow: `0 0 22px ${colors.secondary}`, display: "flex" }} />
      </div>
    );
  }

  if (theme === "capital") {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {[0, 1, 2, 3, 4].map((bar) => (
          <div key={bar} style={{ position: "absolute", left: 590 + bar * 105, bottom: 84, width: 66, height: 92 + bar * 65 + ((hash >> bar) % 24), borderRadius: "14px 14px 0 0", background: `linear-gradient(180deg, ${bar % 2 ? colors.primary : colors.accent}, rgba(8,12,30,0.9))`, boxShadow: `0 0 36px ${bar % 2 ? colors.primary : colors.accent}`, display: "flex" }} />
        ))}
        <div style={{ position: "absolute", left: 550, top: 160, width: 520, height: 10, background: `linear-gradient(90deg, ${colors.secondary}, ${colors.primary}, ${colors.accent})`, transform: "rotate(-24deg)", transformOrigin: "left center", boxShadow: `0 0 28px ${colors.primary}`, display: "flex" }} />
        <div style={{ position: "absolute", right: 112, top: 62, width: 0, height: 0, borderTop: "30px solid transparent", borderBottom: "30px solid transparent", borderLeft: `62px solid ${colors.accent}`, transform: "rotate(-24deg)", display: "flex" }} />
      </div>
    );
  }

  const nodes = Array.from({ length: 12 }, (_, index) => ({
    x: 565 + ((hash >> (index % 20)) + index * 137) % 520,
    y: 90 + ((hash >> ((index + 7) % 20)) + index * 89) % 440,
  }));

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      {nodes.slice(1).map((node, index) => (
        <div key={`line-${index}`} style={{ position: "absolute", left: nodes[index].x, top: nodes[index].y, width: Math.max(40, Math.abs(node.x - nodes[index].x)), height: 3, background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})`, opacity: 0.52, transform: `rotate(${Math.atan2(node.y - nodes[index].y, node.x - nodes[index].x) * 57.2958}deg)`, transformOrigin: "left center", display: "flex" }} />
      ))}
      {nodes.map((node, index) => (
        <div key={`node-${index}`} style={{ position: "absolute", left: node.x, top: node.y, width: 24 + (index % 3) * 8, height: 24 + (index % 3) * 8, borderRadius: 999, background: index % 2 ? colors.primary : colors.secondary, border: "4px solid rgba(255,255,255,0.72)", boxShadow: `0 0 30px ${index % 2 ? colors.primary : colors.secondary}`, display: "flex" }} />
      ))}
    </div>
  );
}

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  const generatedArtwork = await getGeneratedArtwork(request, slug);
  if (generatedArtwork) return generatedArtwork;

  const post = await getArtworkPost(slug);
  const seedText = `${slug}|${post?.subject || ""}|${Array.isArray(post?.keywords) ? post?.keywords.join(",") : post?.keywords || ""}`;
  const hash = hashText(seedText);
  const theme = classifyTheme(post, slug);
  const colors = themeColors(theme);
  const glowX = 52 + (hash % 34);
  const glowY = 28 + ((hash >>> 8) % 46);

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #02030a 0%, #0b1028 45%, #190a2f 100%)" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${colors.secondary}99 0%, transparent 32%), radial-gradient(circle at 82% 72%, ${colors.primary}80 0%, transparent 34%), radial-gradient(circle at 22% 82%, ${colors.accent}55 0%, transparent 28%)`, display: "flex" }} />
      <TopicMotif theme={theme} hash={hash} colors={colors} />
      <div style={{ position: "absolute", inset: 28, border: `2px solid ${colors.accent}55`, borderRadius: 34, boxShadow: `inset 0 0 50px ${colors.primary}22`, display: "flex" }} />
      <div style={{ position: "absolute", left: 54, top: 52, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 16, height: 16, borderRadius: 999, background: colors.accent, display: "flex" }} />
        <div style={{ width: 310, height: 4, borderRadius: 99, background: `linear-gradient(90deg, ${colors.accent}, ${colors.primary}, transparent)`, display: "flex" }} />
      </div>
      <div style={{ position: "absolute", left: 54, bottom: 50, width: 430, height: 5, borderRadius: 99, background: `linear-gradient(90deg, ${colors.accent}, ${colors.primary}, ${colors.secondary})`, boxShadow: `0 0 22px ${colors.primary}`, display: "flex" }} />
    </div>,
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Newsletter-Artwork": `generated:${theme}`,
      },
    }
  );
}
