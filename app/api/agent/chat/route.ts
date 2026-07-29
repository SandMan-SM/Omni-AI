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

export async function POST(req: NextRequest) {
  const headers = cors(req.headers.get("origin"));

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { reply: "The desk is offline for a moment — leave your email and a person will follow up." },
      { status: 200, headers },
    );
  }

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
  const context = [
    `Page they're reading: ${String(body.pageUrl || "utahmainstreet.com").slice(0, 200)}`,
    `Already known about them: ${JSON.stringify(known)}`,
    "Do not ask again for anything already known.",
  ].join("\n");

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `${SYSTEM}\n\n# This conversation\n${context}`,
      messages: turns,
    });

    const raw = resp.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();

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
    console.error("[agent/chat] model call failed:", e);
    return NextResponse.json(
      { reply: "That one didn't reach me — mind trying again? Or leave an email and a person will pick it up." },
      { status: 200, headers },
    );
  }
}
