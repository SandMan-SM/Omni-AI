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
const EMAIL_IN_TEXT = /[^\s@,;:<>()[\]]+@[^\s@,;:<>()[\]]+\.[a-z]{2,}/i;
const PHONE_IN_TEXT = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

const ASKED_NAME = /who am i speaking with|who am i talking to|what'?s your name|who'?s this|who is this/i;

// Words that arrive where a name is expected but plainly aren't one.
const NOT_A_NAME =
  /^(yes|yeah|no|nope|ok|okay|sure|thanks|thank you|hi|hey|hello|nothing|nobody|none|na|n\/a|test|testing|help|idk|maybe|who|why|what|stop|bruh|lol)$/i;

/*
 * Name capture for the no-model path.
 *
 * With no provider configured there is no model to return a `capture`, and the
 * widget only scans for emails and phone numbers — so a reader could answer
 * "Who am I speaking with?" every turn and the name was never recorded, which
 * is exactly why the question repeated. Infer it here instead, but only in the
 * one place it is unambiguous: directly after we asked for it.
 */
function inferName(turns: Turn[], lastUser: string): string | undefined {
  const prevAssistant = [...turns].reverse().find((x) => x.role === "assistant")?.content ?? "";
  if (!ASKED_NAME.test(prevAssistant)) return undefined;

  const raw = lastUser.trim().replace(/[.!,]+$/, "");
  // "it's Sita", "I'm Sita", "this is Sita", "my name is Sita" — the log shows
  // readers answering in exactly this form, not with a bare word.
  const led = raw.match(
    /^(?:it'?s|i'?m|im|this is|my name is|name'?s|call me)\s+([a-z][a-z'’-]{1,20}(?:\s+[a-z][a-z'’-]{1,20})?)$/i,
  );
  const candidate = led ? led[1] : raw;
  if (!/^[a-z][a-z'’-]{1,20}(?:\s+[a-z][a-z'’-]{1,20}){0,2}$/i.test(candidate)) return undefined;
  if (NOT_A_NAME.test(candidate)) return undefined;
  return candidate;
}

function fallbackReply(
  text: string,
  known: Record<string, unknown>,
  turn = 1,
  opts: { nameAlreadyAsked?: boolean; justLearnedName?: string; alreadySaid?: string[] } = {},
): string {
  /*
   * Matching is on a NORMALISED string with loose substring tests, not on \b
   * regexes over literal phrases.
   *
   * That change is the whole point of this rewrite. The literal-phrase version
   * failed on ordinary English: the pattern `what do i get` did not match "what
   * do i ACTUALLY get for that", `\$` did not match "5k", and there was simply
   * no branch for "who else is in it", "how long does it take" or "im
   * interested". A live conversation with an interested dental-clinic owner
   * produced four consecutive "I'd rather a person answered that" replies, and
   * the strongest buying signal in the thread — "ok im interested" — was
   * answered with "Understood. I've put that in front of the desk."
   *
   * Punctuation collapses to spaces so word order and filler words stop
   * mattering, and the string is space-padded so a needle can be anchored as
   * " ai " where a bare substring would be too greedy.
   */
  const rawLower = text.toLowerCase();
  const t = ` ${rawLower.replace(/[^a-z0-9$@.'’+-]+/g, " ").replace(/\s+/g, " ").trim()} `;
  const any = (...needles: string[]) => needles.some((n) => t.includes(n));

  const givenEmail = text.match(EMAIL_IN_TEXT)?.[0];
  const givenPhone = text.match(PHONE_IN_TEXT)?.[0];
  const hasEmail =
    Boolean((known as { hasEmail?: boolean }).hasEmail) ||
    Boolean(String((known as { email?: unknown }).email ?? "").trim()) ||
    Boolean(givenEmail);
  const hasName =
    Boolean((known as { hasName?: boolean }).hasName) ||
    Boolean(String((known as { name?: unknown }).name ?? "").trim()) ||
    Boolean(opts.justLearnedName);

  const BEST = "utahmainstreet.com/utahs-best";
  const CALL = "omnileadsagi.com/book-now";

  /** One advancing step per reply, varied, and never asking for what we hold. */
  function move(): string {
    if (!hasEmail) {
      const asks = [
        "What's the best email for you? I'll have a person follow up with specifics rather than a brochure.",
        "Drop your email and I'll send the details plus who's already listed — no sales sequence.",
        "What email should the follow-up go to?",
      ];
      return asks[turn % asks.length];
    }
    if (!hasName && !opts.nameAlreadyAsked) return "Got your email. Who am I speaking with?";
    return `Want me to set up the free 30-minute call? No pitch, no card.`;
  }

  const answer = ((): string => {
    // Contact details handed over — confirm before considering any topic.
    if (givenEmail || givenPhone) {
      const got = givenEmail && givenPhone ? "those details" : givenEmail ? "that address" : "that number";
      if (hasName || opts.nameAlreadyAsked) {
        return `Got ${got} — someone will come back to you directly. Anything you want passed on with it?`;
      }
      return `Got ${got} down, and a real person picks these up. Who am I speaking with?`;
    }

    // They just told us their name.
    if (opts.justLearnedName) {
      const first = opts.justLearnedName.split(/\s+/)[0];
      return `Thanks, ${first.charAt(0).toUpperCase() + first.slice(1)}. ${move()}`;
    }

    /*
     * BUYING SIGNAL — checked before every topic intent.
     *
     * "ok im interested" and "whats next" are the highest-value things anyone
     * types into this widget and both previously fell to the generic
     * acknowledgement. When someone says yes, the only correct reply is the
     * actual next step.
     */
    if (
      any(
        "interested", "sign me up", "sign up", "lets do it", "let's do it", " im in ", " i'm in ",
        "count me in", "ready to", "how do i start", "how do i sign", "where do i sign",
        "whats next", "what's next", "next step", "lets go", "do it",
      )
    ) {
      if (hasEmail) {
        return `Good. Next step is a short call to confirm fit and get the listing built — ${CALL}. Book a slot that suits you and a person takes it from there.`;
      }
      return `Good. Next step is a short call to confirm fit and build the listing — ${CALL}. Or leave your email here and a person will set it up with you.`;
    }

    // Greeting with no real question in it.
    if (any(" hi ", " hey ", " hello ", " yo ", " sup ", "good morning", "good afternoon", "good evening") && t.length < 32) {
      return `This is the Utah Main Street desk — we cover real Utah operators, and we run the Utah's Best Network directory. What are you working on?`;
    }

    /*
     * WHO ELSE IS IN IT. Never name members: the list is public and inventing
     * one would be the worst possible failure for a newsroom's credibility.
     */
    if (any("who else", "who is in", "whos in", "who's in", "member list", "current members", "any members", "examples", "who have you", "whos already", "who's already", "already listed")) {
      return `The current list is public at ${BEST} — I'd rather you judge it yourself than take my word for it. Everyone on it is a Utah operator we've actually vetted. ${move()}`;
    }

    /*
     * HOW LONG. No invented dates — the honest answer is that vetting sets the
     * pace, and a person gives the real timeline.
     */
    if (any("how long", "how soon", "how fast", "timeline", "turnaround", "take to", "when would", "when do i", "how quickly")) {
      return `Vetting is the slow part, and it depends on how quickly we can confirm your receipts — reviews, filings, that sort of thing. I won't invent a date; a person will give you a real one. ${move()}`;
    }

    // VETTING / REQUIREMENTS.
    if (any("vetted", "vetting", "requirement", "qualify", "eligib", "criteria", "how do you check", "who gets in", "turned down", "rejected")) {
      return `We check you're a real, operating Utah business in good standing, against signals anyone can verify — named reviews, filings, hiring, retention. If we can't verify it, we don't list it. That's the only reason the directory is worth being in. ${move()}`;
    }

    /*
     * PRICE OBJECTION. Now catches the amount itself ("why is it 5k") which the
     * old pattern missed entirely. Framing, never a discount.
     */
    if (
      any("expensive", "too much", "pricey", "cheaper", "afford", "budget", "steep", "a lot of money", "worth it", "why is it 5", "why 5", "5k", "5,000", "5000", "$5")
    ) {
      return `Fair question. It's $5,000 a year, or twelve payments through Klarna, and it's cross-listed across all three mastheads rather than one directory nobody reads. If a single member job covers it, it's paid for — that's the arithmetic most operators run. ${move()}`;
    }

    /*
     * WHAT'S INCLUDED. Loose matching so "what do i actually get for that"
     * lands here instead of falling through, which is exactly what it did.
     */
    if (any("what do i get", "what do we get", "what does it include", "included", "get for that", "get for it", "comes with", "come with", "benefits", "perks", "in it for", "what am i paying", "what i pay for")) {
      return `A vetted listing cross-published across Utah Main Street, Beehive Biz Pulse and The Wasatch Post, your own reputation page at /operators, and consideration for a full spotlight when there's a real story to tell. ${move()}`;
    }

    // WHAT SERVICES DO YOU PROVIDE — asked twice in the live log.
    if (any("service", "what do you offer", "what do you provide", "what do you sell", "what do you have", "offering", "package", " options")) {
      return `Three things. The Network is a vetted directory — $5,000 a year, cross-listed across all three of our mastheads. Omni AI, our parent company, builds lead generation and automation for local businesses; the intro call is free. And the daily is a free morning read on Utah operators. Which of those is closest to what you need?`;
    }

    // PRICING.
    if (any("how much", "price", "pricing", "cost", "what's it cost", "whats it cost", "rate", "fee", "per year", "monthly", "payment", "klarna", "finance")) {
      return `$5,000 a year for the Network, or twelve payments through Klarna. Full details at ${BEST}. ${move()}`;
    }

    // MEMBERSHIP / GENERAL NETWORK.
    if (any("network", "utahs best", "utah's best", "directory", "listed", "listing", "member", "feature", "join")) {
      return `Utah's Best Network is our vetted directory — members are cross-listed across all three mastheads. $5,000 a year, or twelve payments through Klarna. Full details at ${BEST}. ${move()}`;
    }

    // PROOF. Point at what is checkable; never invent numbers.
    if (any("results", " roi", "proof", "does it work", "guarantee", "evidence", "case stud", "testimonial", "review", "worked for", "success")) {
      return `We don't publish invented numbers. What you can check: every operator we feature has a public receipt behind it, and the member list is open at ${BEST}. Judge it on that. ${move()}`;
    }

    // WHO ARE YOU.
    if (any("who are you", "what is this", "what do you do", "about you", "whats this", "what's this", "who is this", "are you a bot", "are you real", "is this a bot", "am i talking to a")) {
      return `Utah Main Street is a daily local-business paper out of Salt Lake — real operators, verifiable receipts, no paid placements in the editorial. We also run Utah's Best Network, a vetted directory. I'm the desk assistant, and yes, I'm software. ${move()}`;
    }

    // HOW IT WORKS.
    if (any("how does it work", "how it works", "process", "how do i", "get started", "steps")) {
      return `Straightforward: we confirm you're real and in good standing, build the listing and your /operators page, then cross-publish across the three mastheads. Vetting is the slow part and it's the point. ${move()}`;
    }

    // COVERAGE AREA.
    if (
      any("cover", "serve", "based", "area", "region", "statewide", "county", "only in") &&
      any("ogden", "provo", "logan", "st george", "park city", "lehi", "orem", "sandy", "draper", "utah county", "davis", "weber", "cache", "southern utah", "northern utah", "where", "which city", "which cities", "which towns", "which areas", "outside")
    ) {
      return `All of Utah, not just Salt Lake — three mastheads, and the Network is cross-listed across all of them. If there's a real operator with a real receipt, location isn't the obstacle. ${move()}`;
    }

    // UNCERTAINTY.
    if (any(" i dont know ", " i don't know ", " not sure ", " idk ", " no idea ", " dunno ", " maybe ") && t.length < 30) {
      return `That's fair. Simplest split: do you want more people to trust you when they look you up, or more customers coming in? The first is the Network, the second is Omni AI. If neither, the daily is free and you can just read.`;
    }

    // LOW-INTENT BROWSING.
    if (any("just looking", "just browsing", "just checking", "no thanks", "not now", "not really", "maybe later", "curious", "nothing")) {
      return hasEmail
        ? "No problem — have a look around. The daily lands each morning if you want the short version."
        : "No problem, look around. If you want the short version, the daily is one read each morning and it's free — happy to add you, or not.";
    }

    // TALK TO A HUMAN.
    if (any("call", "phone", "talk to", "speak", "human", "real person", "meeting", "appointment", "contact", "reach you")) {
      return hasEmail
        ? `Easiest is the free 30-minute call — ${CALL}, no pitch and no card. I'll flag your note either way.`
        : `Happy to get a person on it. Free 30-minute call at ${CALL}, or leave your email here and someone reaches out directly.`;
    }

    // OMNI AI / LEAD GEN.
    if (any("lead", "marketing", "customer", " ads ", "advertis", "automat", " ai ", "omni", "grow", "sales", "website", " seo ", "booking", "crm")) {
      return `That's Omni AI, our parent company — lead generation and automation for local businesses. Free 30-minute call, no pitch, at ${CALL}. ${move()}`;
    }

    // EDITORIAL TIP.
    if (any(" tip ", "scoop", "pitch", "reporter", "interview", "story idea", "story about", "got a story", "write about", "cover my", "cover us")) {
      return `Send it through — tips reach a real person at this desk, and we check before we print. What's the story?`;
    }

    // THE DAILY.
    if (any("subscribe", "newsletter", "daily", "email list", "sign me up for the", "unsubscribe")) {
      return hasEmail
        ? "You're on the daily — one short read each morning on real Utah operators."
        : "The daily is one short read each morning on real Utah operators. Free, no paid placements. What's your email?";
    }

    // OPERATOR SELF-IDENTIFICATION.
    const selfId = t.match(
      /\b(?:i(?:'m| am)?\s+(?:own|run|have|manage|operate)(?:\s+a|\s+an|\s+my)?|my)\s+([a-z][a-z' ]{2,28}?)(?:\s+(?:in|on|at|out|here|down)\b|$)/,
    );
    if (selfId || any("i own", "i run", "i operate", "my business", "my shop", "my store", "my company", "my practice", "my clinic")) {
      let trade = selfId?.[1]?.trim();
      if (trade) trade = trade.replace(/\b(hvac|hoa|cpa|it|mma|hr|suv|rv|atv|dj|cbd|ac)\b/g, (m) => m.toUpperCase());
      const vowel = trade ? /^(?:[aeiou]|HVAC|HOA|IT\b|MMA|HR|RV|ATV|SUV)/.test(trade) : false;
      const named =
        trade && trade.length > 2 && !/^(own|run|have|manage|operate)$/i.test(trade)
          ? ` ${vowel ? "An" : "A"} ${trade} is exactly the kind of operator we cover.`
          : "";
      return `Good — that's who this paper is for.${named} Two ways in: the Network gets you vetted and cross-listed across all three mastheads, or Omni AI works on getting you more customers. Which is the actual problem right now?`;
    }

    /*
     * CATCH-ALL. Gives a route, not a shrug.
     *
     * The old version answered any unrecognised question with "I'd rather a
     * person answered it properly than have me guess" and nothing else, which
     * fired four turns in a row on a real prospect. Refusing to guess is right;
     * refusing to guess while offering no path is not.
     */
    const isQuestion = /\?/.test(text) || any(" what ", " how ", " who ", " when ", " where ", " why ", " can ", " do ", " does ", " is ", " are ", " will ", " should ");
    if (isQuestion) {
      return hasEmail
        ? `I won't guess at that one — you'll get a straight answer from a person. Quickest is the free call at ${CALL}, otherwise someone picks it up from your email.`
        : `I won't guess at that one, and you'd rather have it right. Two ways to get it answered today: the free call at ${CALL}, or leave your email and a person replies directly.`;
    }
    const topic = text.trim().replace(/\s+/g, " ").slice(0, 60);
    const acks = [
      `Noted — "${topic}" goes to a real person at this desk.`,
      `That's logged, and a person reads it rather than it being filed away.`,
      `Understood. I've put that in front of the desk.`,
    ];
    return `${acks[turn % acks.length]} ${move()}`;
  })();

  /*
   * NEVER SAY THE SAME THING TWICE.
   *
   * The live simulation produced a verbatim repeat four turns apart. Rules can
   * only ever have one best answer per intent, so the guard has to live here:
   * if this exact reply has already been given in this conversation, say
   * something that acknowledges the loop instead of parroting.
   */
  const said = new Set((opts.alreadySaid ?? []).map((s) => s.trim()));
  if (!said.has(answer.trim())) return answer;
  return hasEmail
    ? `I've already given you my version of that, and repeating it won't help. A person can go deeper — the free call is at ${CALL}.`
    : `I've said my piece on that one. Leave an email and a person will give you the detail rather than me repeating myself.`;
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
  const userTurns = turns.filter((x) => x.role === "user").length;
  // Did we already ask for a name earlier in this conversation? Used both to
  // stop the desk re-asking and to know when a bare reply is a name.
  const nameAlreadyAsked = turns.some((x) => x.role === "assistant" && ASKED_NAME.test(x.content));
  const inferredName = inferName(turns, lastUser);
  // Everything the desk has already said this conversation, so it can refuse to repeat itself.
  const priorAssistant = turns.filter((x) => x.role === "assistant").map((x) => x.content);

  // No provider configured at all -> straight to the rule-based desk.
  const hasProvider = Boolean(
    process.env.HERMES_PROXY_URL ||
      process.env.GEMINI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY,
  );
  if (!hasProvider) {
    return NextResponse.json({
        reply: fallbackReply(lastUser, known, userTurns, { nameAlreadyAsked, justLearnedName: inferredName, alreadySaid: priorAssistant }),
        capture: inferredName ? { name: inferredName } : undefined,
        degraded: true,
      }, { status: 200, headers });
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
    return NextResponse.json({
        reply: fallbackReply(lastUser, known, userTurns, { nameAlreadyAsked, justLearnedName: inferredName, alreadySaid: priorAssistant }),
        capture: inferredName ? { name: inferredName } : undefined,
        degraded: true,
      }, { status: 200, headers });
  }
}
