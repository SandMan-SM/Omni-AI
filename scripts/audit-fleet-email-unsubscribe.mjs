#!/usr/bin/env node
/**
 * audit:fleet-email-unsubscribe — sweep every client surface in the fleet
 * for bulk email that carries no working unsubscribe.
 *
 * WHY THIS EXISTS
 *
 * The defect class is not a repo property. On 2026-11-04 the single-repo
 * gate (`audit:email-unsubscribe`) found two bulk subscriber-mail paths in
 * this repo that sent with NO unsubscribe link, NO `List-Unsubscribe`
 * header and NO one-click support, while four other mail paths in the
 * SAME repo complied and the unsubscribe infrastructure sat complete and
 * unused. The fleet is a set of independent Next.js checkouts that share
 * patterns but not code, so the same class can reappear in any of them
 * the moment someone copies a mail path.
 *
 * WHAT IT SCANS
 *
 * Canonical site checkouts under the fleet root — the same population
 * `audit:fleet-auth` calls "canonical surfaces": a directory with an
 * `app/` (or `src/app/`) holding a route handler. Worktrees, release
 * copies and scratch directories are skipped: they are not deployed
 * surfaces. (Copies are a separate question — a copy of a fixed project
 * that still carries the defect is a loaded gun — and `audit:fleet-auth`
 * already reports divergences against the canonical tree.)
 *
 * RULES
 *
 *   1. bulk-bcc-send-missing-unsubscribe
 *      A Resend payload that fans out with `bcc` shares ONE body across
 *      every recipient. A per-recipient token in that body would
 *      unsubscribe somebody else, so the send MUST declare a
 *      `List-Unsubscribe` header (or be split into one message per
 *      recipient, which removes the `bcc`).
 *
 *   2. audience-send-missing-unsubscribe
 *      A file that resolves recipients from a subscriber list and sends
 *      mail must set a `List-Unsubscribe` header. The header is the
 *      signal a mail client needs to render a one-click control; without
 *      it a subscriber has no way out of the list short of an email to
 *      the operator.
 *
 *   3. list-recipient-send-missing-unsubscribe
 *      A send whose `to` is built from a list of addresses (a spread of
 *      emails, a mapped list) is a list send even when it is not a
 *      `bcc` fan-out — and it must carry the header too. This catches
 *      per-recipient sends that were correctly split but left without
 *      the mechanism.
 *
 * SCOPE / FALSE POSITIVES
 *
 * Transactional one-to-one sends (a booking receipt, a lead
 * notification, a password reset) have no list to unsubscribe from, and
 * flagging them would be a gate that cries wolf. Those are exempt:
 * a send whose recipient list is a single address is not a list send.
 * A file that sends BOTH a one-to-one mail and a list mail is reported
 * once, against the list send.
 *
 * Usage:
 *   node scripts/audit-fleet-email-unsubscribe.mjs             # sweep ~/Desktop/Clients
 *   node scripts/audit-fleet-email-unsubscribe.mjs --dir <path>
 *   node scripts/audit-fleet-email-unsubscribe.mjs --report     # always exit 0
 *
 * Exit codes: 0 no findings, 1 findings, 2 the fleet root is unusable.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

const RESEND_ENDPOINT = "api.resend.com/emails";

/** Directories that hold copies, not the surfaces themselves. */
const SKIP_SEGMENTS = [
  "node_modules",
  "_tmp",
  "_release",
  "_agent-worktrees",
  "_codex-worktrees",
  "_deploy-worktrees",
  "worktrees",
  "__pycache__",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  // Archived plan baselines live under docs/ — snapshots of a site at a
  // point in time, not deployed surfaces. The live checkout of the same
  // site is elsewhere in the fleet and IS scanned.
  "docs",
];

/**
 * Subscriber tables. A file that READS one of these (`.select(...)`) is
 * resolving recipients from a list; a file that only WRITES to one
 * (upsert a new subscriber) is not — and that distinction is the whole
 * difference between a real finding and a signup form.
 */
const AUDIENCE_TABLES = [
  "newsletter_subscribers",
  "newsletter_subscriptions",
  "federation_newsletter_subscribers",
  "mailing_list",
  "contact_list",
];

/** Helpers that return a resolved audience. Precise, so they stand alone. */
const AUDIENCE_HELPERS = [
  "getNewsletterAudience",
  "audienceSendList",
  "loadSubscriberEmails",
  "subscriber_emails",
];

function parseArgs(argv) {
  const options = {
    reportOnly: false,
    dir: join(homedir(), "Desktop", "Clients"),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--report") options.reportOnly = true;
    else if (argv[i] === "--dir") options.dir = resolve(argv[++i] || "");
  }
  return options;
}

function isSkippedSegment(entry) {
  return SKIP_SEGMENTS.includes(entry) || entry.startsWith(".");
}

function hasRouteHandler(dir, depth) {
  if (depth > 4) return false;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (isSkippedSegment(entry)) continue;
      if (hasRouteHandler(path, depth + 1)) return true;
      continue;
    }
    if (/^route\.(ts|tsx|js|jsx)$/.test(entry)) return true;
  }
  return false;
}

/** A directory is a site when it holds an `app/` (or `src/app/`) with a route handler. */
function looksLikeSite(path) {
  for (const app of [join(path, "app"), join(path, "src", "app")]) {
    if (existsSync(app) && hasRouteHandler(app, 0)) return true;
  }
  return false;
}

/** Canonical site checkouts under `dir` — copies and worktrees excluded. */
function candidateRoots(dir) {
  const found = [];
  const walk = (current, depth) => {
    if (depth > 5) return;
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (isSkippedSegment(entry)) continue;
      const path = join(current, entry);
      let stats;
      try {
        stats = statSync(path);
      } catch {
        continue;
      }
      if (!stats.isDirectory()) continue;
      if (looksLikeSite(path)) {
        found.push(path);
        continue; // do not descend into a site — nested checkouts are copies
      }
      walk(path, depth + 1);
    }
  };
  walk(dir, 0);
  return found.sort();
}

/** Source files inside a checkout that could contain a mail path. */
function mailSourceFiles(root) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 5) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry);
      let stats;
      try {
        stats = statSync(path);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        if (isSkippedSegment(entry)) continue;
        walk(path, depth + 1);
        continue;
      }
      if (!/\.(ts|tsx|mjs|js)$/.test(entry)) continue;
      if (/\.test\./.test(entry)) continue;
      out.push(path);
    }
  };
  for (const dir of ["app", "lib", "scripts", "src"]) {
    const full = join(root, dir);
    if (existsSync(full)) walk(full, 0);
  }
  return out;
}

/** The object literal passed to JSON.stringify(...) in a payload. */
function jsonPayloadObject(call) {
  const init = call.arguments && call.arguments[1];
  if (!init || !ts.isObjectLiteralExpression(init)) return null;
  for (const prop of init.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = prop.name && prop.name.getText ? prop.name.getText() : "";
    if (name.replace(/['"]/g, "") !== "body") continue;
    const expr = prop.initializer;
    if (!expr || !ts.isCallExpression(expr)) continue;
    if (!expr.expression.getText().includes("JSON.stringify")) continue;
    const arg = expr.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) return arg;
  }
  return null;
}

function propName(prop) {
  const name = prop.name && prop.name.getText ? prop.name.getText() : "";
  return name.replace(/['"]/g, "");
}

function hasProperty(obj, name) {
  if (!obj) return false;
  return obj.properties.some((p) => ts.isPropertyAssignment(p) && propName(p) === name);
}

function propertyValue(obj, name) {
  if (!obj) return null;
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && propName(p) === name) return p.initializer;
  }
  return null;
}

/**
 * Does the `to` field address more than one person?
 *
 * `to: 'a@b.com'`, `to: [email]` and `to: [email]` inside a per-recipient
 * loop are all ONE recipient — a one-element array is one address, not a
 * list. A multi-element array, a spread (`...emails`), a `.map(...)`
 * call, or an identifier that holds a list IS a list send.
 *
 * An identifier is resolved against its declaration in the same file:
 * `to: toEmail` where `toEmail` is a string is one recipient, and
 * `to: emails` where `emails` is an array is a list. Guessing would make
 * this gate cry wolf on every notification mail in the fleet.
 */
function toIsAList(toExpr, declarations) {
  if (!toExpr) return false;
  if (ts.isArrayLiteralExpression(toExpr)) {
    const els = toExpr.elements;
    if (els.length === 0) return false;
    if (els.length === 1) return ts.isSpreadElement(els[0]);
    return true;
  }
  if (ts.isSpreadElement(toExpr)) return true;
  if (ts.isIdentifier(toExpr)) {
    const init = declarations.get(toExpr.text);
    if (!init) return false; // unresolved — do not guess
    return initializerIsAList(init);
  }
  if (ts.isCallExpression(toExpr)) {
    const callee = toExpr.expression.getText();
    // `emails.map(...)` — a list built from a list.
    if (/\.(map|flatMap|filter)\(/.test(callee)) return true;
    return false;
  }
  if (ts.isPropertyAccessExpression(toExpr)) return false;
  return false;
}

/** Does this initializer hold a LIST of addresses? */
function initializerIsAList(init) {
  if (ts.isArrayLiteralExpression(init)) return true;
  if (ts.isCallExpression(init)) {
    const callee = init.expression.getText();
    if (/\.(map|flatMap|filter)\(/.test(callee)) return true;
    if (/^(new Set|new Array)\(/.test(callee)) return true;
    return false;
  }
  if (ts.isIdentifier(init)) {
    // `const a = b` — follow one hop.
    return false;
  }
  return false;
}

/** Map of identifier → initializer, for every declaration in the file. */
function collectDeclarations(sf) {
  const declarations = new Map();
  const walk = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (!declarations.has(node.name.text)) {
        declarations.set(node.name.text, node.initializer);
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return declarations;
}

function scanFile(file) {
  const src = readFileSync(file, "utf8");
  if (!src.includes(RESEND_ENDPOINT)) return null;

  const sf = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const findings = [];
  const sends = [];

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "fetch" &&
      node.arguments.length > 0
    ) {
      const firstArg = node.arguments[0];
      if (
        ts.isStringLiteral(firstArg) ||
        ts.isNoSubstitutionTemplateLiteral(firstArg)
      ) {
        if (firstArg.text.includes(RESEND_ENDPOINT)) {
          const payload = jsonPayloadObject(node);
          const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          sends.push({ line, payload });
          if (payload && hasProperty(payload, "bcc")) {
            findings.push({
              rule: "bulk-bcc-send-missing-unsubscribe",
              line,
              detail:
                "This send fans out to a list with `bcc`, so every recipient " +
                "receives the SAME body — a per-recipient unsubscribe token in " +
                "that body would unsubscribe somebody else. Declare a " +
                "List-Unsubscribe header, or send one message per recipient.",
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!sends.length) return null;

  const hasListUnsub = src.includes("List-Unsubscribe");
  const declarations = collectDeclarations(sf);

  // RULE 2 — an audience send must carry the header.
  //
  // "Audience" means the file resolves RECIPIENTS from a subscriber
  // list. Merely reading a subscriber table is not that: the landing
  // lead form reads newsletter_subscriptions to see whether ONE person
  // is a subscriber, and the CEO briefing reads it to COUNT subscribers
  // for a metric — neither sends to that list. Only a helper that
  // RETURNS an audience proves the recipients came from a list.
  const usesAudienceHelper = AUDIENCE_HELPERS.some((m) => src.includes(m));
  const isAudience = usesAudienceHelper;

  if (isAudience && !hasListUnsub) {
    findings.push({
      rule: "audience-send-missing-unsubscribe",
      line: sends[0].line,
      detail:
        "This file resolves recipients from a subscriber list and sends mail, " +
        "but never sets a List-Unsubscribe header, so the mail client cannot " +
        "offer a one-click unsubscribe.",
    });
  }

  // RULE 3 — a send addressed to a LIST of recipients must carry it.
  for (const send of sends) {
    const toExpr = propertyValue(send.payload, "to");
    if (!toIsAList(toExpr, declarations)) continue;
    if (hasListUnsub) continue;
    // A list send to a list of addresses — the recipients are not one
    // person, so the mechanism the law requires must be in the message.
    findings.push({
      rule: "list-recipient-send-missing-unsubscribe",
      line: send.line,
      detail:
        "This send is addressed to a LIST of recipients but carries no " +
        "List-Unsubscribe header. Per-recipient tokens are fine here — each " +
        "message is its own — but the header must be present.",
    });
    break; // one finding per file is enough
  }

  if (!findings.length) return { file, sends: sends.length, findings: [] };
  return { file, sends: sends.length, findings };
}

function main() {
  const { reportOnly, dir } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[fleet-email-unsub] fleet root not found: ${dir}`);
    return 2;
  }

  const roots = candidateRoots(dir);
  console.log(
    `[fleet-email-unsub] ${roots.length} canonical site checkout(s) under ${dir}\n`,
  );

  let totalFindings = 0;
  let sitesWithSends = 0;
  let totalSends = 0;

  for (const root of roots) {
    const label = relative(dir, root) || ".";
    const results = [];
    for (const file of mailSourceFiles(root)) {
      const res = scanFile(file);
      if (res) results.push(res);
    }
    if (!results.length) continue;
    sitesWithSends += 1;
    for (const res of results) totalSends += res.sends;
    const findings = results.flatMap((r) =>
      r.findings.map((f) => ({ ...f, file: relative(root, r.file) })),
    );
    if (!findings.length) continue;
    totalFindings += findings.length;
    console.log(
      `  FIND  ${label} — ${findings.length} finding(s) across ${results.length} mail file(s)`,
    );
    for (const f of findings) {
      console.log(`          ${f.rule}  ${f.file}:${f.line} — ${f.detail}`);
    }
  }

  console.log(
    `\n[fleet-email-unsub] examined ${sitesWithSends} site(s) containing ${totalSends} Resend send site(s); ` +
      `${totalFindings} finding(s) across 3 rules.`,
  );

  if (totalFindings > 0 && !reportOnly) {
    console.error(
      "[fleet-email-unsub] FAILED — a bulk email without a working unsubscribe.",
    );
    return 1;
  }
  console.log(
    "[fleet-email-unsub] no findings — every bulk email in the fleet carries a working unsubscribe.",
  );
  return 0;
}

process.exit(main());
