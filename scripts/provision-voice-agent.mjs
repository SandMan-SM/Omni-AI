#!/usr/bin/env node
/**
 * Provision the Omni AI inbound voice receptionist on ElevenLabs Conversational AI.
 *
 * Creates the three webhook tools (check_availability, book_consult,
 * capture_lead) pointed at this site's /api/voice/* routes, then creates the
 * agent (Claude LLM, disclosed AI persona, first-message disclosure) wired to
 * those tools. Prints the agent_id + tool_ids. Optionally imports a Twilio
 * number and binds it for inbound.
 *
 * Nothing here is committed with secrets — every credential is read from env.
 *
 * Required env:
 *   ELEVENLABS_API_KEY     your ElevenLabs API key (xi-api-key)
 *   VOICE_AGENT_SECRET     shared bearer secret the tools send to /api/voice/* (must match Vercel)
 * Optional env:
 *   VOICE_BASE_URL         default https://omnileadsagi.com
 *   ELEVENLABS_VOICE_ID    ElevenLabs voice id (default: a professional preset below)
 *   ELEVENLABS_LLM         Claude model id (default claude-haiku-4-5; e.g. claude-sonnet-5)
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / VOICE_PHONE_NUMBER   import + bind the number for inbound
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... VOICE_AGENT_SECRET=... node scripts/provision-voice-agent.mjs
 */

const API = "https://api.elevenlabs.io";
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_AGENT_SECRET = process.env.VOICE_AGENT_SECRET;
const BASE = (process.env.VOICE_BASE_URL || "https://omnileadsagi.com").replace(/\/$/, "");
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "cgSgspJ2msm6clMCkdW9"; // "Jessica" — warm, professional preset
const LLM = process.env.ELEVENLABS_LLM || "claude-haiku-4-5";

if (!KEY) throw new Error("ELEVENLABS_API_KEY is required");
if (!VOICE_AGENT_SECRET) throw new Error("VOICE_AGENT_SECRET is required (must match the value set in Vercel)");

async function api(path, body, method = "POST") {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return json;
}

const authHeader = { Authorization: `Bearer ${VOICE_AGENT_SECRET}` };

const tools = [
  {
    tool_config: {
      type: "webhook",
      name: "check_availability",
      description:
        "Get the next open times for the free 30-minute strategy call. Call this when the caller wants to book. Then offer them the returned options and ask which works.",
      response_timeout_secs: 8,
      api_schema: {
        url: `${BASE}/api/voice/availability`,
        method: "POST",
        request_headers: authHeader,
        request_body_schema: { type: "object", properties: {}, required: [] },
      },
    },
  },
  {
    tool_config: {
      type: "webhook",
      name: "book_consult",
      description:
        "Book the caller's free 30-minute strategy call. Only call this after you have their full name, email, and the exact start_at value from check_availability. Read the email back to confirm it first.",
      response_timeout_secs: 10,
      api_schema: {
        url: `${BASE}/api/voice/book`,
        method: "POST",
        request_headers: authHeader,
        request_body_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Caller's full name" },
            email: { type: "string", description: "Caller's email (required for the calendar invite)" },
            phone: { type: "string", description: "Caller's phone number in E.164 for the recap text" },
            start_at: { type: "string", description: "The EXACT start_at ISO string from check_availability" },
            notes: { type: "string", description: "What they want help with, in one line" },
          },
          required: ["name", "email", "start_at"],
        },
      },
    },
  },
  {
    tool_config: {
      type: "webhook",
      name: "capture_lead",
      description:
        "Save the caller's details when they are interested but not ready to book, or want a callback. Use when they won't pick a time.",
      response_timeout_secs: 8,
      api_schema: {
        url: `${BASE}/api/voice/capture-lead`,
        method: "POST",
        request_headers: authHeader,
        request_body_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Caller's full name" },
            phone: { type: "string", description: "Caller's phone number in E.164" },
            email: { type: "string", description: "Caller's email if given" },
            company: { type: "string", description: "Their business/company name" },
            interest: { type: "string", description: "What they're interested in" },
            notes: { type: "string", description: "Anything else useful for follow-up" },
          },
          required: ["name"],
        },
      },
    },
  },
];

const SYSTEM_PROMPT = `You are Ava, the AI virtual assistant for Omni AI (omnileadsagi.com). You answer the company's phone.

# Identity & disclosure
- You are an AI. If anyone asks, say so plainly. Never claim to be a human, and never claim to be the founder.
- Omni AI's founder is Alfred Belvedere. You are his and the team's AI assistant, not a person on staff.
- There is no live human phone line. If a caller insists on a human, offer to have someone call them back and use capture_lead to take their details.

# What Omni AI is (only state what's here)
- An autonomous AI lead-generation and business-automation platform. Its AI agents generate leads, produce video marketing, run outbound campaigns, and scale operations 24/7 without ongoing supervision.
- Who it's for: solo founders, marketing agencies, and lean teams under about $5M in revenue who don't want to add headcount. The most common customers are local service businesses — HVAC, med spas, roofers, trades, dental and veterinary practices, gyms, and professional services. It's industry-agnostic.
- How it works: agents source contacts, produce personalized outreach and video, qualify responses, and route qualified leads to your CRM or calendar; every action is logged, reviewable, and reversible before you flip it to autopilot.
- Pricing you may quote — and ONLY these: a permanent free tier at $0 (sign up at omnileadsagi.com/join); paid plans are custom, priced to a revenue target rather than per seat, and quoted on the strategy call; the Interlinked premium newsletter is $20 the first month, then $40 a month, cancel anytime. Do not invent or estimate any other prices.
- Results: most operators see first qualified leads within the first week on the free tier, with fuller lift typically inside 30 days — describe this as a mapped plan, not a guarantee.
- Contact/support: alfred@omnileadsagi.com. The company operates online; there are no set business hours.

# Your goal
Be genuinely helpful and low-pressure. The primary action is to book the caller's free 30-minute strategy call — it's 100% free, no pitch, no card, no contract; they leave with a simple 30-day plan. If they're not ready, capture their details so the team can follow up.

# How to book
1. When they want to book, call check_availability and offer the options it returns.
2. Collect their full name and email. Read the email back to confirm it before booking (spell it out if needing to).
3. Get a good mobile number so they get a recap text.
4. Call book_consult with the EXACT start_at from check_availability. Then read back the confirmed day and time and tell them they'll get a text recap.
5. If book_consult says the slot was just taken, apologize briefly and offer another time.

# Guardrails
- Never take credit-card, bank, or payment details by voice. If payment ever comes up, say you'll email or text a secure link and route it to alfred@omnileadsagi.com.
- Don't collect Social Security numbers or other sensitive personal data.
- Keep answers short and natural for a phone call — one question at a time, no jargon, no emojis, no hard sell. Match a calm, plainspoken, operator-to-operator tone.
- Only state facts and prices listed above. If you don't know something, say you'll have the team follow up and capture their details.`;

const FIRST_MESSAGE =
  "Hi, thanks for calling Omni AI — you're speaking with Ava, their AI virtual assistant. Quick note: this call may be recorded for quality and training. How can I help you today?";

async function main() {
  console.log(`Base URL: ${BASE}`);
  console.log(`LLM: ${LLM}  Voice: ${VOICE_ID}\n`);

  const toolIds = [];
  for (const t of tools) {
    const created = await api("/v1/convai/tools", t);
    const id = created.id || created.tool_id || created.tool?.id;
    console.log(`✓ tool ${t.tool_config.name} -> ${id}`);
    toolIds.push(id);
  }

  const agent = await api("/v1/convai/agents/create", {
    name: "Omni AI Receptionist",
    conversation_config: {
      agent: {
        first_message: FIRST_MESSAGE,
        language: "en",
        prompt: {
          prompt: SYSTEM_PROMPT,
          llm: LLM,
          tool_ids: toolIds,
        },
      },
      tts: { voice_id: VOICE_ID },
    },
  });
  const agentId = agent.agent_id || agent.id;
  console.log(`\n✓ agent -> ${agentId}`);

  // Optional: import + bind a Twilio number for inbound.
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const number = process.env.VOICE_PHONE_NUMBER;
  if (sid && token && number) {
    const phone = await api("/v1/convai/phone-numbers", {
      provider: "twilio",
      phone_number: number,
      label: "Omni AI Main Line",
      sid,
      token,
      agent_id: agentId,
    });
    console.log(`✓ phone ${number} imported + bound -> ${phone.phone_number_id || "(ok)"}`);
  } else {
    console.log("\n(Skipped phone import — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, VOICE_PHONE_NUMBER to import + bind a number.)");
  }

  console.log("\nNext:");
  console.log("  1. In ElevenLabs > Agents > (this agent) > confirm the LLM + voice.");
  console.log("  2. Set the workspace Post-call webhook to " + BASE + "/api/voice/postcall, copy its signing secret into VOICE_POSTCALL_WEBHOOK_SECRET in Vercel.");
  console.log("  3. If you didn't import the number here, add it under Agents > Phone Numbers and assign this agent.");
  console.log(`\nagent_id=${agentId}`);
  console.log(`tool_ids=${toolIds.join(",")}`);
}

main().catch((e) => {
  console.error("\nProvisioning failed:", e.message);
  process.exit(1);
});
