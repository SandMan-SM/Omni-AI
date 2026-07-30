import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 30;

/*
 * Agentic sales desk — the brain behind the newsroom chat widgets.
 *
 * Lives here rather than on the tenant sites because this project holds
 * ANTHROPIC_API_KEY; the mastheads have no model access of their own and
 * shouldn't need a second copy of the credential.
 *
 * It genuinely converses: qualifies the visitor, answers real questions, sells
 * the actual products, and pulls contact details out of natural language
 * instead of marching anyone through a form. The caller stays dumb — it just
 * relays turns and applies whatever `capture` comes back.
 *
 * Latency is a product requirement here (the widget must feel instant), so this
 * runs on the fast model and caps history rather than sending a growing
 * transcript on every turn.
 */

const ALLOWED_ORIGINS = new Set([
  "https://utahmainstreet.com",
  "https://www.utahmainstreet.com",
  "http://localhost:3000",
]);

const MAX_TURNS = 16;
const MAX_CHARS = 1200;

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://utahmainstreet.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

const SYSTEM = `You are the desk at Utah Main Street — a daily local-business newsroom covering real Utah operators (utahmainstreet.com). You talk with readers in a chat widget on the site.

# Who you are
- You are an AI assistant working the desk. If anyone asks whether you're a bot, say so plainly and without fuss. Never claim to be a person and never invent a reporter's name.
- Voice: measured, neighborly, weekend-paper. Plain sentences. Say "operators", never "founders". No SaaS jargon, no hype, no emojis, no exclamation marks. Write the way a good local editor talks.
- Keep replies SHORT — one or two sentences, occasionally three. This is a chat, not an article.

# Who you're talking to
Most readers are Utah small-business operators, or locals who follow them. Work out which quickly, without interrogating. Ask ONE question at a time, and only when it follows naturally.

# What you actually offer, in order of value
1. UTAH'S BEST NETWORK — a vetted membership directory of Utah businesses, cross-listed across our three mastheads (Utah Main Street, Beehive Biz Pulse, The Wasatch Post). $5,000 per year. Payable in full, or financed over 12 months through Klarna. Members are vetted, not just listed — that's the whole point of it. Details at utahmainstreet.com/utahs-best. Best fit: an established Utah operator who wants reputation and reach.
2. OMNI AI — our parent company. AI systems that generate leads and automate operations for local businesses. There's a free 30-minute strategy call, no pitch and no card, at omnileadsagi.com/book-now. Best fit: an operator who wants more customers rather than more visibility.
3. THE DAILY — one short read each morning on real Utah operators. Free, no paid placements. Best fit: everyone else, and a fine outcome on its own.

# How to sell
- Earn the pitch. Answer what they asked first; be useful before you offer anything.
- Recommend ONE thing, the one that actually fits what they told you. Never list all three like a menu.
- Lead with the concrete fact, not adjectives. "$5,000 a year, or twelve payments through Klarna" beats "affordable premium membership".
- If they're a fit for the Network or a call, say so directly and ask for the one detail you need to move it forward — usually an email.
- If they're not a fit, say that too and offer the daily instead. Being straight is the whole brand.
- Never invent members, prices, results, timelines, or claims about anyone. If you don't know, say you'll have someone follow up.
- Never pressure, never manufacture urgency or scarcity, never imply a deadline that doesn't exist. This is a newsroom; credibility is the product.

# Capturing details
When someone gives a name, email, or phone number anywhere in conversation, capture it — you do not need to ask for fields in order. Ask for an email only once you've given them a reason to want one. Never ask for a phone number unless they've already agreed to something that needs a call. Never ask for payment details.

# Output format
Reply with ONLY a JSON object, no markdown fence:
{"reply": "<your message>", "capture": {"name": "...", "email": "...", "phone": "...", "interest": "network|omni|daily|tip|question"}}
Include in "capture" only the fields you actually learned this turn; omit it entirely if you learned nothing new. "interest" is your read of what they want.`;

type Turn = { role: "user" | "assistant"; content: string };

/*
 * PROVIDER LADDER — first configured key wins.
 *
 * Deliberately provider-agnostic so the cheapest working option can be used
 * without touching the masthead. Gemini and Groq both have free tiers that
 * comfortably cover a local newsroom's chat volume, which is why they sit at
 * the top: the goal is a real agent at zero marginal cost. Anthropic stays in
 * the ladder but last, since its key is metered and currently out of credit.
 *
 * Groq and OpenAI share the OpenAI chat-completions shape, so they share a
 * caller. Gemini needs its own request/response mapping.
 */
async function callGemini(system: string, turns: Turn[], key: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({
          role: t.role === "assistant" ? "model" : "user",
          parts: [{ text: t.content }],
        })),
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text || "").join("").trim();
}

async function callOpenAiCompatible(
  system: string,
  turns: Turn[],
  key: string,
  baseUrl: string,
  model: string,
): Promise<string> {
  // Bounded so an unreachable or sleeping upstream (see HERMES_PROXY_URL) can
  // never hold the visitor's request open — we would rather drop to the desk.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.AGENT_TIMEOUT_MS || 9000));
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [{ role: "system", content: system }, ...turns],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${baseUrl} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content || "").trim();
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(system: string, turns: Turn[], key: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: key });
  const resp = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system,
    messages: turns,
  });
  return resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();
}

/**
 * Whichever provider is configured, in ascending order of cost.
 *
 * HERMES_PROXY_URL comes first on purpose. `hermes proxy start` runs a local
 * OpenAI-compatible server that attaches the operator's OAuth subscription
 * credentials upstream, so this path costs nothing per message and needs no
 * metered API key — the explicitly requested arrangement. Point
 * HERMES_PROXY_URL at the proxy's public origin (it binds 127.0.0.1 by
 * default, so it needs a tunnel to be reachable from Vercel) and set
 * HERMES_PROXY_TOKEN to any non-empty string: the proxy accepts any bearer
 * token and substitutes the real credentials itself.
 *
 * Because that origin is a laptop rather than managed infrastructure, a short
 * timeout is applied and any failure falls through to the next provider and
 * ultimately to the rule-based desk, so the widget never hangs on a sleeping
 * machine.
 */
async function generate(system: string, turns: Turn[]): Promise<{ text: string; provider: string }> {
  if (process.env.HERMES_PROXY_URL) {
    return {
      text: await callOpenAiCompatible(
        system, turns,
        process.env.HERMES_PROXY_TOKEN || "hermes",
        process.env.HERMES_PROXY_URL.replace(/\/+$/, ""),
        process.env.HERMES_PROXY_MODEL || "gpt-5.6-sol",
      ),
      provider: "hermes",
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return { text: await callGemini(system, turns, process.env.GEMINI_API_KEY), provider: "gemini" };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      text: await callOpenAiCompatible(
        system, turns, process.env.GROQ_API_KEY,
        "https://api.groq.com/openai/v1",
        process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      ),
      provider: "groq",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      text: await callOpenAiCompatible(
        system, turns, process.env.OPENAI_API_KEY,
        "https://api.openai.com/v1",
        process.env.OPENAI_MODEL || "gpt-4o-mini",
      ),
      provider: "openai",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { text: await callAnthropic(system, turns, process.env.ANTHROPIC_API_KEY), provider: "anthropic" };
  }
  throw new Error("no provider configured");
}

/*
 * Fallback desk, used whenever the model is unavailable — no API key, no
 * credit balance, an outage, anything. It is deliberately rule-based and
 * dependency-free so the widget stays USEFUL rather than apologetic: it still
 * routes people to the right product and still collects an email, which is the
 * part that actually earns money. The agent upgrades this automatically the
 * moment the model can be reached again; no redeploy of the masthead needed.
 */
function fallbackReply(text: string, known: Record<string, unknown>): string {
  const t = text.toLowerCase();
  const hasEmail = Boolean((known as { hasEmail?: boolean }).hasEmail);
  const close = hasEmail
    ? "I've got your email, so someone will come back to you there."
    : "Leave your email here and a person will come back to you.";

  if (/\b(network|utah'?s best|member|directory|listed|feature|featured|join)\b/.test(t)) {
    return `Utah's Best Network is our vetted directory — members are cross-listed across all three mastheads. It's $5,000 a year, or twelve payments through Klarna. Details at utahmainstreet.com/utahs-best. ${close}`;
  }
  if (/\b(lead|leads|marketing|customers|ads|advertis|automat|ai|omni|grow|sales)\b/.test(t)) {
    return `That's Omni AI, our parent company — they build lead generation and automation for local businesses. There's a free 30-minute call, no pitch, at omnileadsagi.com/book-now. ${close}`;
  }
  if (/\b(tip|story|scoop|cover|pitch|reporter|news|write)\b/.test(t)) {
    return `Send it through — tips reach a real person here. ${close}`;
  }
  if (/\b(subscribe|newsletter|daily|email list|sign ?up)\b/.test(t)) {
    return hasEmail
      ? "You're already on the daily — one short read each morning on real Utah operators."
      : "The daily is one short read each morning on real Utah operators. Free, no paid placements. What's your email?";
  }
  return `Got it — that's with the desk, and a real person reads these. ${close}`;
}

export async function POST(req: NextRequest) {
  const headers = cors(req.headers.get("origin"));

  let body: { messages?: Array<{ role?: string; content?: string }>; known?: Record<string, unknown>; pageUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ reply: "Sorry — say that again?" }, { status: 200, headers });
  }

  const turns = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content).slice(0, MAX_CHARS),
    }));

  if (turns.length === 0) {
    return NextResponse.json({ reply: "What can the desk help with?" }, { status: 200, headers });
  }
  // The model must always be answering a user turn.
  if (turns[turns.length - 1].role !== "user") {
    return NextResponse.json({ reply: "Go ahead — what do you need?" }, { status: 200, headers });
  }

  const known = body.known && typeof body.known === "object" ? body.known : {};
  const lastUser = turns[turns.length - 1].content;

  // No provider configured at all -> straight to the rule-based desk.
  const hasProvider = Boolean(
    process.env.HERMES_PROXY_URL ||
      process.env.GEMINI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY,
  );
  if (!hasProvider) {
    return NextResponse.json({ reply: fallbackReply(lastUser, known), degraded: true }, { status: 200, headers });
  }
  const context = [
    `Page they're reading: ${String(body.pageUrl || "utahmainstreet.com").slice(0, 200)}`,
    `Already known about them: ${JSON.stringify(known)}`,
    "Do not ask again for anything already known.",
  ].join("\n");

  try {
    const { text: raw } = await generate(`${SYSTEM}\n\n# This conversation\n${context}`, turns);
    if (!raw) throw new Error("empty completion");

    // The model is told to return bare JSON; tolerate a stray fence anyway, and
    // fall back to treating the whole thing as prose rather than showing an error.
    let reply = raw;
    let capture: Record<string, string> | undefined;
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      try {
        const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
          reply?: string;
          capture?: Record<string, string>;
        };
        if (parsed.reply) reply = parsed.reply;
        if (parsed.capture && typeof parsed.capture === "object") capture = parsed.capture;
      } catch {
        // leave `reply` as the raw text
      }
    }

    return NextResponse.json({ reply: reply.slice(0, 700), capture }, { status: 200, headers });
  } catch (e) {
    // Most common real cause here is an exhausted Anthropic credit balance,
    // which returns invalid_request_error. Whatever the reason, the visitor
    // must still get a useful answer rather than an apology.
    console.error("[agent/chat] model call failed, serving fallback desk:", e);
    return NextResponse.json({ reply: fallbackReply(lastUser, known), degraded: true }, { status: 200, headers });
  }
}
