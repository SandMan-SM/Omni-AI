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

/*
 * WHAT THE DESK LAST ASKED.
 *
 * The desk asks plenty of questions but had no idea it had asked them, so an
 * answer to one was just another unmatched message. Live result: it offered the
 * call, the reader said "yes", and it offered the call again. Only the name case
 * was handled, and only because it was special-cased.
 *
 * Classify our own previous message so the reader's reply can be read as the
 * answer it is.
 */
const ASKED_CALL = /free 30-minute call/i;
const ASKED_EMAIL = /(best email|drop your email|what email should|leave (an|your) email|what'?s your email)/i;
const ASKED_FUNNEL = /(free consultation|book\/free-consultation)/i;
const ASKED_PHONE = /(best number|phone number|number to reach|good number|number for you)/i;
const ASKED_FORK = /which (of those|is the actual problem)/i;
const ASKED_STORY = /what'?s the story/i;
const ASKED_PASSON =
  /anything (you want passed on|you'?d like me to pass on|to pass on|you want them to know|else you want)/i;

type LastAsk = "funnel" | "call" | "name" | "email" | "phone" | "fork" | "story" | "passon" | null;

function classifyAsk(prev: string): LastAsk {
  if (!prev) return null;
  if (ASKED_FUNNEL.test(prev)) return "funnel";
  if (ASKED_CALL.test(prev)) return "call";
  if (ASKED_NAME.test(prev)) return "name";
  if (ASKED_EMAIL.test(prev)) return "email";
  if (ASKED_PHONE.test(prev)) return "phone";
  if (ASKED_FORK.test(prev)) return "fork";
  if (ASKED_STORY.test(prev)) return "story";
  if (ASKED_PASSON.test(prev)) return "passon";
  return null;
}

const YES_RE = /^(y|ya|yes+|yeah|yep|yup|sure|ok|okay|kk|please|pls|sounds good|that works|go ahead|do it|lets do it|let'?s do it|absolutely|definitely|for sure|why not)\b/i;
const NO_RE = /^(n|no+|nope|nah|not now|not right now|not yet|later|maybe later|no thanks|no thank you|pass|im good|i'?m good|all good)\b/i;

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
  opts: {
    nameAlreadyAsked?: boolean;
    justLearnedName?: string;
    alreadySaid?: string[];
    lastAsk?: LastAsk;
    yes?: boolean;
    no?: boolean;
    callDeclined?: boolean;
    emailDeclined?: boolean;
    callAccepted?: boolean;
    prevAssistant?: string;
    nameDeclined?: boolean;
    phoneDeclined?: boolean;
    funnelDeclined?: boolean;
  } = {},
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
  const hasPhone =
    Boolean((known as { hasPhone?: boolean }).hasPhone) ||
    Boolean(String((known as { phone?: unknown }).phone ?? "").trim()) ||
    Boolean(givenPhone);
  const hasName =
    Boolean((known as { hasName?: boolean }).hasName) ||
    Boolean(String((known as { name?: unknown }).name ?? "").trim()) ||
    Boolean(opts.justLearnedName);

  const BEST = "utahmainstreet.com/utahs-best";
  const CALL = "omnileadsagi.com/book-now";
  const FUNNEL = "utahmainstreet.com/book/free-consultation/signup";

  /*
   * THE CAPTURE LADDER — name, then email, then phone.
   *
   * Order is the operator's call: name first so the conversation is with a
   * person rather than an address, then email, then phone. Anything already on
   * file is skipped outright, which is the whole point of the signed cookie —
   * being asked twice for something you have already given is the fastest way
   * to look like a form with a chat skin.
   *
   * Each rung is asked at most twice and is abandoned the moment it is refused.
   * A reader who has said no once has told us something; asking a third time
   * does not change their mind, it just costs the rest of the conversation.
   */
  const said = opts.alreadySaid ?? [];
  const countAsks = (re: RegExp) => said.filter((x) => re.test(x)).length;

  function move(): string {
    /*
     * LINK FIRST, THEN COLLECT, THEN LINK AGAIN.
     *
     * The consultation funnel goes out before any detail is requested. Asking a
     * reader for three fields before showing them what they are for is the order
     * that loses people; leading with the offer lets whoever is ready simply go,
     * and only the ones who stay get asked anything.
     *
     * If they don't take it, gather what is missing — and because the signup
     * page prefills from the same signed cookie this chat writes to, everything
     * collected here lands in that form already filled in. Then the link goes
     * out a second time, which is the entire point of having collected it.
     */
    const funnelOffers = countAsks(ASKED_FUNNEL);
    if (funnelOffers === 0) {
      return `Quickest way in is the free consultation — a person looks at what you have already got and tells you the one thing worth changing. Click below. ${FUNNEL}`;
    }

    if (!hasName && !opts.nameDeclined && countAsks(ASKED_NAME) < 2) {
      const asks = [
        "Before anything else — who am I speaking with?",
        "Who am I speaking with?",
        "What's your name, so I know who to put on this?",
      ];
      return asks[turn % asks.length];
    }
    if (!hasEmail && !opts.emailDeclined && countAsks(ASKED_EMAIL) < 2) {
      const asks = [
        "What's the best email for you? A person follows up with specifics rather than a brochure.",
        "What's your email? I'll have someone send the detail rather than me guessing at it.",
        "What email should the follow-up go to?",
      ];
      return asks[turn % asks.length];
    }
    if (!hasPhone && !opts.phoneDeclined && countAsks(ASKED_PHONE) < 2) {
      // Give a reason. A phone number is the most expensive thing to ask for,
      // and asking without saying why is what makes it feel like harvesting.
      const asks = [
        "And the best number to reach you on? Only used if a call is quicker than typing.",
        "What's a good number for you? Handy if this is faster said than written.",
      ];
      return asks[turn % asks.length];
    }
    /*
     * Everything has been given or refused. Send the funnel a second time —
     * now with the form prefilled from whatever was just collected.
     */
    if (funnelOffers < 2) {
      return hasName || hasEmail || hasPhone
        ? `That's everything I need. Here's the consultation again — your details are already filled in. ${FUNNEL}`
        : `The consultation is there whenever you want it. ${FUNNEL}`;
    }

    if (countAsks(ASKED_CALL) >= 2 || opts.callDeclined || opts.callAccepted) return "";
    // Named, not "the link" — two destinations exist and a bare "the link"
    // makes the reader guess which one a yes would get them.
    return `There's also a free 30-minute call with Omni AI if that suits better — no pitch, no card. Want the booking link?`;
  }

  const answer = ((): string => {
    // Contact details handed over — confirm before considering any topic.
    if (givenEmail || givenPhone) {
      const got = givenEmail && givenPhone ? "those details" : givenEmail ? "that address" : "that number";
      // Confirm, then ask for whatever is still missing — never re-ask for what
      // the cookie already holds.
      const next = move();
      if (next) return `Got ${got}. ${next}`;
      return `Got ${got} — someone will come back to you directly. Anything you want passed on with it?`;
    }

    // They just told us their name.
    if (opts.justLearnedName) {
      const first = opts.justLearnedName.split(/\s+/)[0];
      return `Thanks, ${first.charAt(0).toUpperCase() + first.slice(1)}. ${move()}`;
    }

    /*
     * ANSWERING THE QUESTION WE JUST ASKED.
     *
     * This is the gap that made the desk feel broken. "yes" carries no keywords,
     * so it matched nothing, fell to the catch-all, and the advancing move
     * re-offered the very thing the reader had just accepted. A reply has to be
     * read in the context of what was asked immediately before it.
     */
    if (opts.lastAsk && (opts.yes || opts.no)) {
      if (opts.lastAsk === "funnel") {
        if (opts.yes) {
          return `It's the card just above — name, email and number, then a person picks it up. ${FUNNEL}`;
        }
        // Declined the funnel. This is exactly when to collect, so the link can
        // go back out later with the form already filled in.
        const next = move();
        return next
          ? `No problem. ${next}`
          : `No problem — it's there if you change your mind.`;
      }
      if (opts.lastAsk === "call") {
        if (opts.yes) {
          return `Click below to pick a slot — any time that suits you, and a person will be on the other end. Anything you want them to know beforehand? ${CALL}`;
        }
        return `No call then, that's fine. Everything's public if you'd rather just read it yourself, linked below. I'm here if something comes up. ${BEST}`;
      }
      if (opts.lastAsk === "email") {
        if (opts.no) {
          return `Fair enough, no email. It's all public — have a look below, and come back if you want a person on it. ${BEST}`;
        }
        return `Go ahead — what's the address?`;
      }
      if (opts.lastAsk === "phone") {
        if (opts.no) {
          const next = move();
          return next ? `No number then, that's fine. ${next}` : `No number then, that's fine — email works just as well.`;
        }
        return `Go ahead — what's the number?`;
      }
      if (opts.lastAsk === "name") {
        // Declined to give a name. Drop it and move down the ladder.
        if (opts.no) {
          const next = move();
          return next ? `That's alright, no name needed. ${next}` : `That's alright — ask me anything you like.`;
        }
      }
      if (opts.lastAsk === "passon") {
        if (opts.no) return `Understood. Someone will pick it up from here.`;
        return `Go ahead — what should they know?`;
      }
    }

    /*
     * A pre-call note. Free text answering "anything you want them to know"
     * previously fell to the catch-all and got the booking link offered a second
     * time, which is absurd when the reader is already booking.
     */
    if (opts.lastAsk === "passon" && !opts.yes && !opts.no) {
      return `Passed on — they'll have that before the call. Anything else, I'm here.`;
      if (opts.lastAsk === "story" || opts.lastAsk === "fork") {
        // A bare yes/no is not an answer to either of these; ask properly.
        return opts.lastAsk === "fork"
          ? `Let me put it more plainly: is the problem that people don't trust you yet, or that there aren't enough of them coming in?`
          : `Send it through whenever — what happened?`;
      }
    }

    /*
     * WHICH OF THE TWO. The fork question was asked and then could not be
     * answered, because "the first one" and "more customers" match no intent.
     */
    if (opts.lastAsk === "fork") {
      if (any("network", "first", "trust", "reputation", "visib", "listed", "credib")) {
        return `The Network then. $5,000 a year or twelve payments through Klarna, cross-listed across all three mastheads, and vetted before you're listed. Full details below. ${move()} ${BEST}`;
      }
      if (any("customer", "second", "leads", "lead", "more people", "phone ringing", "busier", "revenue", "sales", "booking")) {
        // Contains the link already — appending "Want the link?" reads as not
        // having read its own sentence.
        return `That's Omni AI then — lead generation and automation, built for local operators. The intro call is free and there's no card. Worth a look below before you commit to anything. ${CALL}`;
      }
      if (any("both", "everything", "all of it", "either")) {
        return `Both is normal, and practically it's one conversation — the free call covers what Omni AI would do, and the Network listing gets set up alongside it. Book whenever suits you, below. ${CALL}`;
      }
    }

    // Courtesy and sign-offs. "thanks" was getting "That's logged", which is a
    // filing cabinet talking.
    if (any(" thanks ", " thank you ", " thx ", " ta ", " cheers ", " appreciate it ", " got it ", " perfect ", " great ") && t.length < 26) {
      return `Any time. The desk is here whenever you need it.`;
    }
    if (any(" bye ", " goodbye ", " see ya ", " later ", " cya ", " talk soon ") && t.length < 20) {
      return `Take care. It's all below if you want it later. ${BEST}`;
    }

    /*
     * AM I TALKING TO A BOT.
     *
     * Must be answered plainly and must be checked before the talk-to-a-human
     * intent, which matched on the bare word "person" and replied "Happy to get
     * a person on it" — dodging a direct question about what I am. Never claim
     * to be a person; being straight is the entire brand.
     */
    if (
      any(
        "are you a bot", "are you a robot", "are you real", "are you a real", "are you human",
        "are you a person", "are you an ai", "are you ai", "is this a bot", "is this a real person",
        "is this a person", "am i talking to a bot", "am i talking to a real", "am i talking to a person",
        "bot or", "or a bot", "human or", "or a human", "who am i talking to", "is this automated", "is this a robot",
      )
    ) {
      return `I'm software — the desk assistant, not a person. I can answer the basics on the Network and the paper, and anything that needs a human I hand straight to one. ${move()}`;
    }

    /*
     * SUSPICION. The one accusation a newsroom cannot answer with a shrug, and
     * the old catch-all did exactly that. Answer with checkable facts and invite
     * them to verify rather than asking them to trust us.
     */
    if (any("scam", "ripoff", "rip off", "rip-off", "fraud", "fake", "shady", "sketchy", "bullshit", "waste of money", "predatory", "pyramid", "mlm", "too good to be true", "legit")) {
      return `Reasonable thing to be suspicious of, and I'd rather answer it than dodge. Nothing in the editorial is paid for, the member list is public, every operator we feature has a verifiable receipt behind it, and the price is stated plainly — $5,000 a year. Check all of it below before you take my word for any of it. ${BEST}`;
    }

    /*
     * NEGOTIATION. "Can you do it for 2000 instead" previously matched the
     * buying signal and got a cheerful next-step reply that ignored the actual
     * request. Decline plainly and name the flexibility that does exist.
     */
    if (any("discount", "any deals", "deal on", "negotiate", "lower price", "lower the price", "knock off", "best price", "cheaper than", "instead of 5", "for 2000", "for 3000", "for 4000", "for 1000", "meet me at", "come down", "flexible on price", "wiggle room")) {
      return `Straight answer: the price is $5,000 a year and I can't discount it — a vetted list stops meaning anything the moment it's negotiable. The flexibility is in how you pay, twelve payments through Klarna instead of up front. ${move()}`;
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
        "whats next", "what's next", "next step", "lets go",
      )
    ) {
      if (hasEmail) {
        return `Good. Next step is a short call to confirm fit and get the listing built. Click below to book — a person takes it from there. ${CALL}`;
      }
      return `Good. Next step is a short call to confirm fit and build the listing — click below to book it. Or leave your email here and a person will set it up with you. ${CALL}`;
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
      return `The current list is public, linked below — I'd rather you judge it yourself than take my word for it. Everyone on it is a Utah operator we've actually vetted. ${move()} ${BEST}`;
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
      /*
       * Whose price? After the reader picks Omni AI, "how much would that cost"
       * means Omni AI — and answering "$5,000 a year" quotes the Network's fee
       * for a different product, which is a misquote to a live prospect. Omni AI
       * is scoped per business; the honest answer is that there is no list price.
       */
      const aboutOmni =
        /omni ai/i.test(opts.prevAssistant ?? "") && !/\$5,000/.test(opts.prevAssistant ?? "");
      if (aboutOmni) {
        return `Omni AI is scoped per business rather than sold at a list price — working out what it would actually cost you is what the free call is for, and there's no card involved. Separately, the Network is a flat $5,000 a year.`;
      }
      return `$5,000 a year for the Network, or twelve payments through Klarna. Full details below. ${move()} ${BEST}`;
    }

    // MEMBERSHIP / GENERAL NETWORK.
    if (any("network", "utahs best", "utah's best", "directory", "listed", "listing", "member", "feature", "join")) {
      return `Utah's Best Network is our vetted directory — members are cross-listed across all three mastheads. $5,000 a year, or twelve payments through Klarna. Full details below. ${move()} ${BEST}`;
    }

    // PROOF. Point at what is checkable; never invent numbers.
    if (any("results", " roi", "proof", "does it work", "guarantee", "evidence", "case stud", "testimonial", "review", "worked for", "success")) {
      return `We don't publish invented numbers. What you can check: every operator we feature has a public receipt behind it, and the member list is open below. Judge it on that. ${move()} ${BEST}`;
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
        ? `Easiest is the free 30-minute call — no pitch and no card, booking below. I'll flag your note either way. ${CALL}`
        : `Happy to get a person on it. The free 30-minute call is below, or leave your email here and someone reaches out directly. ${CALL}`;
    }

    // OMNI AI / LEAD GEN.
    if (any("lead", "marketing", "customer", " ads ", "advertis", "automat", " ai ", "omni", "grow", "sales", "website", " seo ", "booking", "crm")) {
      return `That's Omni AI, our parent company — lead generation and automation for local businesses. Free 30-minute call, no pitch, below. ${move()} ${CALL}`;
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
      /*
       * Sanity-bound the extraction. On a long or repetitive message the capture
       * ran across clause boundaries and produced "A shop and i own a sh is
       * exactly the kind of operator we cover". A trade is one to three plain
       * words; anything else is better left unnamed than echoed back as nonsense.
       */
      if (trade) {
        const words = trade.split(/\s+/);
        const sane =
          words.length <= 3 &&
          trade.length <= 24 &&
          words.every((w) => /^[a-z'’-]{2,}$/i.test(w)) &&
          !words.some((w) => /^(and|or|the|my|a|an|i|own|owns|run|runs|have|has|manage|operate)$/i.test(w));
        if (!sane) trade = undefined;
      }
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
        ? `I won't guess at that one — you'll get a straight answer from a person. Quickest is the free call below, otherwise someone picks it up from your email. ${CALL}`
        : `I won't guess at that one, and you'd rather have it right. Two ways to get it answered today: the free call below, or leave your email and a person replies directly. ${CALL}`;
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
  // move() returns "" once the email has been asked for twice, so tidy the seam.
  const tidy = answer.replace(/\s{2,}/g, " ").trim();

  const saidExactly = new Set(said.map((x) => x.trim()));
  if (!saidExactly.has(tidy)) return tidy;
  return hasEmail
    ? `I've already given you my version of that, and repeating it won't help. A person can go deeper — the free call is below. ${CALL}`
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
  /*
   * Read the reader's reply against our own previous message, and remember an
   * explicit decline so the desk stops offering something already refused.
   */
  const prevAssistant = [...turns].reverse().find((x) => x.role === "assistant")?.content ?? "";
  const lastAsk = classifyAsk(prevAssistant);
  const saidYes = YES_RE.test(lastUser.trim());
  const saidNo = NO_RE.test(lastUser.trim());
  let callDeclined = false;
  let emailDeclined = false;
  let phoneDeclined = false;
  let nameDeclined = false;
  let funnelDeclined = false;
  // The booking link has already been handed over in this conversation.
  // Detect the handover by the URL itself. Matching a sentence broke the
  // moment that copy was reworded, which silently re-armed the call offer.
  const callAccepted = priorAssistant.some((x) => /book-now/i.test(x));
  for (let i = 1; i < turns.length; i++) {
    const a = turns[i - 1];
    const u = turns[i];
    if (a.role !== "assistant" || u.role !== "user" || !NO_RE.test(u.content.trim())) continue;
    if (ASKED_CALL.test(a.content)) callDeclined = true;
    if (ASKED_EMAIL.test(a.content)) emailDeclined = true;
    if (ASKED_PHONE.test(a.content)) phoneDeclined = true;
    if (ASKED_NAME.test(a.content)) nameDeclined = true;
    if (ASKED_FUNNEL.test(a.content)) funnelDeclined = true;
  }

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
        reply: fallbackReply(lastUser, known, userTurns, {
          nameAlreadyAsked,
          justLearnedName: inferredName,
          alreadySaid: priorAssistant,
          lastAsk,
          yes: saidYes,
          no: saidNo,
          callDeclined,
          emailDeclined,
          callAccepted,
          prevAssistant,
          nameDeclined,
          phoneDeclined,
          funnelDeclined,
        }),
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
        reply: fallbackReply(lastUser, known, userTurns, {
          nameAlreadyAsked,
          justLearnedName: inferredName,
          alreadySaid: priorAssistant,
          lastAsk,
          yes: saidYes,
          no: saidNo,
          callDeclined,
          emailDeclined,
          callAccepted,
          prevAssistant,
          nameDeclined,
          phoneDeclined,
          funnelDeclined,
        }),
        capture: inferredName ? { name: inferredName } : undefined,
        degraded: true,
      }, { status: 200, headers });
  }
}
