/**
 * Pantheon dialogue templates.
 *
 * The dialogue cron picks recent triggers (system_findings,
 * intel_digest deltas, lighthouse drops) and produces a thread of
 * messages between relevant council members. Each thread also
 * surfaces a concrete proposed_action that becomes a pantheon_proposals
 * row.
 *
 * Templates are deterministic so the system runs without depending on
 * a working Anthropic key. When the LLM key is healthy, a separate
 * upgrade path can rewrite each template message into richer prose
 * via Anthropic — but the proposals themselves are produced from the
 * structured payload, not the prose, so quality of the LLM rewrite is
 * orthogonal to whether actions get queued.
 */

export type Trigger = {
  topic: string; // 'leads_drop' | 'leads_zero' | 'page_views_drop' | 'newsletter_opens_drop' | 'lighthouse_perf' | 'morning'
  business_label?: string;
  business_id?: string | null;
  metric_now?: number | null;
  metric_prior?: number | null;
  delta_pct?: number | null; // e.g. -0.35 for 35% drop
  meta?: Record<string, unknown>;
};

export type DialogueLine = {
  agent_name: string;
  to_agent_name?: string;
  message_md: string;
  proposed_action?: ProposedAction;
};

export type ProposedAction = {
  kind:
    | "copy"
    | "route"
    | "meta"
    | "asset"
    | "newsletter"
    | "cron"
    | "schema"
    | "config"
    | "investigate";
  target: string;
  rationale_md: string;
  confidence: number;
  payload?: Record<string, unknown>;
  proposed_by: string; // archetype name
  business_label?: string;
};

function pct(v: number | null | undefined): string {
  if (typeof v !== "number") return "?";
  return `${Math.round(Math.abs(v) * 100)}%`;
}

function brand(t: Trigger): string {
  return t.business_label || "the federation";
}

/**
 * Build a multi-message thread for a trigger. Returns the dialogue
 * lines (insert order matters — first message is the seed) plus an
 * optional list of concrete proposals to queue.
 */
export function buildThread(t: Trigger): {
  lines: DialogueLine[];
  proposals: ProposedAction[];
} {
  switch (t.topic) {
    case "leads_zero":
      return leadsZero(t);
    case "leads_drop":
      return leadsDrop(t);
    case "page_views_drop":
      return pageViewsDrop(t);
    case "newsletter_opens_drop":
      return newsletterOpensDrop(t);
    case "lighthouse_perf":
      return lighthousePerf(t);
    case "morning":
      return morning(t);
    default:
      return adHoc(t);
  }
}

function leadsZero(t: Trigger) {
  const lines: DialogueLine[] = [
    {
      agent_name: "Horus",
      to_agent_name: "Athena",
      message_md: `**${brand(t)}** went a full week with zero leads. The funnel is silent. Athena — where would you start the architecture audit?`,
    },
    {
      agent_name: "Athena",
      to_agent_name: "OmniClaw",
      message_md: `Form endpoint first. OmniClaw, can you confirm \`/api/inbound/${(t.meta?.slug as string) || "[slug]"}/leads\` is returning 200 from the deployed brand site, and that CORS origin is whitelisted?`,
    },
    {
      agent_name: "Sun Tzu",
      to_agent_name: "Naval",
      message_md: `Zero leads is rarely the form alone. Either traffic is dry or intent is wrong. Naval — what permanent leverage are we losing this week we won't get back?`,
    },
    {
      agent_name: "Naval",
      message_md: `Every silent week compounds. The fix is structural — fix the form, then fix the upstream traffic source, in that order. Don't do both at once.`,
    },
  ];
  const proposals: ProposedAction[] = [
    {
      kind: "investigate",
      target: `inbound_${(t.meta?.slug as string) || "[slug]"}_leads`,
      rationale_md:
        "Zero leads in 7d while prior week had > 0. Check (1) form endpoint 200, (2) CORS, (3) tracker mounted on production deploy, (4) referrer source dry.",
      confidence: 0.85,
      payload: { check_order: ["form_endpoint", "cors", "tracker_mount", "referrer"] },
      proposed_by: "Athena",
      business_label: t.business_label,
    },
  ];
  return { lines, proposals };
}

function leadsDrop(t: Trigger) {
  const drop = pct(t.delta_pct);
  const lines: DialogueLine[] = [
    {
      agent_name: "Horus",
      to_agent_name: "Sun Tzu",
      message_md: `**${brand(t)}** leads down ${drop} week-over-week (${t.metric_prior} → ${t.metric_now}). Sun Tzu — defence or attack?`,
    },
    {
      agent_name: "Sun Tzu",
      to_agent_name: "Athena",
      message_md: `Defence. Athena, look at funnel mid-step first — page-view holding while leads dropped means the form or CTA is the leak.`,
    },
    {
      agent_name: "Isis",
      to_agent_name: "Dante",
      message_md: `Or the warmth dropped. Dante, did the journey arc change? Sometimes a 'fix' to a hero shortens the seduction window.`,
    },
    {
      agent_name: "Dante",
      message_md: `The user has to walk through three states before submitting. Check what changed in the third state — usually a copy edit or button rearrangement is the real cause.`,
    },
  ];
  const proposals: ProposedAction[] = [
    {
      kind: "investigate",
      target: t.business_label || "federation",
      rationale_md: `Funnel mid-step audit: compare conversion rate at each step this week vs prior. Leads down ${drop} but verify page-views also moved.`,
      confidence: 0.7,
      payload: { metric_now: t.metric_now, metric_prior: t.metric_prior, drop_pct: t.delta_pct },
      proposed_by: "Athena",
      business_label: t.business_label,
    },
  ];
  return { lines, proposals };
}

function pageViewsDrop(t: Trigger) {
  const drop = pct(t.delta_pct);
  const lines: DialogueLine[] = [
    {
      agent_name: "Horus",
      to_agent_name: "OmniClaw",
      message_md: `**${brand(t)}** page views down ${drop}. Traffic side, not funnel side. OmniClaw — UTM source breakdown for the lost ${pct(t.delta_pct)}?`,
    },
    {
      agent_name: "OmniClaw",
      to_agent_name: "Sun Tzu",
      message_md: `Will pull. Most often it's organic search ranking slipping or a paid channel pausing. Sun Tzu — competitive index move?`,
    },
    {
      agent_name: "Carmack",
      message_md: `Before you blame the channel — was Lighthouse Perf still ≥ 90 last week? A new image bloat tanks crawl.`,
    },
  ];
  const proposals: ProposedAction[] = [
    {
      kind: "investigate",
      target: `inbound_${(t.meta?.slug as string) || "[slug]"}_events`,
      rationale_md: `Group last 14d page_view events by referrer_kind / utm_source. Identify which channel dropped.`,
      confidence: 0.65,
      payload: { window_days: 14 },
      proposed_by: "OmniClaw",
      business_label: t.business_label,
    },
  ];
  return { lines, proposals };
}

function newsletterOpensDrop(t: Trigger) {
  const drop = pct(t.delta_pct);
  const lines: DialogueLine[] = [
    {
      agent_name: "Isis",
      to_agent_name: "Joseph Campbell",
      message_md: `**${brand(t)}** newsletter opens down ${drop}. Subject lines or send time? Campbell — where is the mythic hook this week?`,
    },
    {
      agent_name: "Joseph Campbell",
      message_md: `Subject lines that frame a specific small drama outperform generic hooks 2-3×. Check if last week's subjects were declarative vs. story-shaped.`,
    },
    {
      agent_name: "Naval",
      to_agent_name: "Carl Jung",
      message_md: `Or trust eroded. Jung — is there a recent shadow we haven't surfaced?`,
    },
  ];
  const proposals: ProposedAction[] = [
    {
      kind: "newsletter",
      target: t.business_label || "federation",
      rationale_md: `Audit last 4 weeks of subject lines for narrative shape. Replace declarative hooks with specific small dramas (a person, a tension, a turn).`,
      confidence: 0.6,
      payload: { metric: "open_rate", drop_pct: t.delta_pct },
      proposed_by: "Joseph Campbell",
      business_label: t.business_label,
    },
  ];
  return { lines, proposals };
}

function lighthousePerf(t: Trigger) {
  const score = (t.meta?.score as number) ?? 0;
  const lines: DialogueLine[] = [
    {
      agent_name: "Carmack",
      to_agent_name: "Hephaestus",
      message_md: `**${brand(t)}** Lighthouse perf at ${score}. Below the 90 floor. Hephaestus — toolchain or content?`,
    },
    {
      agent_name: "Hephaestus",
      message_md: `Usually content. Top suspects in order: hero image weight, font-loading strategy, third-party scripts, hydration cost on a heavy first route.`,
    },
    {
      agent_name: "Athena",
      to_agent_name: "Linus",
      message_md: `Linus — would you accept a PR that converts hero to AVIF + adds preconnect to image CDN, sight unseen?`,
    },
    {
      agent_name: "Linus",
      message_md: `If it's measured. Show me LCP before and after. No vibe optimisations.`,
    },
  ];
  const proposals: ProposedAction[] = [
    {
      kind: "asset",
      target: t.business_label || "federation",
      rationale_md: `Hero image conversion to AVIF + preconnect to image CDN. Expected ≈30% LCP reduction. Measure before/after.`,
      confidence: 0.75,
      payload: { lighthouse_score: score, intervention: "hero_avif_preconnect" },
      proposed_by: "Hephaestus",
      business_label: t.business_label,
    },
  ];
  return { lines, proposals };
}

function morning(t: Trigger) {
  const lines: DialogueLine[] = [
    {
      agent_name: "Marcus Aurelius",
      to_agent_name: "Osirus",
      message_md: `Morning. The federation slept; the system did not. Osirus — what compounded overnight?`,
    },
    {
      agent_name: "Osirus",
      to_agent_name: "Athena",
      message_md: `Last 24h: nightly intel digest written, weakness scan ran, leadership rotation evaluated. Athena — anything in findings worth elevating?`,
    },
    {
      agent_name: "Athena",
      message_md: `Top three findings from the scanner are surfaced in the morning briefing email. The dialogue cron will react to each one in its own thread within the next hour.`,
    },
    {
      agent_name: "Lao Tzu",
      message_md: `What can be removed today instead of added? Begin there.`,
    },
    {
      agent_name: "OmniClaw",
      to_agent_name: "Athena",
      message_md:
        "Run the Messy-to-Motion pass today: find the thing in the operator logs, separate dashboard-service errors, client queue, public-site issues, or latest prompts that feels too vague, tedious, or under-defined to start. Convert it into one reversible 30-minute move and execute if it is safe.",
      proposed_action: messyToMotionProposal(t),
    },
  ];
  return { lines, proposals: [messyToMotionProposal(t)] };
}

function adHoc(t: Trigger) {
  const lines: DialogueLine[] = [
    {
      agent_name: "Osirus",
      message_md: `Ad-hoc thread opened on **${t.topic}**. Use the Messy-to-Motion protocol: clarify the real objective, name what is messy or avoided, identify the hidden dependency, and produce the smallest reversible next action.`,
    },
  ];
  return { lines, proposals: [] };
}

function messyToMotionProposal(t: Trigger): ProposedAction {
  return {
    kind: "investigate",
    target: "operator_friction_to_motion",
    rationale_md:
      "Identify one vague, tedious, emotionally loaded, or under-defined operator/client issue from recent prompts, logs, separate dashboard-service errors, public-site defects, newsletter defects, analytics gaps, or client queues. Convert it into a 30-minute reversible action. Execute if safe; otherwise queue the exact blocker.",
    confidence: 0.8,
    payload: {
      protocol: "messy_to_motion",
      trigger_topic: t.topic,
      questions: [
        "What are we trying to accomplish?",
        "What feels messy, annoying, unclear, or emotionally loaded?",
        "What are we avoiding because it feels too big or undefined?",
        "What would moved-forward look like in the next 30 minutes?",
        "What is the smallest useful version of progress?",
        "What hidden dependency, risk, or decision might be ignored?",
        "What would a sharper operator ask right now?",
        "What should stop being overcomplicated?",
        "What should not be rushed?",
        "What is the next concrete action?",
      ],
      council_roles: {
        Athena: "clarify system shape, ownership, and source of truth",
        "Sun Tzu": "identify leverage, threat, and timing",
        Naval: "identify compounding reusable infrastructure",
        Isis: "identify trust and adoption friction",
        Carmack: "identify technical risk and verification",
        "Lao Tzu": "identify what to remove or slow down",
        OmniClaw: "execute, verify, log, and queue the next move",
      },
      execution_boundary:
        "Execute reversible scoped work without permission; pause for money, secrets, destructive data, legal/client-binding sends, paid ad spend, migrations, or unapproved outbound messages.",
      routing_boundary:
        "Do not build or link the main client-agent dashboard at omnileadsagi.com/dashboard. OmniLeadsAGI is the public revenue and internal ingestion service; the canonical operator dashboard is https://mythosais.com/dashboard.",
    },
    proposed_by: "OmniClaw",
  };
}
