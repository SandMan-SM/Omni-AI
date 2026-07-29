import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { OMNI_BUSINESS_ID, splitName } from "@/lib/voice/config";
import { emailOwner, ownerCard } from "@/lib/voice/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 30;

// Inbound SMS handler for the automation line (Twilio webhook).
//
// Twilio POSTs form-encoded params here on every text to the number. We verify
// the signature, capture/So update the sender as a CRM lead, answer with Claude,
// log both directions to omni_sms_sends, and notify the owner. The reply is
// returned as TwiML so Twilio sends it on the same request — no outbound API
// call, and therefore no 10DLC dependency for replies to an inbound message.
//
// Env: TWILIO_AUTH_TOKEN (signature verification), ANTHROPIC_API_KEY.
// Until TWILIO_AUTH_TOKEN is set the route fails closed (403), so it cannot be
// abused before the number is live.

const MAX_REPLY_CHARS = 300;

function twiml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Twilio signs the full request URL + the alphabetically-sorted POST params,
// HMAC-SHA1 under the auth token, base64. See Twilio security docs.
function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  token: string,
): boolean {
  if (!signature) return false;
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!token) {
    console.error("[sms/inbound] TWILIO_AUTH_TOKEN not configured — failing closed");
    return NextResponse.json({ error: "not_configured" }, { status: 403 });
  }

  const raw = await req.text();
  const params: Record<string, string> = {};
  new URLSearchParams(raw).forEach((v, k) => {
    params[k] = v;
  });

  // Twilio signs the public URL it was configured with. Behind Vercel's proxy
  // the incoming URL is already https + the public host, but rebuild it from
  // forwarded headers so a proxy rewrite can't break verification.
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const publicUrl = `https://${host}${new URL(req.url).pathname}`;
  if (!verifyTwilioSignature(publicUrl, params, req.headers.get("x-twilio-signature"), token)) {
    console.error("[sms/inbound] invalid Twilio signature");
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  const from = (params.From || "").trim();
  const body = (params.Body || "").trim();
  const messageSid = params.MessageSid || null;
  if (!from) return twiml();

  // Carrier opt-out keywords are handled by Twilio itself; never reply to them.
  if (/^\s*(stop|stopall|unsubscribe|cancel|end|quit|start|unstop|help)\s*$/i.test(body)) {
    return twiml();
  }

  const supabase = createAdminClient();

  // Log the inbound message.
  try {
    await supabase.from("omni_sms_sends").insert({
      business_id: OMNI_BUSINESS_ID,
      to_phone: from,
      body: `[inbound] ${body}`.slice(0, 1000),
      status: "received",
      twilio_sid: messageSid,
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[sms/inbound] inbound log failed:", e);
  }

  // Find or create the lead so every texter lands in the CRM + Mythos.
  let leadId: string | null = null;
  let isNewLead = false;
  try {
    const { data: existing } = await supabase
      .from("omni_leads_generated")
      .select("id")
      .eq("business_id", OMNI_BUSINESS_ID)
      .eq("phone", from)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      leadId = existing.id;
    } else {
      const { first_name, last_name } = splitName("SMS Contact");
      const { data: created } = await supabase
        .from("omni_leads_generated")
        .insert({
          business_id: OMNI_BUSINESS_ID,
          first_name,
          last_name,
          phone: from,
          source: "sms_inbound",
          status: "new",
          notes: body.slice(0, 500),
          tags: ["sms", "inbound"],
          raw_data: { channel: "sms", first_message: body.slice(0, 500) },
        })
        .select("id")
        .single();
      leadId = created?.id ?? null;
      isNewLead = true;
    }
  } catch (e) {
    console.error("[sms/inbound] lead upsert failed:", e);
  }

  // Compose the reply. Claude keeps it short, human, and useful; a static
  // fallback covers any model/config failure so the texter always hears back.
  let reply =
    "Thanks for reaching out to Omni AI. Someone will get back to you shortly. You can also book a free 30-minute call at omnileadsagi.com/book-now.";
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const resp = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: [
          "You are the SMS assistant for Omni AI, an autonomous AI lead-generation and business-automation platform (omnileadsagi.com).",
          "You are replying by text message. Keep it under 300 characters, warm and plainspoken, no emojis, no marketing fluff.",
          "You are an AI assistant — if asked, say so plainly. Never claim to be a person.",
          "The goal is to answer the question and, when it fits naturally, invite them to book the free 30-minute strategy call at omnileadsagi.com/book-now (no pitch, no card).",
          "Only state facts you are sure of: there is a permanent free tier at omnileadsagi.com/join; paid plans are custom and quoted on the call. Do not invent prices, timelines, or claims.",
          "Never request payment details, card numbers, or sensitive personal information over text.",
          "If you cannot help, say a human will follow up shortly.",
        ].join(" "),
        messages: [{ role: "user", content: body.slice(0, 1500) }],
      });
      const text = resp.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join(" ")
        .trim();
      if (text) reply = text.slice(0, MAX_REPLY_CHARS);
    } catch (e) {
      console.error("[sms/inbound] claude reply failed, using fallback:", e);
    }
  }

  // Log the outbound reply (Twilio sends it via the TwiML below).
  try {
    await supabase.from("omni_sms_sends").insert({
      business_id: OMNI_BUSINESS_ID,
      lead_id: leadId,
      to_phone: from,
      body: reply,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[sms/inbound] reply log failed:", e);
  }

  // Owner notification — awaited but timeout-bounded inside emailOwner, and
  // Next 14 here has no after(), so a floating promise would be frozen.
  await emailOwner({
    subject: `${isNewLead ? "New" : ""} text from ${from}`.trim(),
    html: ownerCard(
      "SMS line",
      isNewLead ? "New contact texted in" : "Reply from an existing contact",
      [
        ["From", from],
        ["Message", body.slice(0, 300) || "—"],
        ["Auto-reply", reply],
      ],
      "Answered automatically by the SMS assistant. Reply from the Twilio console or the dashboard to take over.",
    ),
  });

  return twiml(reply);
}
