// Hot-lead scanner — finds every omni_leads_generated row with score >= 80
// that hasn't been alerted yet, fires a Telegram alert per lead, and logs
// the alert so we don't double-fire.
//
// Triggered by:
//   - the AI re-score endpoint (after a score bumps a lead into hot)
//   - the daily Claude Code scheduled task (catches anything not via re-score)
//   - manual call from the dashboard

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyHotLead } from "@/lib/agi/telegram";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface HotLead {
  id: string;
  business_id: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  score: number;
  status: string;
  ai_score_reasoning: string | null;
}

async function run(): Promise<NextResponse> {
  // Find leads scoring >= 80 that aren't already in the alert log
  const { data: candidates, error } = await sb
    .from("omni_leads_generated")
    .select("id, business_id, first_name, last_name, company, email, score, status, ai_score_reasoning")
    .gte("score", 80)
    .neq("status", "lost")
    .returns<HotLead[]>();

  if (error) {
    console.error("[hot-lead-alerts] fetch failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, alerted: 0 });
  }

  const { data: existing } = await sb
    .from("omni_hot_lead_alerts")
    .select("lead_id")
    .in("lead_id", candidates.map(c => c.id));
  const alreadyAlerted = new Set((existing ?? []).map(r => r.lead_id));

  const fresh = candidates.filter(c => !alreadyAlerted.has(c.id));
  if (fresh.length === 0) {
    return NextResponse.json({ ok: true, scanned: candidates.length, alerted: 0 });
  }

  const telegramReady = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  let alerted = 0;
  let alertedDetails: { id: string; name: string; score: number }[] = [];

  for (const c of fresh) {
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unknown";
    const reason = c.ai_score_reasoning ?? `Score ${c.score} · ${c.status}`;

    if (telegramReady) {
      const r = await notifyHotLead({
        leadName: fullName,
        company: c.company,
        score: c.score,
        reason: reason.slice(0, 300),
      });
      if (!r.ok) console.error("[hot-lead-alerts] telegram failed:", r.error);
    }

    const { error: insErr } = await sb.from("omni_hot_lead_alerts").insert({
      lead_id: c.id,
      business_id: c.business_id,
      score_at_alert: c.score,
      alert_method: telegramReady ? "telegram" : "logged",
    });
    if (insErr) {
      console.error("[hot-lead-alerts] log insert failed:", insErr);
      continue;
    }

    alerted++;
    alertedDetails.push({ id: c.id, name: fullName, score: c.score });
  }

  return NextResponse.json({
    ok: true,
    telegram_configured: telegramReady,
    scanned: candidates.length,
    already_alerted: alreadyAlerted.size,
    alerted,
    fresh_alerts: alertedDetails,
  });
}

export const GET = run;
export const POST = run;
