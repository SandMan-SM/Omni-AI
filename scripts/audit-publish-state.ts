// Static audit for the publish-state defect class that `tsc` and `next build`
// cannot see.
//
// Why this exists: the daily newsletter cron wrote an issue every day for 80
// days with `published_at` set and `status` left at its `'draft'` default.
// Every reader of `newsletter_posts` filters on
// `status = 'published' AND published_at IS NOT NULL`, so the cron logged
// `published: true` every single day and the issue existed nowhere — not on
// the issue page, not in the archive, not in the sitemap, not in the RSS.
//
// The table makes this failure silent by construction:
//
//   published_at  timestamptz  DEFAULT now()
//   status        text         DEFAULT 'draft'
//
// An INSERT that omits `published_at` is stamped with the current time as if
// it were published, and an INSERT that omits `status` is a draft. A writer
// that sets one and forgets the other produces a row that is half-published,
// and no type checker, linter or build step will ever say so.
//
//   publish-write-must-set-status
//       A write to `newsletter_posts` that sets `published_at` to anything
//       other than the literal `null` must set `status` in the SAME payload.
//       (Setting `published_at: null` explicitly is a draft and needs no
//       status — the column default is already 'draft'.)
//
//   newsletter-reader-must-filter-status
//       A READ of `newsletter_posts` that constrains `published_at` (to
//       non-null, or to a date range) must also constrain
//       `status = 'published'` in the same chain.
//
//       Why: the two markers can disagree, and 325 rows in the live table
//       DO disagree — `status = 'draft'` with a `published_at` timestamp.
//       Every reader that decided "this row is public" from `published_at`
//       alone advertised slugs that 404. The RSS feed, the Google News
//       sitemap, `llms.txt`, on-site search and the daily landing page's
//       newsletter handoff all shipped dead links until this rule existed;
//       `app/sitemap.ts` had already been fixed by hand, which is exactly
//       the drift a rule prevents.
//
//       Readers that legitimately want drafts (the studio, the admin
//       history, the sender) do not constrain `published_at` to non-null,
//       so they are not flagged.
//
// The rule walks the TypeScript AST rather than the source text, so a payload
// built as a variable (`const row = { … }; insert(row)`) is resolved and
// checked as well.
//
// Read-only. It never writes a file and never touches the network.
//
//   npx tsx scripts/audit-publish-state.ts            # report, exit 1 on findings
//   npx tsx scripts/audit-publish-state.ts --quiet    # summary only
//
// Exits 0 when clean so it can be wired into a pre-ship check.

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

type Finding = {
  rule: string;
  file: string;
  line: number;
  detail: string;
};

const ROOT = path.resolve(process.cwd());

/**
 * Every rule this gate knows about. The summary line reports this count, not
 * the count of rules that happened to fire — a gate that prints "0 findings
 * across 0 rules" reads like a gate that ran nothing. Any rule name used in
 * a finding must appear here, so a typo in a rule name cannot silently
 * disable the check that owns it.
 */
const RULE_NAMES = ["publish-write-must-set-status", "newsletter-reader-must-filter-status"];

const QUIET = process.argv.includes("--quiet");

/** Directories that can hold a write to `newsletter_posts`. */
const SCAN_DIRS = ["app", "lib", "components", "scripts"];

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs"];

const TABLE = "newsletter_posts";

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full, out);
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** Collect the property names of an object literal. */
function propertyNames(obj: ts.ObjectLiteralExpression): Set<string> {
  const names = new Set<string>();
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const name = prop.name;
      if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        names.add(name.text);
      }
    }
  }
  return names;
}

/**
 * True when the expression is the literal `null`. `published_at: null` is a
 * deliberate draft and is exempt from the rule; `published_at: someVar` is
 * not, because the value is unknown at lint time.
 */
function isNullLiteral(expr: ts.Expression): boolean {
  return (
    expr.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(expr) && expr.text === "null") ||
    (ts.isIdentifier(expr) && expr.text === "undefined")
  );
}

/**
 * Resolve the payload of a write call. Returns the object literal when it is
 * inline, or when it is a plain identifier that is initialised with an object
 * literal in the same file.
 */
function resolvePayload(
  arg: ts.Expression | undefined,
  literalsByName: Map<string, ts.ObjectLiteralExpression>
): ts.ObjectLiteralExpression | null {
  if (!arg) return null;
  if (ts.isObjectLiteralExpression(arg)) return arg;
  if (ts.isParenthesizedExpression(arg)) return resolvePayload(arg.expression, literalsByName);
  if (ts.isIdentifier(arg)) {
    const literal = literalsByName.get(arg.text);
    return literal ?? null;
  }
  return null;
}

/**
 * True when the call is a write on the `newsletter_posts` table — i.e. the
 * receiver chain reaches a `.from('newsletter_posts')` call.
 */
function isNewsletterPostsChain(expr: ts.Expression): boolean {
  let current: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(current)) {
    current = current.expression;
  }
  if (!ts.isCallExpression(current)) return false;
  const callee = current.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  if (callee.name.text !== "from") return false;
  const tableArg = current.arguments[0];
  return (
    !!tableArg &&
    (ts.isStringLiteral(tableArg) || ts.isNoSubstitutionTemplateLiteral(tableArg)) &&
    tableArg.text === TABLE
  );
}

/**
 * One method call in a Supabase query chain.
 */
type ChainStep = {
  name: string;
  args: readonly ts.Expression[];
  node: ts.CallExpression;
};

/**
 * Flatten a chained query builder call into its steps, outermost first.
 *
 * `supabase.from("newsletter_posts").select("*").eq("status", "published")`
 * becomes `[{name:"from"}, {name:"select"}, {name:"eq"}]`. The chain has to
 * be walked as a whole because the question the reader rule asks — "does
 * THIS query constrain status?" — is a property of the chain, not of any
 * single call.
 */
function chainSteps(root: ts.CallExpression): ChainStep[] {
  const steps: ChainStep[] = [];
  let current: ts.Expression = root;
  while (ts.isCallExpression(current)) {
    const callee = current.expression;
    if (!ts.isPropertyAccessExpression(callee)) break;
    steps.push({ name: callee.name.text, args: current.arguments, node: current });
    current = callee.expression;
  }
  return steps.reverse();
}

/** True when the expression is a string literal (plain or template). */
function stringValue(expr: ts.Expression | undefined): string | null {
  if (!expr) return null;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  return null;
}

/**
 * True when the call is a receiver inside a longer chain — i.e. it is not
 * the outermost call of its chain. Only the outermost call is analysed, so
 * one query produces one finding rather than one per step.
 */
function isChainReceiver(node: ts.CallExpression): boolean {
  const parent = node.parent;
  if (!parent || !ts.isPropertyAccessExpression(parent)) return false;
  const grandParent = parent.parent;
  return !!grandParent && ts.isCallExpression(grandParent) && grandParent.expression === parent;
}

/** Methods that write. The reader rule does not apply to them. */
const WRITE_METHODS = new Set(["insert", "update", "upsert", "delete"]);

/**
 * True when the chain constrains `published_at` in a way that treats a
 * non-null timestamp as meaningful — the exact decision that has to be
 * backed by `status`.
 *
 *   .not("published_at", "is", null)          → non-null
 *   .or("published_at.not.is.null,…")         → non-null (inside an OR group)
 *   .gte("published_at", …) / .lte(…)         → a date range
 *
 * `.is("published_at", null)` is the opposite — it selects drafts — and is
 * deliberately not counted.
 */
function constrainsPublishedAt(step: ChainStep): boolean {
  const first = stringValue(step.args[0]);
  if (first === null) return false;
  if (step.name === "not") return first === "published_at";
  if (step.name === "or") return first.includes("published_at");
  if (["gte", "lte", "gt", "lt"].includes(step.name)) return first === "published_at";
  return false;
}

/**
 * True when the chain pins `status` to 'published'.
 *
 * An `.or()` group that merely mentions `status.eq.published` does NOT
 * count: `published_at.not.is.null,status.eq.published` is satisfied by any
 * row with a published_at, which is the defect this rule exists to catch.
 */
function pinsStatusToPublished(steps: ChainStep[]): boolean {
  return steps.some((step) => {
    if (step.name === "eq") {
      return stringValue(step.args[0]) === "status" && stringValue(step.args[1]) === "published";
    }
    if (step.name === "in") {
      if (stringValue(step.args[0]) !== "status") return false;
      const values = step.args[1];
      if (!values || !ts.isArrayLiteralExpression(values)) return false;
      return values.elements.some((element) => stringValue(element) === "published");
    }
    return false;
  });
}

function auditFile(file: string): Finding[] {
  const findings: Finding[] = [];
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(TABLE)) return findings;

  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  // Object literals assigned to a `const`/`let` name, so a payload passed by
  // identifier can be resolved to the literal it was built from.
  const literalsByName = new Map<string, ts.ObjectLiteralExpression>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer) &&
      ts.isIdentifier(node.name)
    ) {
      literalsByName.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  const scan = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        ["update", "insert", "upsert"].includes(callee.name.text) &&
        isNewsletterPostsChain(callee.expression)
      ) {
        const payload = resolvePayload(node.arguments[0], literalsByName);
        if (payload) {
          const names = propertyNames(payload);
          const publishedAt = payload.properties.find(
            (p) =>
              ts.isPropertyAssignment(p) &&
              ts.isIdentifier(p.name) &&
              p.name.text === "published_at"
          );
          if (publishedAt && ts.isPropertyAssignment(publishedAt)) {
            if (!isNullLiteral(publishedAt.initializer) && !names.has("status")) {
              const { line } = source.getLineAndCharacterOfPosition(node.getStart());
              findings.push({
                rule: "publish-write-must-set-status",
                file: path.relative(ROOT, file),
                line: line + 1,
                detail:
                  `this write sets published_at (to a non-null value) without setting status in the same payload — the row will keep the 'draft' default and every reader filters on status = 'published', so the publish will be invisible`,
              });
            }
          }
        }
      }
    }
    ts.forEachChild(node, scan);
  };
  scan(source);

  // Reader rule — a read that decides visibility from `published_at` alone
  // advertises draft slugs that 404. The chain is analysed as a whole,
  // outermost call only, so one query yields one finding.
  const scanReaders = (node: ts.Node) => {
    if (ts.isCallExpression(node) && !isChainReceiver(node)) {
      const steps = chainSteps(node);
      const fromStep = steps.find((step) => step.name === "from");
      const table = fromStep ? stringValue(fromStep.args[0]) : null;
      const isWrite = steps.some((step) => WRITE_METHODS.has(step.name));
      if (table === TABLE && !isWrite) {
        const offending = steps.find(constrainsPublishedAt);
        if (offending && !pinsStatusToPublished(steps)) {
          const { line } = source.getLineAndCharacterOfPosition(offending.node.getStart());
          findings.push({
            rule: "newsletter-reader-must-filter-status",
            file: path.relative(ROOT, file),
            line: line + 1,
            detail:
              "this read constrains published_at without pinning status = 'published' — it will include draft-with-a-date rows, so every slug it lists can point at an issue that 404s; use publishedNewsletterOnly() from lib/newsletter-posts.ts",
          });
        }
      }
    }
    ts.forEachChild(node, scanReaders);
  };
  scanReaders(source);

  return findings;
}

function main() {
  const files = SCAN_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
  const findings: Finding[] = [];
  for (const file of files) {
    findings.push(...auditFile(file));
  }

  // Every rule name used in a finding must be registered above, so a typo in
  // a rule name cannot silently disable the check that owns it.
  for (const finding of findings) {
    if (!RULE_NAMES.includes(finding.rule)) {
      throw new Error(`unregistered rule name in finding: ${finding.rule}`);
    }
  }

  if (!QUIET) {
    for (const f of findings) {
      console.log(`${f.file}:${f.line}  ${f.rule}  ${f.detail}`);
    }
  }

  console.log(
    `\nscanned ${files.length} file(s) — ${findings.length} finding(s) across ${RULE_NAMES.length} rule(s)`
  );
  if (findings.length === 0) {
    console.log(`No publish-state findings.`);
  }
  process.exit(findings.length > 0 ? 1 : 0);
}

main();
