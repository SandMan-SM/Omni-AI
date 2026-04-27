// Weekly KPI digest — sent every Monday morning to sitanim8@gmail.com.
// Aggregates the past 7 days of activity across every business with a
// Markdown-y HTML email. Triggered by a Claude Code scheduled task on
// Mondays at 7am local.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const TO_EMAIL = "sitanim8@gmail.com";
const FROM_EMAIL = "Omni AI <reports@omnileadsagi.com>";

interface Snapshot {
  business_id: string;
  snapshot_date: string;
  leads_total: number;
  leads_converted: number;
  meetings_upcoming: number;
  advancement_score: number;
  revenue_from_leads: number;
}

async function run(): Promise<NextResponse> {
  // 1. Capture today's snapshot first so the comparison baseline is fresh
  await sb.rpc("omni_ai_capture_advancement_snapshots");

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  // 2. Pull current state + 7-day-old snapshot for every business
  const { data: current } = await sb
    .from("omni_business_advancement")
    .select("*")
    .order("advancement_score", { ascending: false });

  if (!current || current.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "no businesses" });
  }

  const ids = current.map(c => c.business_id);
  const { data: oldSnaps } = await sb
    .from("omni_business_advancement_snapshots")
    .select("*")
    .in("business_id", ids)
    .eq("snapshot_date", weekAgo)
    .returns<Snapshot[]>();
  const oldMap = new Map((oldSnaps ?? []).map(s => [s.business_id, s]));

  // 3. Cross-business totals
  const totals = current.reduce((acc, c) => ({
    leads_added_7d:    acc.leads_added_7d + (c.leads_added_7d ?? 0),
    leads_converted:   acc.leads_converted + (c.leads_converted ?? 0),
    meetings_upcoming: acc.meetings_upcoming + (c.meetings_upcoming ?? 0),
    revenue_from_leads: acc.revenue_from_leads + Number(c.revenue_from_leads ?? 0),
    stuck_leads:       acc.stuck_leads + (c.stuck_leads ?? 0),
  }), { leads_added_7d: 0, leads_converted: 0, meetings_upcoming: 0, revenue_from_leads: 0, stuck_leads: 0 });

  // 4. Top 3 movers + any new businesses
  const movers = current
    .map(c => {
      const old = oldMap.get(c.business_id);
      return {
        ...c,
        score_delta: old ? c.advancement_score - old.advancement_score : c.advancement_score,
        leads_delta: old ? c.leads_total - old.leads_total : c.leads_total,
        revenue_delta: old ? Number(c.revenue_from_leads ?? 0) - Number(old.revenue_from_leads ?? 0) : Number(c.revenue_from_leads ?? 0),
      };
    })
    .sort((a, b) => b.score_delta - a.score_delta);

  const topMovers = movers.slice(0, 3);
  const newBizs = current.filter(c => {
    const old = oldMap.get(c.business_id);
    return !old; // No snapshot from 7d ago = new tenant
  }).slice(0, 5);

  // 5. Render HTML email
  const html = renderDigestEmail({
    today, weekAgo, totals,
    businessCount: current.length,
    topMovers, newBizs,
    movers: movers.filter(m => m.leads_total > 0).slice(0, 12),
  });
  const subject = `📊 Weekly OmniLeads digest — ${todayPretty()}`;

  // 6. Send via Resend (or dry-run if no key)
  let sent = false;
  if (RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject,
        html,
      }),
    });
    sent = res.ok;
    if (!res.ok) console.error("[weekly digest] resend failed:", await res.text());
  }

  return NextResponse.json({
    ok: true, sent,
    resend_configured: !!RESEND_API_KEY,
    subject,
    businesses: current.length,
    totals,
    top_movers: topMovers.length,
    new_businesses: newBizs.length,
  });
}

function todayPretty(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function renderDigestEmail(p: {
  today: string; weekAgo: string;
  totals: { leads_added_7d: number; leads_converted: number; meetings_upcoming: number; revenue_from_leads: number; stuck_leads: number };
  businessCount: number;
  topMovers: Array<{ business_name: string; advancement_score: number; score_delta: number; leads_delta: number; revenue_delta: number }>;
  newBizs: Array<{ business_name: string; plan: string }>;
  movers: Array<{ business_name: string; advancement_score: number; leads_total: number; leads_converted: number; meetings_upcoming: number; revenue_from_leads: number; stuck_leads: number }>;
}): string {
  const totalRevenue = (p.totals.revenue_from_leads).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const moversRows = p.topMovers.map(m => `
    <tr>
      <td style="padding:8px 12px;color:#fff;font-weight:600;">${escape(m.business_name)}</td>
      <td style="padding:8px 12px;text-align:right;color:${m.score_delta >= 0 ? '#10b981' : '#f87171'};">${m.score_delta >= 0 ? '↑' : '↓'} ${Math.abs(m.score_delta)}</td>
      <td style="padding:8px 12px;text-align:right;color:#9ca3af;">+${m.leads_delta}</td>
      <td style="padding:8px 12px;text-align:right;color:#10b981;">$${(m.revenue_delta).toFixed(0)}</td>
    </tr>`).join("") || `<tr><td colspan="4" style="padding:14px;color:#666;text-align:center;font-style:italic;">No movement this week</td></tr>`;

  const allRows = p.movers.map(m => `
    <tr>
      <td style="padding:8px 12px;color:#fff;font-weight:600;">${escape(m.business_name)}</td>
      <td style="padding:8px 12px;text-align:right;color:#a78bfa;">${m.advancement_score}</td>
      <td style="padding:8px 12px;text-align:right;color:#9ca3af;">${m.leads_total}</td>
      <td style="padding:8px 12px;text-align:right;color:#10b981;">${m.leads_converted}</td>
      <td style="padding:8px 12px;text-align:right;color:${m.stuck_leads > 0 ? '#f87171' : '#666'};">${m.stuck_leads}</td>
    </tr>`).join("");

  const newBizSection = p.newBizs.length > 0 ? `
    <div style="margin:24px 0;padding:16px 20px;background:#0d2a1e;border:1px solid #10b98140;border-radius:10px;">
      <p style="color:#10b981;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;">🆕 New tenants this week</p>
      ${p.newBizs.map(b => `<p style="color:#cbd5e1;font-size:14px;margin:4px 0;">• <strong>${escape(b.business_name)}</strong> · ${b.plan}</p>`).join("")}
    </div>` : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="color:#a855f7;font-size:13px;font-weight:700;letter-spacing:0.5px;">OMNI AI · WEEKLY DIGEST</td>
        <td align="right" style="color:#9ca3af;font-size:12px;">${todayPretty()}</td>
      </tr>
    </table>

    <h1 style="color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;margin:0 0 8px;">Last 7 days · ${p.businessCount} businesses</h1>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">Cross-tenant pipeline + advancement summary.</p>

    <!-- Totals -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1e1e1e;border-radius:12px;margin-bottom:18px;">
      <tr>
        <td style="padding:18px 16px;text-align:center;border-right:1px solid #1e1e1e;">
          <div style="color:#fff;font-size:24px;font-weight:800;">${p.totals.leads_added_7d}</div>
          <div style="color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:4px;">Leads added</div>
        </td>
        <td style="padding:18px 16px;text-align:center;border-right:1px solid #1e1e1e;">
          <div style="color:#10b981;font-size:24px;font-weight:800;">${p.totals.leads_converted}</div>
          <div style="color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:4px;">Conversions</div>
        </td>
        <td style="padding:18px 16px;text-align:center;border-right:1px solid #1e1e1e;">
          <div style="color:#a78bfa;font-size:24px;font-weight:800;">${p.totals.meetings_upcoming}</div>
          <div style="color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:4px;">Upcoming meetings</div>
        </td>
        <td style="padding:18px 16px;text-align:center;">
          <div style="color:#facc15;font-size:24px;font-weight:800;">${totalRevenue}</div>
          <div style="color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:4px;">Revenue</div>
        </td>
      </tr>
    </table>

    ${p.totals.stuck_leads > 0 ? `
    <div style="background:#2a0d0d;border:1px solid #f8717140;border-radius:10px;padding:14px 18px;margin-bottom:18px;">
      <p style="color:#f87171;font-size:13px;font-weight:700;margin:0;">⚠ ${p.totals.stuck_leads} stuck leads across all businesses</p>
      <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">Open status, idle 14+ days. Clear the backlog this week.</p>
    </div>` : ""}

    ${newBizSection}

    <!-- Top movers -->
    <h2 style="color:#fff;font-size:16px;font-weight:700;margin:24px 0 10px;">🏆 Top movers</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1e1e1e;border-radius:12px;font-size:13px;">
      <tr style="background:#1a1a1a;">
        <th style="padding:10px 12px;text-align:left;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Business</th>
        <th style="padding:10px 12px;text-align:right;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Δ Score</th>
        <th style="padding:10px 12px;text-align:right;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Δ Leads</th>
        <th style="padding:10px 12px;text-align:right;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Δ Revenue</th>
      </tr>
      ${moversRows}
    </table>

    <!-- All businesses -->
    <h2 style="color:#fff;font-size:16px;font-weight:700;margin:24px 0 10px;">📊 All active businesses</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1e1e1e;border-radius:12px;font-size:13px;">
      <tr style="background:#1a1a1a;">
        <th style="padding:10px 12px;text-align:left;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Business</th>
        <th style="padding:10px 12px;text-align:right;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Score</th>
        <th style="padding:10px 12px;text-align:right;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Leads</th>
        <th style="padding:10px 12px;text-align:right;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Won</th>
        <th style="padding:10px 12px;text-align:right;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Stuck</th>
      </tr>
      ${allRows}
    </table>

    <div style="text-align:center;margin:30px 0 12px;">
      <a href="https://omnileadsagi.com/dashboard" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#10b981,#7c3aed);color:#fff;text-decoration:none;padding:13px 30px;border-radius:8px;font-size:14px;font-weight:700;">Open dashboard</a>
    </div>

    <div style="text-align:center;padding-top:18px;border-top:1px solid #1e1e1e;">
      <p style="color:#444;font-size:11px;margin:0;">Omni AI · Weekly digest fires every Monday at 7am.</p>
    </div>
  </div>
</body>
</html>`.trim();
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const GET = run;
export const POST = run;
