// Strategic insights generator — Claude reviews per-business advancement
// + recent activity and produces 3-5 tactical recommendations the owner
// should act on this week. Fires from a daily Claude Code task or
// manually from the dashboard.
//
// Output: structured JSON of recommendations (priority, business, action,
// rationale) + a Markdown Telegram-friendly digest.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { sendTelegram } from "@/lib/agi/telegram";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

interface Recommendation {
  priority: "high" | "medium" | "low";
  business: string;
  action: string;
  rationale: string;
}

async function run(): Promise<NextResponse> {
  // Pull cross-business state
  const [{ data: businesses }, { data: hotLeads }, { data: stuckLeads }, { data: recentMeetings }] = await Promise.all([
    sb.from("omni_business_advancement").select("*"),
    sb.from("omni_leads_generated")
      .select("first_name, last_name, company, score, status, business_id")
      .gte("score", 70)
      .neq("status", "converted")
      .neq("status", "lost")
      .limit(20),
    sb.from("omni_leads_generated")
      .select("first_name, last_name, company, status, updated_at, business_id")
      .not("status", "in", "(converted,lost)")
      .lte("updated_at", new Date(Date.now() - 14 * 86_400_000).toISOString())
      .limit(20),
    sb.from("omni_meeting_bookings")
      .select("attendee_name, status, start_at, business_id")
      .gte("start_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
      .limit(20),
  ]);

  if (!anthropic) {
    return NextResponse.json({
      ok: false,
      reason: "ANTHROPIC_API_KEY not set",
      preview: "Strategic insights require Claude API access",
    });
  }

  // Resolve business names
  const bizMap = new Map((businesses ?? []).map(b => [b.business_id, b.business_name]));
  const enrich = (rows: { business_id: string }[] | null) => (rows ?? []).map(r => ({
    ...r,
    business_name: bizMap.get(r.business_id) ?? "Unknown",
  }));

  // Build the context blob for Claude
  const context = {
    today: new Date().toISOString().slice(0, 10),
    businesses: (businesses ?? []).map(b => ({
      name: b.business_name, plan: b.plan,
      leads_total: b.leads_total, leads_open: b.leads_open, leads_converted: b.leads_converted,
      leads_added_7d: b.leads_added_7d, leads_added_30d: b.leads_added_30d,
      avg_score: b.avg_lead_score, avg_days_to_convert: b.avg_days_to_convert,
      stuck_leads: b.stuck_leads, advancement_score: b.advancement_score,
      meetings_upcoming: b.meetings_upcoming, meetings_completed: b.meetings_completed,
      revenue: b.revenue_from_leads,
    })),
    hot_leads_open: enrich(hotLeads).slice(0, 10),
    stuck_leads: enrich(stuckLeads).slice(0, 10),
    recent_meetings: enrich(recentMeetings).slice(0, 10),
  };

  // Ask Claude for tactical recommendations
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `You're the strategic advisor for Omni AI's lead-gen platform. Review this multi-tenant pipeline data and produce 3–5 concrete actions the owner should take this week to grow each business's pipeline. Each action must be specific (name a business + what to do + why).

Return STRICT JSON in this shape:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "business": "<business name>",
      "action": "<one-sentence imperative>",
      "rationale": "<one short paragraph>"
    }
  ],
  "summary": "<2-sentence overview of the week's strategic theme>"
}

DATA:
${JSON.stringify(context, null, 2)}`,
    }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let parsed: { recommendations: Recommendation[]; summary: string } | null = null;
  if (jsonMatch) {
    try { parsed = JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
  }

  if (!parsed) {
    return NextResponse.json({ ok: false, reason: "Claude returned non-JSON", raw: raw.slice(0, 500) });
  }

  // Persist to omni_coach_recommendations so it shows up in the Coach tab
  for (const r of parsed.recommendations ?? []) {
    const biz = (businesses ?? []).find(b => b.business_name === r.business);
    if (!biz) continue;
    await sb.from("omni_coach_recommendations").insert({
      business_id: biz.business_id,
      recommendation_type: r.priority === "high" ? "risk_alert" : "opportunity",
      priority: r.priority,
      recommendation: r.action,
      rationale: r.rationale,
      generated_at: new Date().toISOString(),
    }).then(() => {});
  }

  // Build Telegram digest
  const lines: string[] = [];
  lines.push("🧠 *Strategic Insights*");
  lines.push(`_${parsed.summary}_`);
  lines.push("");
  for (const r of parsed.recommendations ?? []) {
    const flag = r.priority === "high" ? "🚨" : r.priority === "medium" ? "⚠️" : "💡";
    lines.push(`${flag} *${r.business}*`);
    lines.push(`*Action:* ${r.action}`);
    lines.push(`_${r.rationale}_`);
    lines.push("");
  }

  let sent = false;
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const r = await sendTelegram({ text: lines.join("\n"), parse_mode: "Markdown" });
    sent = r.ok;
    if (!r.ok) console.error("[insights] telegram failed:", r.error);
  }

  return NextResponse.json({
    ok: true,
    sent,
    recommendations: parsed.recommendations,
    summary: parsed.summary,
    preview: lines.join("\n"),
  });
}

export const GET = run;
export const POST = run;
