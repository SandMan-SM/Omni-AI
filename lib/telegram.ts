// ── Omni AI Telegram Notification System ─────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID   = process.env.TELEGRAM_ADMIN_CHAT_ID!;

type UpdateType = "Feature" | "Fix" | "Alert" | "Improvement" | "Deploy" | "Health";
type Severity   = "Low" | "Medium" | "Critical";

interface OmniUpdate {
  type:     UpdateType;
  severity: Severity;
  summary:  string;
  impact:   string;
  details?: string;
}

function severityEmoji(s: Severity) {
  return s === "Critical" ? "🔴" : s === "Medium" ? "🟡" : "🟢";
}

function typeEmoji(t: UpdateType) {
  const map: Record<UpdateType, string> = {
    Feature:     "✨",
    Fix:         "🔧",
    Alert:       "🚨",
    Improvement: "⚡",
    Deploy:      "🚀",
    Health:      "💊",
  };
  return map[t] || "📌";
}

export async function sendTelegram(text: string): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendOmniUpdate(update: OmniUpdate): Promise<boolean> {
  const ts = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Telegram parse_mode: HTML treats <, >, & as control characters.
  // alertCritical / notifyDeploy callers frequently pass error message
  // strings (Postgres errors, fetch bodies) that contain those chars.
  // Without escaping, the API returns 400 ("can't parse entities") and
  // the entire system alert is silently dropped — exactly the wrong time
  // to lose a notification.
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = [
    `${typeEmoji(update.type)} <b>[OMNI AI UPDATE]</b>`,
    ``,
    `<b>Time:</b> ${esc(ts)} PT`,
    `<b>Type:</b> ${esc(update.type)}`,
    `<b>Severity:</b> ${severityEmoji(update.severity)} ${esc(update.severity)}`,
    ``,
    `<b>Summary:</b> ${esc(update.summary)}`,
    `<b>Impact:</b> ${esc(update.impact)}`,
  ];

  if (update.details) {
    lines.push(``, `<b>Details:</b>`, `<code>${esc(update.details)}</code>`);
  }

  return sendTelegram(lines.join("\n"));
}

export async function alertCritical(summary: string, details?: string) {
  return sendOmniUpdate({
    type: "Alert",
    severity: "Critical",
    summary,
    impact: "Immediate attention required",
    details,
  });
}

export async function alertFix(summary: string, impact?: string) {
  return sendOmniUpdate({
    type: "Fix",
    severity: "Low",
    summary,
    impact: impact || "System stability improved",
  });
}

export async function notifyDeploy(summary: string) {
  return sendOmniUpdate({
    type: "Deploy",
    severity: "Low",
    summary,
    impact: "Live at omnileadsagi.com",
  });
}
