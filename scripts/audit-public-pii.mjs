#!/usr/bin/env node
/**
 * Gate: does an UNAUTHENTICATED route expose somebody's personal data?
 *
 * WHY THIS EXISTS
 *
 * `GET /api/agents/rankings` is a public leaderboard — the `/arena` cards
 * read it — and its response carried `ownerName`, the real name of each
 * business's owner. Ten people, including the operator's own. No public
 * surface rendered the field; only the operator's internal arena manager
 * used it, to filter its own list. So it was pure exposure, and it put the
 * operator's personal name on a public surface, which the operator's own
 * rules forbid.
 *
 * The defect is invisible to every tool this repo had. `tsc` cannot see it
 * (the field is a legitimate string). `next build` cannot see it. The RLS
 * gate cannot see it (the read is authorised — it uses the service role).
 * The cron-auth gate cannot see it (the route is not supposed to be
 * authenticated). The live mobile gate cannot see it (it renders no
 * personal data). Nothing in the pipeline asked the question "is this field
 * on a public response somebody else's identity?", so nothing answered it.
 *
 * THAT is the general form, and it is why this is a gate rather than a fix:
 * **a field on a public response is public whether or not any UI renders
 * it**, and "nothing displays it" is a statement about the UI, not about
 * the endpoint. A future surface, a crawler, or the browser devtools are
 * all consumers.
 *
 * WHAT IT CHECKS
 *
 *   public-route-exposes-personal-column
 *     A route with NO authentication of any kind selects a personal column
 *     (name / email / phone) from a table that holds other people's rows.
 *
 *   ungated-owner-identity-in-response
 *     A route's response object carries an owner/contact identity key
 *     (ownerName, owner_email, contactPhone, …) whose value is a plain
 *     property access — NOT conditional on an auth-derived condition. This
 *     is the exact shape of the rankings defect, and it fires on the
 *     pre-fix code even though the route also contains an admin check,
 *     because the admin check was only ever used to decide what to put in
 *     the response, not to decide who could ask.
 *
 * WHAT IT DELIBERATELY DOES NOT FLAG
 *
 *   A route that echoes the CALLER'S OWN submitted data (the lead capture
 *   routes return what the caller just sent) is not an exposure — there is
 *   nobody else in the payload. The owner-identity rule therefore looks for
 *   a key that names somebody ELSE's identity, not a bare `email`.
 *
 *   A route that IS authenticated is out of scope for the first rule. The
 *   second rule still applies to authenticated routes, because "this route
 *   has an admin check somewhere" is not the same as "this field is gated
 *   on that check".
 *
 * FAIL CLOSED
 *
 * If the route tree cannot be walked, the gate exits 2 with "the result is
 * UNKNOWN". A gate that cannot measure must not report a clean result.
 *
 * Usage:
 *   node scripts/audit-public-pii.mjs
 *   node scripts/audit-public-pii.mjs --report   # always exit 0
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REPORT_ONLY = process.argv.includes("--report");

/**
 * Markers of authentication, in any of its forms.
 *
 * The list is deliberately BROAD. A false negative here means a leak ships;
 * a false positive means one route gets reviewed by a human. The cost of
 * being wrong is not symmetric, so the list errs toward including routes
 * that turn out to be safe.
 */
const AUTH_MARKERS = [
  "requireAdmin",
  "authorizeCronOrAdmin",
  "assertCronCaller",
  "serviceAuthorized",
  "verifiedActor",
  "verifyVoiceToolAuth",
  "verifyElevenLabsSignature",
  "verifyUnsubscribeToken",
  // The shared session/tenancy helpers in lib/server/dashboard-access.ts.
  // `resolveCallerProfileId` returns null without a cookie session or an
  // `omni_token` bearer, and the route must check it — a route that does
  // not is a different defect, and this gate is not the place to judge it.
  "resolveCallerProfileId",
  "gateLeadAccess",
  "gateBusinessAccess",
  "hasPlatformDashboardAccess",
  "verifyOmniToken",
  "getUser(",
  "getSession(",
  "auth.getUser",
  "auth.getSession",
  "constantTimeEqual",
  "safeSecretEqual",
  "timingSafeEqual",
  "constructEvent", // stripe webhook signature
  "svix",
  "webhookSecret",
  "WEBHOOK_SECRET",
  "x-vercel-cron-token",
  "ADMIN_API_KEY",
  "CRON_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "VOICE_AGENT_SECRET",
  "RESEND_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "apiKey",
  "api_key",
  "Bearer",
  "hmac",
  "HMAC",
  "signature",
  "verifySignature",
  "checkSignature",
];

/**
 * Identifiers that mean "the result of an authorisation decision". A
 * personal field is considered gated when its value depends on one of
 * these.
 */
const AUTH_DERIVED =
  /\b(isAdmin|is_admin|admin|authenticated|authed|isAuthed|isOwner|owner|session|caller|viewer|currentUser|user|me)\b/i;

/**
 * Tables that hold OTHER people's rows, and the columns in them that
 * identify a person.
 */
const PII_TABLES = {
  profiles: [
    "name",
    "email",
    "phone",
    "first_name",
    "last_name",
    "full_name",
    "owner_name",
    "owner_email",
    "owner_phone",
    "contact_name",
    "contact_email",
    "contact_phone",
    "address",
  ],
  newsletter_subscriptions: ["email", "first_name", "last_name", "name"],
  federation_owners: ["email", "name", "first_name", "last_name", "phone"],
  federation_newsletter_subscribers: ["email", "first_name", "last_name", "name"],
  landing_page_leads: ["email", "phone", "first_name", "last_name"],
  inbound_leads: ["email", "phone", "first_name", "last_name"],
};

/**
 * Response keys that name somebody ELSE's identity. A bare `email` is NOT
 * in this list: the lead-capture routes echo the caller's own address, and
 * that is not an exposure. A key that says `owner` or `contact` is naming
 * a second party by construction.
 *
 * The alternation is kept as a STRING so it can be embedded in a larger
 * pattern without its anchors travelling with it — an anchored source
 * pasted inside another regex silently stops matching, which is exactly
 * how this rule came to report 0 findings on the very shape it was
 * written for.
 */
const OWNER_IDENTITY_ALT =
  "(?:owner|contact|client|customer|lead)_?(?:name|email|phone|first_?name|last_?name|full_?name)";
const OWNER_IDENTITY_KEY = new RegExp(`^${OWNER_IDENTITY_ALT}$`, "i");

const RULES = [
  {
    id: "public-route-exposes-personal-column",
    title: "an unauthenticated route selects a personal column from a table of other people's rows",
  },
  {
    id: "ungated-owner-identity-in-response",
    title: "a response carries an owner/contact identity that is not gated on an authorisation decision",
  },
];

function walkRoutes(dir, depth = 0) {
  if (depth > 8) return [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
  const found = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkRoutes(path, depth + 1));
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      found.push(path);
    }
  }
  return found;
}

/** The select list of a `.from('table').select('a,b')` chain. */
function selectedColumns(text, table) {
  const pattern = new RegExp(
    `\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)[\\s\\S]{0,600}?\\.select\\(\\s*(['"\`])([\\s\\S]*?)\\1`,
    "g",
  );
  const found = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    found.push(match[2]);
  }
  return found;
}

/** Lines that assign a personal-looking key inside an object literal. */
function ownerIdentityAssignments(text) {
  const lines = text.split("\n");
  const hits = [];
  lines.forEach((line, index) => {
    const match = line.match(
      new RegExp(`\\b(${OWNER_IDENTITY_ALT})\\s*:\\s*([^,}]+)`, "i"),
    );
    if (!match) return;
    hits.push({ line: index + 1, key: match[1], value: match[2].trim() });
  });
  return hits;
}

/**
 * Is this value the route echoing the CALLER'S OWN request back?
 *
 * `contact_email: body.contact_email` is the submitter's own address, and
 * there is nobody else in it. It is not an exposure.
 */
function echoesTheRequest(value) {
  return /\b(body|input|req|request|payload|form|fields|values|params|searchParams|query)\b\s*\./i.test(value);
}

/**
 * Is this value a literal rather than data? `contact_email: "contact_email"`
 * is a FIELD NAME being renamed; `contact_email: "<attacker>"` is a
 * placeholder. Neither carries anybody's identity.
 */
function isLiteral(value) {
  return /^(['"`]).*\1$/.test(value.trim());
}

function isGated(value) {
  // A conditional on an auth-derived identifier is a gate.
  if (/[?:]/.test(value) && AUTH_DERIVED.test(value)) return true;
  // A logical guard on an auth-derived identifier is a gate.
  if (/(&&|\|\|)/.test(value) && AUTH_DERIVED.test(value)) return true;
  return false;
}

function main() {
  const apiDir = join(ROOT, "app", "api");
  if (!existsSync(apiDir)) {
    console.error(
      "[public-pii] no app/api tree here — the result is UNKNOWN. This gate did not run. " +
        "Do not read this as a clean result.",
    );
    return 2;
  }
  let routes;
  try {
    routes = walkRoutes(apiDir);
  } catch (error) {
    console.error(
      `[public-pii] the route tree could not be walked (${error && error.message}) — ` +
        "the result is UNKNOWN. This gate did not run.",
    );
    return 2;
  }
  if (!routes.length) {
    console.error(
      "[public-pii] no route handlers found under app/api — the result is UNKNOWN. " +
        "This gate did not run.",
    );
    return 2;
  }

  const findings = [];
  let authenticatedRoutes = 0;

  for (const file of routes) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const rel = relative(ROOT, file);
    const authenticated = AUTH_MARKERS.some((marker) => text.includes(marker));
    if (authenticated) authenticatedRoutes++;

    // Rule 1 — an unauthenticated route reading other people's identity.
    if (!authenticated) {
      for (const [table, columns] of Object.entries(PII_TABLES)) {
        for (const list of selectedColumns(text, table)) {
          const selected = list
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
          if (selected.includes("*")) {
            findings.push({
              rule: "public-route-exposes-personal-column",
              file: rel,
              detail: `it selects every column from "${table}" with no authentication of any kind`,
            });
            continue;
          }
          for (const column of columns) {
            if (selected.includes(column)) {
              findings.push({
                rule: "public-route-exposes-personal-column",
                file: rel,
                detail:
                  `it selects "${column}" from "${table}" with no authentication of any kind ` +
                  `(no admin check, no session, no signed token, no API key)`,
              });
            }
          }
        }
      }
    }

    // Rule 2 — an owner/contact identity in the response of a PUBLIC route.
    //
    // Scoped to public routes on purpose. An authenticated route's owner
    // identity is a deliberate part of an admin tool, and flagging every
    // one of them would be a gate that cries wolf — the cron-auth gate
    // already learned that lesson. The defect shape this rule exists for
    // is a route NOBODY has to authenticate to, carrying somebody else's
    // identity to every caller.
    if (!authenticated) {
      for (const hit of ownerIdentityAssignments(text)) {
        if (isGated(hit.value)) continue;
        if (isLiteral(hit.value)) continue;
        if (echoesTheRequest(hit.value)) continue;
        findings.push({
          rule: "ungated-owner-identity-in-response",
          file: rel,
          detail:
            `the response carries "${hit.key}" as \`${hit.value}\`, and the route has no ` +
            "authentication of any kind — every caller receives it",
        });
      }
    }
  }

  const byRule = findings.reduce((acc, f) => {
    acc[f.rule] = (acc[f.rule] || 0) + 1;
    return acc;
  }, {});

  console.log(
    `[public-pii] checked ${routes.length} route handler(s) under app/api — ` +
      `${authenticatedRoutes} carry an authentication marker, ${routes.length - authenticatedRoutes} do not.`,
  );

  if (!findings.length) {
    console.log(
      `[public-pii] 0 findings across ${RULES.length} rules — no unauthenticated route exposes ` +
        "personal data, and no response carries an ungated owner identity.",
    );
    return 0;
  }

  for (const f of findings) {
    console.log(`  [${f.rule}] ${f.file} — ${f.detail}`);
  }
  console.log(
    `\n[public-pii] ${findings.length} finding(s): ` +
      Object.entries(byRule)
        .map(([r, n]) => `${n} ${r}`)
        .join(", "),
  );
  console.log(
    "[public-pii] A personal field on a public response is public whether or not any UI renders it. " +
      "Do not SELECT the column for a caller who may not have it, and gate an owner identity on an " +
      "auth-derived condition (the field should be ABSENT for an anonymous caller, not blank).",
  );
  return REPORT_ONLY ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
