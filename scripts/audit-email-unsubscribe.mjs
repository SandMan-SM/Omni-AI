#!/usr/bin/env node
/**
 * audit:email-unsubscribe — every bulk/list email must carry a working
 * unsubscribe mechanism.
 *
 * WHY THIS GATE EXISTS
 *
 * The Interlinked newsletter (the product's flagship email, sent to the
 * whole free + premium audience) had NO unsubscribe link, no
 * `List-Unsubscribe` header and no one-click support. Its footer linked
 * "Manage subscription" / "Manage account" at `${SITE_URL}/dashboard` —
 * the legacy INTERNAL operator surface, which is noindex, robots-
 * disallowed, sign-in-gated, and explicitly not the canonical operator
 * dashboard (mythosais.com/dashboard). A subscriber clicking it landed on
 * a command center they cannot use, and the mechanism CAN-SPAM requires
 * was not in the message at all.
 *
 * The federation masthead dispatch had the same defect: one shared HTML
 * body BCC'd to 50 subscribers, carrying only "Read on the web".
 *
 * Neither defect is visible to `tsc`, `next build`, the RLS gate, the
 * cron-auth gate, the public-PII gate or the live mobile audit. The
 * unsubscribe *infrastructure* was complete and already used by four
 * other mail paths in this same repo — `buildUnsubscribeUrl()` (HMAC
 * token over the recipient address) and `/api/newsletter/unsubscribe`
 * (GET + RFC 8058 one-click POST). The contract "a bulk email carries a
 * working unsubscribe" held in four of six mail paths and nothing
 * compared them.
 *
 * THE GENERAL FORM
 *
 * A rule that one path in a repo obeys and another path in the same repo
 * breaks is not a rule until something compares the paths. Here the
 * comparison is: every send whose recipients come from a subscriber list
 * must mint a per-recipient unsubscribe URL and advertise it (RFC 8058
 * headers + a visible link in the body).
 *
 * RULES
 *   1. bulk-bcc-send-missing-unsubscribe
 *      A Resend send that fans out to a list with `bcc` shares ONE body
 *      across every recipient, so it cannot carry a per-recipient token
 *      link — and a token link that unsubscribes somebody else is worse
 *      than no link. Such a send must declare a List-Unsubscribe header,
 *      which forces the author to confront the shared-body problem.
 *
 *   2. audience-send-missing-unsubscribe
 *      A file that resolves recipients from a subscriber audience
 *      (`getNewsletterAudience`, `audienceSendList`,
 *      `loadSubscriberEmails`) and sends mail must mint an unsubscribe URL
 *      AND set a List-Unsubscribe header.
 *
 *   3. unsubscribe-url-not-used
 *      Minting an unsubscribe URL and then dropping it (never putting it
 *      in the body or the headers) is the same defect wearing a fix's
 *      clothes. The identifier holding the URL must be used again.
 *
 * SCOPE
 *   Only files that actually call the Resend API are examined, and only
 *   transactional one-to-one sends are exempt — a booking receipt or a
 *   lead notification has no list to unsubscribe from, and flagging it
 *   would be a gate that cries wolf.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SCAN_DIRS = ['lib', 'app'];
const RESEND_ENDPOINT = 'api.resend.com/emails';

const RULE_NAMES = [
  'bulk-bcc-send-missing-unsubscribe',
  'audience-send-missing-unsubscribe',
  'unsubscribe-url-not-used',
];

// Helpers that resolve a RECIPIENT LIST of subscribers. A file that calls
// one of these and sends mail is sending to a list, not to one person.
const AUDIENCE_MARKERS = [
  'getNewsletterAudience(',
  'audienceSendList(',
  'loadSubscriberEmails(',
];

const findings = [];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry) && !/\.test\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p);
}

/** Find the object literal passed to JSON.stringify(...) in a payload. */
function jsonPayloadObject(call) {
  const args = call.arguments || [];
  const init = args[1];
  if (!init || !ts.isObjectLiteralExpression(init)) return null;
  for (const prop of init.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = prop.name && prop.name.getText ? prop.name.getText() : '';
    if (name !== 'body') continue;
    const expr = prop.initializer;
    if (!ts.isCallExpression(expr)) continue;
    const callee = expr.expression.getText();
    if (!callee.includes('JSON.stringify')) continue;
    const arg = expr.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) return arg;
  }
  return null;
}

function hasProperty(obj, name) {
  if (!obj) return false;
  return obj.properties.some((p) => {
    if (!ts.isPropertyAssignment(p)) return false;
    const n = p.name && p.name.getText ? p.name.getText() : '';
    return n.replace(/['"]/g, '') === name;
  });
}

function sourceHas(text, needle) {
  return text.includes(needle);
}

function scanFile(file) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes(RESEND_ENDPOINT)) return { sends: 0 };

  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let sends = 0;

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'fetch' &&
      node.arguments.length > 0
    ) {
      const firstArg = node.arguments[0];
      if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
        if (firstArg.text.includes(RESEND_ENDPOINT)) {
          sends += 1;
          const payload = jsonPayloadObject(node);
          const payloadText = payload ? payload.getText() : '';

          // RULE 1 — a BCC fan-out shares one body across every recipient.
          if (hasProperty(payload, 'bcc')) {
            if (!payloadText.includes('List-Unsubscribe')) {
              findings.push({
                rule: 'bulk-bcc-send-missing-unsubscribe',
                file: rel(file),
                line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
                detail:
                  'This send fans out to a list with `bcc`, so every recipient ' +
                  'receives the SAME body — a per-recipient unsubscribe token in ' +
                  'that body would unsubscribe somebody else. Declare a ' +
                  'List-Unsubscribe header, or send one message per recipient.',
              });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  // RULE 2 — a send to a subscriber audience must carry the mechanism.
  if (sends > 0 && AUDIENCE_MARKERS.some((m) => src.includes(m))) {
    if (!src.includes('buildUnsubscribeUrl(')) {
      findings.push({
        rule: 'audience-send-missing-unsubscribe',
        file: rel(file),
        line: 1,
        detail:
          'This file resolves recipients from a subscriber audience and sends ' +
          'mail, but never mints an unsubscribe URL. Every bulk email needs a ' +
          'working one-click unsubscribe — use buildUnsubscribeUrl() from ' +
          'lib/unsubscribe-token.',
      });
    } else if (!src.includes('List-Unsubscribe')) {
      findings.push({
        rule: 'audience-send-missing-unsubscribe',
        file: rel(file),
        line: 1,
        detail:
          'This file sends to a subscriber audience but never sets a ' +
          'List-Unsubscribe header, so Gmail / Apple Mail cannot offer a ' +
          'native one-click unsubscribe (RFC 8058).',
      });
    }
  }

  // RULE 3 — a minted URL must actually be used.
  //
  // Only READS count. The declaration (`const x = …`) and the assignment
  // target (`x = …`) are the mint itself, not a use — counting them would
  // make every minted URL look used, which is exactly the bug the rule
  // exists to catch.
  const minted = new Map(); // name → { scope, declName?, assignTarget? }
  const reads = new Map();

  /** The nearest enclosing function of a node, or the source file. */
  function scopeOf(node) {
    let cur = node.parent;
    while (cur) {
      if (
        ts.isFunctionDeclaration(cur) ||
        ts.isFunctionExpression(cur) ||
        ts.isArrowFunction(cur) ||
        ts.isMethodDeclaration(cur)
      ) {
        return cur;
      }
      cur = cur.parent;
    }
    return sf;
  }

  const collect = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'buildUnsubscribeUrl'
    ) {
      const parent = node.parent;
      if (parent && ts.isVariableDeclaration(parent)) {
        const name = parent.name.getText();
        const prev = minted.get(name) || {};
        minted.set(name, { ...prev, scope: scopeOf(node), declName: parent.name });
      } else if (parent && ts.isBinaryExpression(parent) && parent.left) {
        const name = parent.left.getText();
        const prev = minted.get(name) || {};
        minted.set(name, { ...prev, scope: scopeOf(node), assignTarget: parent.left });
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(sf);

  // Count reads of every minted identifier, WITHIN the scope it was minted
  // in. Scoping matters: an unrelated function that happens to use the same
  // parameter name is not a use of the minted URL, and counting it would
  // hide a dropped token.
  const countReadsIn = (name, target) => {
    let count = 0;
    const walk = (node) => {
      if (ts.isIdentifier(node) && node.text === name) {
        const isDeclarationName =
          ts.isVariableDeclaration(node.parent) && node.parent.name === node;
        const isAssignmentTarget =
          target.assignTarget && target.assignTarget === node;
        if (!isDeclarationName && !isAssignmentTarget) count += 1;
      }
      ts.forEachChild(node, walk);
    };
    walk(target.scope);
    return count;
  };

  for (const [name, target] of minted) {
    reads.set(name, countReadsIn(name, target));
  }

  for (const name of minted.keys()) {
    const count = reads.get(name) || 0;
    // Zero reads means the URL was minted and never carried into the body
    // or the headers.
    if (count < 1) {
      findings.push({
        rule: 'unsubscribe-url-not-used',
        file: rel(file),
        line: 1,
        detail:
          `\`${name}\` is assigned from buildUnsubscribeUrl() and never used ` +
          'again, so the unsubscribe URL never reaches the email body or the ' +
          'List-Unsubscribe header. Minting a token and dropping it is the ' +
          'same defect wearing a fix\'s clothes.',
      });
    }
  }

  return { sends };
}

// ── Run ─────────────────────────────────────────────────────────────────────

const files = [];
for (const dir of SCAN_DIRS) {
  const full = path.join(ROOT, dir);
  try {
    if (statSync(full).isDirectory()) walk(full, files);
  } catch {
    /* directory absent — nothing to scan */
  }
}

let sendSites = 0;
let filesWithSends = 0;
for (const file of files) {
  const { sends } = scanFile(file);
  if (sends > 0) {
    sendSites += sends;
    filesWithSends += 1;
  }
}

findings.sort((a, b) =>
  a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
);

for (const f of findings) {
  console.error(`[email-unsubscribe] ${f.file}:${f.line} — ${f.rule}`);
  console.error(`    ${f.detail}`);
}

console.log(
  `[email-unsubscribe] examined ${filesWithSends} file(s) containing ${sendSites} Resend send site(s); ` +
    `${findings.length} finding(s) across ${RULE_NAMES.length} rules.`,
);

if (findings.length > 0) {
  console.error('[email-unsubscribe] FAILED — a bulk email without a working unsubscribe.');
  process.exit(1);
}
console.log('[email-unsubscribe] no findings — every bulk email carries a working unsubscribe.');
