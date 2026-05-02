import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCronCaller } from "@/lib/cron";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/morning-digest
 *
 * Reads the latest `intel_digest` row, the active leadership stewards,
 * any unresolved system_findings, and emails a morning briefing to
 * sitanim8@gmail.com (BCC alfred@). Logs to `email_sends`.
 *
 * Schedule (UTC, in vercel.json): 10:00 daily ≈ 06:00 ET in winter.
 */
const FROM = process.env.RESEND_FROM || "OmniLeads AGI <agent@omnileadsagi.com>";
const FOUNDER_EMAIL = "sitanim8@gmail.com";
const ADMIN_BCC = "alfred@omnileadsagi.com";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mdToHtml(md: string): string {
  // Tiny subset converter: # headings, **bold**, list lines.
  const lines = md.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw;
    if (line.startsWith("# ")) {
      out.push(`<h2 style="margin:0 0 8px;color:#fff;font-size:18px;">${escapeHtml(line.slice(2))}</h2>`);
    } else if (line.startsWith("- ")) {
      const inner = line.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      out.push(`<li style="margin:0 0 4px;color:#d4d4d4;">${inner}</li>`);
    } else if (line.trim() === "") {
      out.push("");
    } else {
      const inner = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      out.push(`<p style="margin:0 0 8px;color:#d4d4d4;line-height:1.5">${inner}</p>`);
    }
  }
  // Wrap consecutive <li> in a <ul>
  let html = out.join("\n");
  html = html.replace(/(<li[\s\S]*?<\/li>\n?)+/g, (match) => `<ul style="margin:0 0 12px 20px;padding:0;">${match}</ul>`);
  return html;
}

export async function GET(request: Request) {
  const auth = assertCronCaller(request);
  if (!auth.ok) return auth.response;

  const sb = createAdminClient();
  const RESEND_KEY = process.env.RESEND_API_KEY || "";
  if (!RESEND_KEY) {
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY missing" },
      { status: 500 },
    );
  }

  const [
    { data: digest },
    { data: stewards },
    { data: findings },
  ] = await Promise.all([
    sb
      .from("intel_digest")
      .select("digest_date, summary_md, metrics")
      .order("digest_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("leadership_runs")
      .select(
        "domain, run_ends_at, council_agents:current_steward_id (name)",
      )
      .eq("status", "active"),
    sb
      .from("system_findings")
      .select("severity, finding_kind, message_md, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const digestRow = digest as
    | { digest_date: string; summary_md: string; metrics: unknown }
    | null;
  const summaryHtml = digestRow
    ? mdToHtml(digestRow.summary_md)
    : '<p style="color:#a3a3a3;">No intel digest available yet — the federation has been quiet, or the nightly job has not run.</p>';

  const stewardRows = (stewards || []) as Array<{
    domain: string;
    run_ends_at: string;
    council_agents?: { name?: string } | null;
  }>;
  const stewardHtml = stewardRows
    .map((s) => {
      const name = s.council_agents?.name || "—";
      const days = Math.max(
        0,
        Math.floor((new Date(s.run_ends_at).getTime() - Date.now()) / 86_400_000),
      );
      return `<li style="margin:0 0 4px;color:#d4d4d4;"><strong>${escapeHtml(s.domain)}</strong> · ${escapeHtml(name)} <span style="color:#888;">(${days}d left)</span></li>`;
    })
    .join("");

  const findingRows = (findings || []) as Array<{
    severity: string;
    finding_kind: string;
    message_md: string;
    created_at: string;
  }>;
  const findingsHtml = findingRows.length
    ? findingRows
        .map(
          (f) =>
            `<li style="margin:0 0 6px;color:#d4d4d4;"><span style="display:inline-block;padding:1px 6px;border-radius:9px;background:#7c1d1d;color:#fecaca;font-size:11px;margin-right:6px;">${escapeHtml(f.severity)}</span>${escapeHtml(f.message_md)}</li>`,
        )
        .join("")
    : '<li style="color:#888;">Nothing flagged. Hades is watching.</li>';

  const subject = digestRow
    ? `Morning briefing · ${digestRow.digest_date}`
    : `Morning briefing · ${new Date().toISOString().slice(0, 10)}`;

  const html = `<!doctype html><html><body style="margin:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e5e5e5;">
<div style="max-width:620px;margin:0 auto;padding:40px 28px;background:radial-gradient(ellipse at 30% 0%,rgba(251,191,36,0.08) 0%,#000 60%);">
  <p style="margin:0 0 24px;font-size:11px;letter-spacing:5px;color:rgba(251,191,36,0.7);text-transform:uppercase;">PANTHEON · MORNING BRIEFING</p>
  <h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:28px;line-height:1.2;color:#fff;font-weight:400;">While you slept.</h1>

  <div style="margin:0 0 24px;">${summaryHtml}</div>

  <h3 style="margin:24px 0 8px;color:#fde68a;font-size:14px;font-family:Georgia,serif;font-weight:400;">Active Stewards</h3>
  <ul style="margin:0 0 24px 16px;padding:0;">${stewardHtml || '<li style="color:#888;">No active runs.</li>'}</ul>

  <h3 style="margin:24px 0 8px;color:#fda4af;font-size:14px;font-family:Georgia,serif;font-weight:400;">Top findings</h3>
  <ul style="margin:0 0 32px 16px;padding:0;">${findingsHtml}</ul>

  <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
    <tr><td style="background:#fde68a;border-radius:999px;">
      <a href="https://omnileadsagi.com/dashboard/command-center" style="display:inline-block;padding:12px 22px;color:#000;font-weight:600;text-decoration:none;font-size:14px;">Open command center →</a>
    </td></tr>
  </table>

  <hr style="border:none;border-top:1px solid #262626;margin:24px 0;"/>
  <p style="margin:0;font-size:11px;letter-spacing:2px;color:#525252;text-transform:uppercase;">omnileadsagi.com · pantheon · morning</p>
</div>
</body></html>`;

  const text = [
    `PANTHEON · MORNING BRIEFING`,
    `While you slept.`,
    "",
    digestRow ? digestRow.summary_md : "(no intel digest yet)",
    "",
    "Active stewards:",
    ...stewardRows.map(
      (s) =>
        `- ${s.domain}: ${s.council_agents?.name || "—"} (${Math.max(0, Math.floor((new Date(s.run_ends_at).getTime() - Date.now()) / 86_400_000))}d left)`,
    ),
    "",
    "Top findings:",
    ...(findingRows.length
      ? findingRows.map((f) => `- [${f.severity}] ${f.message_md}`)
      : ["- Nothing flagged. Hades is watching."]),
    "",
    "Open command center: https://omnileadsagi.com/dashboard/command-center",
  ].join("\n");

  const sendBody = {
    from: FROM,
    to: [FOUNDER_EMAIL],
    bcc: [ADMIN_BCC],
    subject,
    html,
    text,
  };

  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sendBody),
  });

  const sendBodyText = await send.text();
  let resendId: string | null = null;
  try {
    const j = JSON.parse(sendBodyText);
    resendId = j?.id || null;
  } catch {
    /* ignore */
  }

  await sb.from("email_sends").insert({
    resend_id: resendId,
    template_kind: "morning_digest",
    to_email: FOUNDER_EMAIL,
    bcc_email: ADMIN_BCC,
    subject,
    payload: {
      send_status: send.status,
      digest_date: digestRow?.digest_date || null,
      via: auth.ok ? auth.reason : "unknown",
    },
  });

  if (!send.ok) {
    return NextResponse.json(
      { ok: false, error: `Resend ${send.status}: ${sendBodyText.slice(0, 240)}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    resend_id: resendId,
    digest_date: digestRow?.digest_date || null,
  });
}
