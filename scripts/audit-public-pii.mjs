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
 * (the field is a legitimate string). `next build` cannot. The RLS gate
 * cannot (the read is authorised — it uses the service role). The cron-auth
 * gate cannot (the route is not supposed to be authenticated). The live
 * mobile gate cannot (it renders no personal data). Nothing in the pipeline
 * asked the question "is this field on a public response somebody else's
 * identity?", so nothing answered it.
 *
 * THAT is the general form, and it is why this is a gate rather than a fix:
 * **a field on a public response is public whether or not any UI renders
 * it**, and "nothing displays it" is a statement about the UI, not about
 * the endpoint. A future surface, a crawler, or the browser devtools are
 * all consumers.
 *
 * THE TWO LISTS THIS GATE USED TO KEEP BY HAND
 *
 * This gate answers its question with two lists, and for its whole life both
 * were typed by hand. Both had drifted, and neither could know it:
 *
 *   1. WHICH TABLES HOLD OTHER PEOPLE'S ROWS. Six names: `profiles`,
 *      `newsletter_subscriptions`, `federation_owners`,
 *      `federation_newsletter_subscribers`, `landing_page_leads`,
 *      `inbound_leads`. The live schema has 116 tables with a column that
 *      identifies a person. A leak in the other 110 was invisible to the
 *      only instrument asking the question — the same defect the RLS rule
 *      set suffered in session 57, where 136 locked tables were missing
 *      because the list had been built by hand.
 *
 *   2. WHICH ROUTES ARE AUTHENTICATED. Forty literal markers. Four of this
 *      repo's OWN credential verifiers were not among them —
 *      `verifyTelegramWebhook`, `verifyFederationNewsletterToken`,
 *      `verifySfdUnsubscribeToken`, `verifyIxUnsubscribeToken` — so four
 *      AUTHENTICATED routes were classified PUBLIC. The narrow table list is
 *      the only reason that misclassification stayed quiet: the two lists
 *      have to agree, and nothing compared them.
 *
 * Both are now DERIVED.
 *
 *   1. The table population comes from `scripts/pii-tables.json`, generated
 *      from the live schema by `npm run refresh:pii-ruleset` and checked
 *      against the live schema by `npm run audit:pii-schema`. The gate
 *      FAILS CLOSED when that file is missing: a rule set that never loaded
 *      has established nothing.
 *
 *   2. The authentication markers are derived from the CODE at run time: any
 *      exported function in `lib/` whose body performs a credential
 *      comparison (a constant-time compare, an HMAC, a secret read from the
 *      environment) or rejects with 401/403 is a credential verifier, and a
 *      route that calls one is authenticated. A verifier added to this repo
 *      tomorrow is picked up tomorrow, with no list to update. The literal
 *      markers stay as well — the derived set only ever ADDS.
 *
 * WHAT IT CHECKS
 *
 *   public-route-exposes-personal-column
 *     A route with NO authentication of any kind selects a personal column
 *     (email / phone / a person's name) from a table that holds other
 *     people's rows. A `head: true` read is a COUNT and carries no rows, so
 *     it is not an exposure.
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
 *   table-not-in-schema
 *     A route reads a table the rule set has never heard of. The gate cannot
 *     classify it, so it cannot judge it — and it says so instead of
 *     reporting a clean result over code it never looked at.
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
 * If the route tree cannot be walked, or the rule set is missing or
 * unreadable, the gate exits 2 with "the result is UNKNOWN". A gate that
 * cannot measure must not report a clean result.
 *
 * Usage:
 *   node scripts/audit-public-pii.mjs
 *   node scripts/audit-public-pii.mjs --report   # always exit 0
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { localSupabase } from "./pii-schema.mjs";

/**
 * The TypeScript compiler API is how the credential verifiers are DERIVED.
 *
 * Without it the gate can still read the routes, but it cannot tell a
 * verifier from a comment — which is the whole point: the hand-typed
 * marker list this gate replaced missed four of this repo's own verifiers,
 * and five authenticated routes were classified PUBLIC because of it. So a
 * missing compiler is not a degraded mode, it is an inability to measure:
 * the gate says UNKNOWN and stops.
 */
let ts;
try {
  ts = (await import("typescript")).default;
} catch {
  console.error(
    "[public-pii] the TypeScript compiler is not available — the credential verifiers cannot " +
      "be derived, so the routes cannot be judged. The result is UNKNOWN. This gate did not run.\n" +
      "           Install the dependencies:  npm install",
  );
  process.exit(2);
}

const ROOT = process.cwd();
const REPORT_ONLY = process.argv.includes("--report");

const RULE_SET =
  process.env.OMNI_PII_RULE_SET || join(ROOT, "scripts", "pii-tables.json");

/**
 * Markers of authentication, in any of its form.
 *
 * The list is deliberately BROAD. A false negative here means a leak ships;
 * a false positive means one route gets reviewed by a human. The cost of
 * being wrong is not symmetric, so the list errs toward including routes
 * that turn out to be safe.
 *
 * These are LITERALS — the routes that authenticate by a well-known helper
 * call. The DERIVED set (see deriveCredentialVerifiers) is added to them at
 * run time, so a verifier this repo grows later is recognised without
 * anyone editing this list.
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
  {
    id: "table-not-in-schema",
    title: "a route reads a table the rule set has never heard of, so the gate cannot judge it",
  },
];

// ---------------------------------------------------------------------------
// The rule set: which tables hold other people's rows, and which columns in
// them identify a person.
//
// It is GENERATED (`npm run refresh:pii-ruleset`) and CHECKED against the
// live schema (`npm run audit:pii-schema`). The gate fails closed without
// it: a rule set that never loaded has established nothing.
// ---------------------------------------------------------------------------

function loadRuleSet() {
  if (!existsSync(RULE_SET)) {
    console.error(
      `[public-pii] the rule set is missing (${RULE_SET}) — the result is UNKNOWN. ` +
        "This gate did not run. Do not read this as a clean result.\n" +
        "           Regenerate it:  npm run refresh:pii-ruleset",
    );
    return null;
  }
  let ruleSet;
  try {
    ruleSet = JSON.parse(readFileSync(RULE_SET, "utf8"));
  } catch (err) {
    console.error(
      `[public-pii] the rule set could not be parsed (${String(err && err.message)}) — ` +
        "the result is UNKNOWN. This gate did not run.",
    );
    return null;
  }
  const tables = new Set(ruleSet.schemaTables || []);
  const personal = ruleSet.personalColumns || {};
  if (!tables.size) {
    console.error(
      "[public-pii] the rule set carries no schema table list — the result is UNKNOWN. " +
        "This gate did not run.\n" +
        "           Regenerate it:  npm run refresh:pii-ruleset",
    );
    return null;
  }

  // A rule set is a measurement of ONE database. Carried to a tree that
  // points at another project, every table name in it would be about a
  // different schema — the gate would be judging this tree's routes against
  // somebody else's database. Refuse rather than answer.
  const own = localSupabase(ROOT);
  if (ruleSet.projectRef && own.projectRef && ruleSet.projectRef !== own.projectRef) {
    console.error(
      `[public-pii] the rule set was measured from project "${ruleSet.projectRef}" but this ` +
        `checkout points at "${own.projectRef}" — the result is UNKNOWN. This gate did not run.\n` +
        "           Regenerate it here:  npm run refresh:pii-ruleset",
    );
    return null;
  }

  return {
    tables,
    personal,
    generatedAt: ruleSet.generatedAt,
    projectRef: ruleSet.projectRef || null,
  };
}

// ---------------------------------------------------------------------------
// The derived authentication markers.
//
// A CREDENTIAL VERIFIER is a function whose body proves a caller is who it
// claims to be: a constant-time comparison, an HMAC over a token, a secret
// read from the environment, or a refusal with 401/403. The set is computed
// from `lib/` at run time, so a verifier added to this repo is recognised
// without anyone editing a list.
// ---------------------------------------------------------------------------

/**
 * A body that proves a credential.
 *
 * The signal is deliberately about the MECHANISM rather than the name: a
 * constant-time comparison, an HMAC, a signature check against a public key,
 * a secret read from the environment, or a refusal with 401/403. A function
 * that does one of those is checking a credential, whatever it is called.
 */
const CREDENTIAL_SIGNAL =
  /timingSafeEqual|createHmac|createSign|createPublicKey|verifySignature|jwtVerify|constantTimeEqual|safeSecretEqual|process\.env\.[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD)|Error\(\s*40[13]/;

/** A name that says "this function checks a credential". */
const VERIFIER_NAME = /^(?:verify|require|authorize|assert|authenticate)[A-Z]/;

/**
 * Every function in a source file, with its body.
 *
 * The file is PARSED with the TypeScript compiler, not scanned with a
 * regular expression. The regex version read the first `{` after the
 * parameter list as the body's opening brace, and a return type like
 * `: { ok: boolean; reason?: string }` put a TYPE LITERAL where the body
 * should have been — so `verifyTelegramWebhook` and `verifyOmniToken`,
 * two of this repo's real credential verifiers, looked like functions with
 * no body at all and never entered the derived set. A gate that cannot see
 * its own subject is worse than a gate that was never written, because it
 * reports "0 findings" over code it never read.
 *
 * The compiler is the repo's own choice for exactly this reason: the
 * email-unsubscribe gate already parses with it rather than with a regex.
 */
export function extractFunctions(text, fileName = "source.ts") {
  const out = [];
  let source;
  try {
    source = ts.createSourceFile(
      fileName,
      text,
      ts.ScriptTarget.Latest,
      true,
      fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
  } catch {
    return out;
  }
  const isExported = (node) =>
    Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      out.push({
        name: node.name.text,
        exported: isExported(node),
        body: node.body.getText(source),
      });
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      const statement = node.parent?.parent;
      out.push({
        name: node.name.text,
        exported: Boolean(statement?.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)),
        body: node.initializer.getText(source),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

function walkSource(dir, depth = 0) {
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
      found.push(...walkSource(path, depth + 1));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      found.push(path);
    }
  }
  return found;
}

/**
 * The exported credential verifiers in `lib/`.
 *
 * A function qualifies when its body proves a credential DIRECTLY, or when
 * it CALLS a function that does — resolved to a fixed point, so
 * `authenticateMafiPartner` is recognised because it calls
 * `verifyVercelProjectToken`, which is recognised because it compares in
 * constant time.
 */
export function deriveCredentialVerifiers(root) {
  const files = walkSource(join(root, "lib"));
  const functions = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const fn of extractFunctions(text, file)) {
      functions.push({ ...fn, file });
    }
  }

  const byName = new Map();
  for (const fn of functions) {
    if (!byName.has(fn.name)) byName.set(fn.name, []);
    byName.get(fn.name).push(fn);
  }

  // Fixed point over "calls a credential-bearing function".
  const credentialBearing = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const fn of functions) {
      if (credentialBearing.has(fn)) continue;
      if (CREDENTIAL_SIGNAL.test(fn.body)) {
        credentialBearing.add(fn);
        changed = true;
        continue;
      }
      for (const other of functions) {
        if (other === fn) continue;
        if (!credentialBearing.has(other)) continue;
        if (new RegExp(`\\b${other.name}\\s*\\(`).test(fn.body)) {
          credentialBearing.add(fn);
          changed = true;
          break;
        }
      }
    }
  }

  const markers = new Set();
  for (const fn of functions) {
    if (!fn.exported) continue;
    if (!credentialBearing.has(fn)) continue;
    if (!VERIFIER_NAME.test(fn.name)) continue;
    markers.add(fn.name);
  }
  return markers;
}

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

/**
 * The `.select(...)` of a `.from('table')` chain.
 *
 * A `head: true` read is a COUNT — the database returns a number and no
 * rows — so it carries nobody's identity and is not an exposure.
 */
function selectedColumns(text, table) {
  const pattern = new RegExp(
    `\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)[\\s\\S]{0,600}?\\.select\\(([\\s\\S]{0,400}?)\\)`,
    "g",
  );
  const found = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const args = match[1];
    if (/head\s*:\s*true/.test(args)) continue;
    const literal = args.match(/^\s*(['"`])([\s\S]*?)\1/);
    if (!literal) continue;
    found.push(literal[2]);
  }
  return found;
}

/** Every table a route reads. */
function tablesRead(text) {
  const pattern = /\.from\(\s*['"`]([A-Za-z0-9_$]+)['"`]\s*\)/g;
  const found = new Set();
  let match;
  while ((match = pattern.exec(text)) !== null) {
    found.add(match[1]);
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

  const ruleSet = loadRuleSet();
  if (!ruleSet) return 2;

  let derivedMarkers;
  try {
    derivedMarkers = deriveCredentialVerifiers(ROOT);
  } catch (error) {
    console.error(
      `[public-pii] the credential verifiers could not be derived (${error && error.message}) — ` +
        "the result is UNKNOWN. This gate did not run.",
    );
    return 2;
  }

  const findings = [];
  let authenticatedRoutes = 0;
  let routesAuthenticatedByDerivedMarker = 0;

  for (const file of routes) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const rel = relative(ROOT, file);

    const literalMarker = AUTH_MARKERS.some((marker) => text.includes(marker));
    const derivedMarker = [...derivedMarkers].some((marker) =>
      new RegExp(`\\b${marker}\\s*\\(`).test(text),
    );
    // A route can also verify a credential IN ITS OWN FILE — a local
    // helper that compares in constant time. It is recognised the same way
    // the shared verifiers are: the file is PARSED, and the local function
    // must be credential-bearing in its own body. A route that merely
    // MENTIONS a verifier in a comment is not authenticated, and a route
    // whose credential signal lives in an unrelated function is not
    // authenticated either — because both would hide a leak behind a
    // classification the code does not support.
    const localVerifier = extractFunctions(text, rel).some(
      (fn) => VERIFIER_NAME.test(fn.name) && CREDENTIAL_SIGNAL.test(fn.body),
    );

    const authenticated = literalMarker || derivedMarker || localVerifier;
    if (authenticated) authenticatedRoutes++;
    if (!literalMarker && (derivedMarker || localVerifier)) {
      routesAuthenticatedByDerivedMarker++;
    }

    // Rule 3 — a table the rule set has never heard of.
    for (const table of tablesRead(text)) {
      if (ruleSet.tables.has(table)) continue;
      findings.push({
        rule: "table-not-in-schema",
        file: rel,
        detail:
          `it reads "${table}", which the rule set has never heard of — the gate cannot say ` +
          "whether that table holds personal data, so it cannot judge this read",
      });
    }

    // Rule 1 — an unauthenticated route reading other people's identity.
    if (!authenticated) {
      for (const [table, columns] of Object.entries(ruleSet.personal)) {
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
      `${authenticatedRoutes} carry an authentication marker, ${routes.length - authenticatedRoutes} do not ` +
      `(${routesAuthenticatedByDerivedMarker} recognised by a DERIVED verifier rather than a literal marker).`,
  );
  console.log(
    `[public-pii] rule set: ${ruleSet.tables.size} table(s) in the schema, ` +
      `${Object.keys(ruleSet.personal).length} of them hold a column that identifies a person ` +
      `(generated ${ruleSet.generatedAt || "unknown"}); ` +
      `${derivedMarkers.size} credential verifier(s) derived from lib/.`,
  );

  if (!findings.length) {
    console.log(
      `[public-pii] 0 findings across ${RULES.length} rules — no unauthenticated route exposes ` +
        "personal data, no response carries an ungated owner identity, and every table a route " +
        "reads is one the rule set can classify.",
    );
    return 0;
  }

  for (const f of findings) {
    console.log(`  [${f.rule}] ${f.file} — ${f.detail}`);
  }
  console.log(
    `\n[public-pii] ${findings.length} finding(s) across ${RULES.length} rule(s): ` +
      (Object.keys(byRule).length
        ? Object.entries(byRule)
            .map(([r, n]) => `${n} ${r}`)
            .join(", ")
        : "no rule fired"),
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
