// Static audit for the anon-key / RLS defect class.
//
// Why this exists: a query built with the ANON key against a table whose RLS
// is locked to `service_role` returns HTTP 200 with an EMPTY ARRAY — not an
// error. The caller cannot tell "no rows" from "not allowed to see rows", so
// the defect is invisible in the response and loud in the product.
//
// This is not hypothetical. `omni_leads_generated` holds 486 rows that the
// anon key cannot see; `omni_businesses` holds 24. A server route handler
// that reads either with the anon key answers 200 with `[]` — the dashboard
// shows no leads and no one can tell why. Writes fail the same silent way:
// the route reports success, the row was never written.
//
// Neither `tsc` nor `next build` can see this. Only a live probe can, which
// is why `scripts/probe-anon-rls.mjs` exists and why its output is committed
// as `scripts/anon-locked-tables.json`.
//
// Rules:
//   server-stateless-anon-locked-table
//                                A server-side file queries a locked table
//                                with a STATELESS anon client — one built
//                                from the anon key with no user session.
//                                Such a client never carries an
//                                `auth.uid()`, so a row-scoped policy can
//                                never match: every read returns [] and
//                                every write silently no-ops. This is the
//                                defect class, and it is unambiguous.
//   server-session-anon-locked-table
//                                A server-side file queries a locked table
//                                with a SESSION client (cookie-bound).
//                                Correct for a user's OWN rows; broken for
//                                operator tables that only the service
//                                role may read. Reviewed per-table — the
//                                user-scoped ones are listed in
//                                USER_SCOPED_TABLES and are not findings.
//   browser-anon-locked-table     A browser ("use client") file queries a
//                                locked table. The browser can never hold
//                                the service role, so this has to be
//                                proxied through an admin-gated API route.
//   server-dynamic-anon-table     A server-side file queries a table whose
//                                NAME IS NOT A LITERAL on a non-admin
//                                client. The table cannot be checked
//                                against the rule set, so the read cannot
//                                be cleared — at runtime the name may be
//                                a locked table, and the anon key would
//                                answer 200 with an empty array. This is
//                                exactly how `/api/agi/stats` reported
//                                "0 leads, 0 businesses, 0 activity" on a
//                                platform holding 490 leads: the table
//                                names came from an array, so no static
//                                rule could see them.
//   browser-dynamic-anon-table    The same, in a browser file.
//   table-not-in-schema           A file queries a table NAME THAT THE LIVE
//                                SCHEMA DOES NOT HAVE. PostgREST answers
//                                that with an error, so the feature is
//                                broken at runtime: the rows never come
//                                back and the code reports "no data".
//
// Read-only. Never writes a file, never touches the network.
//
//   npx tsx scripts/audit-anon-rls.ts            # report, exit 1 on findings
//   npx tsx scripts/audit-anon-rls.ts --quiet    # summary only
//
// To refresh the locked-table list against the live schema:
//   node scripts/probe-anon-rls.mjs --json
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

/**
 * Every rule this gate knows about. The summary line reports this count, not
 * the count of rules that happened to fire — a gate that prints "0 findings
 * across 0 rules" reads like a gate that ran nothing. Any rule name used in
 * a finding must appear here, so a typo in a rule name cannot silently
 * disable the check that owns it.
 */
const RULE_NAMES = [
  "server-stateless-anon-locked-table",
  "server-session-anon-locked-table",
  "browser-anon-locked-table",
  "server-dynamic-anon-table",
  "browser-dynamic-anon-table",
  "table-not-in-schema",
];

/**
 * Locked tables whose rows belong to the signed-in USER, and which are
 * therefore correctly read through a cookie-bound session client.
 *
 * Everything else in the locked set is operator data: the anon key cannot
 * see it even with a session, so a session client returns [] there too and
 * the route has to use the service role.
 *
 * `profiles` is the canonical example: its policy is `auth.uid() = id`, so a
 * session client sees the caller's own row and only their own row. Swapping
 * it for the service role would hand one tenant another tenant's profile.
 *
 * `newsletter_subscriptions` is deliberately NOT here: the subscriber list
 * is operator data (the admin screen reads every row), so a session client
 * returns [] there too.
 */
const USER_SCOPED_TABLES = new Set(["profiles"]);

const ROOT = path.resolve(process.cwd());

const LOCKED_TABLES_FILE = path.join(ROOT, "scripts", "anon-locked-tables.json");

/**
 * Why the rule set could not be used, if it could not be used.
 *
 * "Could not be checked" is not one condition. A tree with no rule set at
 * all, a tree with a rule set in the OLD format (which carried the locked
 * table names but not the schema's table list), and a tree whose rule set is
 * empty are three different problems with three different fixes, and a
 * sweep that reports them all as "the copy has no rule set" teaches the
 * reader the wrong thing about the fleet.
 */
type RuleSetStatus = "ok" | "missing" | "unreadable" | "stale" | "empty";

function loadRuleSet(): {
  locked: Set<string>;
  indeterminate: Set<string>;
  anonReadable: Set<string>;
  schemaTables: Set<string>;
  status: RuleSetStatus;
} {
  const empty = {
    locked: new Set<string>(),
    indeterminate: new Set<string>(),
    anonReadable: new Set<string>(),
    schemaTables: new Set<string>(),
    status: "missing" as RuleSetStatus,
  };
  let text: string;
  try {
    text = fs.readFileSync(LOCKED_TABLES_FILE, "utf8");
  } catch {
    return { ...empty, status: fs.existsSync(LOCKED_TABLES_FILE) ? "unreadable" : "missing" };
  }
  let raw: {
    locked?: string[];
    indeterminate?: string[];
    anonReadable?: string[];
    schemaTables?: string[];
  };
  try {
    raw = JSON.parse(text);
  } catch {
    return { ...empty, status: "unreadable" };
  }
  const locked = new Set(raw.locked || []);
  const indeterminate = new Set(raw.indeterminate || []);
  const anonReadable = new Set(raw.anonReadable || []);
  const schemaTables = new Set(raw.schemaTables || []);
  // A rule set without the schema's table list is the previous format. It
  // can still say which tables are locked, but the gate cannot tell "this
  // table does not exist" from "this table is locked", so it cannot run the
  // full rule set — and it is missing 136 locked tables besides.
  const status: RuleSetStatus =
    !schemaTables.size
      ? "stale"
      : !locked.size && !indeterminate.size
        ? "empty"
        : "ok";
  return { locked, indeterminate, anonReadable, schemaTables, status };
}

const RULE_SET = loadRuleSet();

/**
 * The tables the anon key cannot read.
 *
 * `indeterminate` is folded in on purpose: those are the tables the live
 * probe could not classify without risking a write, and the gate fails
 * closed — an unknown table is treated as a locked one, because the cost
 * of a false positive is one line of review and the cost of a false
 * negative is a screen that reports zeros as if they were results.
 */
const LOCKED = new Set<string>([
  ...RULE_SET.locked,
  ...RULE_SET.indeterminate,
]);

/** Every table the live schema has, so a name can be checked for existence. */
const SCHEMA_TABLES = RULE_SET.schemaTables;

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".next-prod",
  ".turbo",
  ".git",
  "dist",
  "coverage",
]);

const SCAN_ROOTS = ["app", "components", "lib", "hooks", "server", "shared", "middleware.ts"];

/** Modules whose exported client is KNOWN to be anon-key backed. */
const ANON_CLIENT_MODULES = new Set([
  "@/lib/supabase/server",
  "@/lib/agi-supabase",
  "@/lib/supabase/client",
  "@/lib/supabase",
]);

/** Modules whose exported client is the service role. */
const ADMIN_CLIENT_MODULES = new Set(["@/lib/supabase/admin"]);

/** Identifiers that mean "this call is using the anon key". */
const ANON_KEY_NAMES = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

function isAnonKeyExpression(node: ts.Node): boolean {
  const text = node.getText();
  for (const name of ANON_KEY_NAMES) {
    if (text.includes(name)) return true;
  }
  return false;
}

/**
 * How a Supabase client was built.
 *
 *  admin    — service role. Bypasses RLS. Correct behind an auth gate.
 *  session  — cookie-bound, carries `auth.uid()`. Correct for a user's own
 *             rows; sees nothing for service-role-only tables.
 *  browser  — a browser client (`createBrowserClient`). It carries the
 *             user's persisted session, so `auth.uid()` resolves exactly
 *             like the cookie-bound server client. It is a DIFFERENT case
 *             from `stateless`, and conflating the two produces false
 *             positives on every user-scoped table.
 *  stateless— built from the anon key with NO session. Never carries an
 *             `auth.uid()`, so it can only see publicly-readable tables.
 */
type ClientKind = "admin" | "session" | "browser" | "stateless";

type FileInfo = {
  file: string;
  isClient: boolean;
  clients: Map<string, ClientKind>;
  anonImported: Set<string>;
  adminImported: Set<string>;
};

function collectFiles(): string[] {
  const out: string[] = [];
  for (const entry of SCAN_ROOTS) {
    const abs = path.join(ROOT, entry);
    if (!fs.existsSync(abs)) continue;
    const stat = fs.statSync(abs);
    if (stat.isFile()) {
      if (/\.(ts|tsx)$/.test(entry)) out.push(abs);
      continue;
    }
    walk(abs, out);
  }
  return out;
}

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
}

function isUseClient(source: ts.SourceFile): boolean {
  for (const stmt of source.statements) {
    if (ts.isExpressionStatement(stmt)) {
      const expr = stmt.expression;
      if (ts.isStringLiteral(expr) && expr.text === "use client") return true;
    }
    if (!ts.isImportDeclaration(stmt)) break;
  }
  return false;
}

function moduleOf(importDecl: ts.ImportDeclaration): string {
  const spec = importDecl.moduleSpecifier;
  return ts.isStringLiteral(spec) ? spec.text : "";
}

/**
 * The `@supabase/ssr` server client binds the caller's cookie to the
 * request, so `auth.uid()` resolves. The browser client and the bare
 * `@supabase/supabase-js` client do not.
 */
function isSessionBuilder(calleeText: string, args: readonly ts.Expression[]): boolean {
  if (calleeText.endsWith("createServerClient")) return true;
  // `createClient()` imported from the cookie-aware server module.
  if (calleeText.endsWith("createClient") && args.length === 0) return true;
  // A server client built with an explicit cookie adapter.
  return args.some((a) => /cookie/i.test(a.getText()));
}

function classifyInitializer(
  init: ts.Expression,
  source: ts.SourceFile,
  info?: FileInfo,
): ClientKind | null {
  // `await createClient()` and `(createClient())` are the same call.
  let expr = init;
  while (
    ts.isAwaitExpression(expr) ||
    ts.isParenthesizedExpression(expr) ||
    ts.isAsExpression(expr) ||
    ts.isNonNullExpression(expr)
  ) {
    expr = expr.expression;
  }
  if (!ts.isCallExpression(expr)) return null;
  const callee = expr.expression;
  const calleeText = callee.getText(source);

  if (
    calleeText.endsWith("createAdminClient") ||
    calleeText.endsWith("createLazyAdminClient")
  ) {
    return "admin";
  }
  if (
    calleeText.endsWith("createClient") ||
    calleeText.endsWith("createServerClient") ||
    calleeText.endsWith("createBrowserClient")
  ) {
    if (calleeText.endsWith("createBrowserClient")) return "browser";
    return isSessionBuilder(calleeText, expr.arguments) ? "session" : "stateless";
  }
  // A client obtained by CALLING one of the imported helpers, e.g.
  // `const supabase = await getSupabase()`. Without this, the client
  // resolved as "unknown" and every rule that depends on knowing which
  // key a client carries quietly stopped applying to it.
  if (info) {
    if (info.adminImported.has(calleeText)) return "admin";
    if (info.anonImported.has(calleeText)) {
      const kind = info.clients.get(calleeText);
      if (kind) return kind;
    }
  }
  return null;
}

function analyzeFile(abs: string): FileInfo {
  const text = fs.readFileSync(abs, "utf8");
  const source = ts.createSourceFile(
    abs,
    text,
    ts.ScriptTarget.Latest,
    true,
    abs.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const info: FileInfo = {
    file: path.relative(ROOT, abs),
    isClient: isUseClient(source),
    clients: new Map(),
    anonImported: new Set(),
    adminImported: new Set(),
  };

  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const mod = moduleOf(stmt);
    const clause = stmt.importClause;
    if (!clause) continue;

    if (ANON_CLIENT_MODULES.has(mod)) {
      // Which module a client comes from decides what it can see:
      //   `@/lib/supabase/server`  — cookie-bound, carries auth.uid()
      //   `@/lib/supabase/client`  — browser client, carries the session
      //   `@/lib/supabase`         — re-exports the browser client
      //   `@/lib/agi-supabase`     — a bare anon client, no session
      const kind: ClientKind =
        mod === "@/lib/supabase/server"
          ? "session"
          : mod === "@/lib/agi-supabase"
            ? "stateless"
            : "browser";
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) {
          const local = el.name.text;
          info.anonImported.add(local);
          info.clients.set(local, kind);
        }
      }
      if (clause.name) {
        info.anonImported.add(clause.name.text);
        info.clients.set(clause.name.text, kind);
      }
    }

    if (ADMIN_CLIENT_MODULES.has(mod)) {
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) {
          info.adminImported.add(el.name.text);
          info.clients.set(el.name.text, "admin");
        }
      }
      if (clause.name) {
        info.adminImported.add(clause.name.text);
        info.clients.set(clause.name.text, "admin");
      }
    }
  }

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const name = node.name.getText(source);
      const kind = classifyInitializer(node.initializer, source, info);
      if (kind) {
        info.clients.set(name, kind);
      } else {
        // `const sb = supabase` — an alias of an already-classified client.
        let expr = node.initializer;
        while (
          ts.isAwaitExpression(expr) ||
          ts.isParenthesizedExpression(expr) ||
          ts.isAsExpression(expr) ||
          ts.isNonNullExpression(expr)
        ) {
          expr = expr.expression;
        }
        if (ts.isIdentifier(expr)) {
          const aliased = info.clients.get(expr.text);
          if (aliased) info.clients.set(name, aliased);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return info;
}

/** Resolve the kind of the client a `.from()` call is made on. */
function resolveClientKind(
  receiver: ts.Expression,
  info: FileInfo,
): ClientKind | "unknown" {
  let name: string | null = null;
  if (ts.isIdentifier(receiver)) {
    name = receiver.text;
  } else if (
    ts.isPropertyAccessExpression(receiver) &&
    ts.isIdentifier(receiver.expression)
  ) {
    name = receiver.expression.text;
  }
  if (!name) return "unknown";
  const kind = info.clients.get(name);
  if (kind) return kind;
  if (info.adminImported.has(name)) return "admin";
  if (info.anonImported.has(name)) return "stateless";
  return "unknown";
}

function scanFromCalls(abs: string, info: FileInfo): Finding[] {
  const findings: Finding[] = [];
  const text = fs.readFileSync(abs, "utf8");
  const source = ts.createSourceFile(
    abs,
    text,
    ts.ScriptTarget.Latest,
    true,
    abs.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "from" &&
        node.arguments.length > 0
      ) {
        const arg = node.arguments[0];
        const kind = resolveClientKind(callee.expression, info);
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

        // The table name is not a literal, so the rule set cannot say
        // which table this is. On a non-admin client that is unresolvable:
        // the name may be a locked table at runtime, and the anon key
        // answers 200 with an empty array. `/api/agi/stats` was exactly
        // this — an array of table names, read with the anon key, and
        // every count came back 0 while the platform held 490 leads.
        if (!ts.isStringLiteral(arg)) {
          if (kind === "stateless" || kind === "session" || kind === "browser") {
            findings.push({
              rule: info.isClient || kind === "browser"
                ? "browser-dynamic-anon-table"
                : "server-dynamic-anon-table",
              file: info.file,
              line,
              detail:
                `${kind} client reads a table whose name is not a literal ` +
                `(${arg.getText(source).slice(0, 40)}) — the rule set cannot ` +
                `clear it, and at runtime it may be a locked table the anon ` +
                `key cannot see`,
            });
          }
          ts.forEachChild(node, visit);
          return;
        }

        const table = arg.text;

        // The table does not exist. PostgREST answers that with an error,
        // so the read never returns rows and the feature reports "no
        // data" for a reason that has nothing to do with the data.
        if (SCHEMA_TABLES.size > 0 && !SCHEMA_TABLES.has(table)) {
          if (kind !== "unknown") {
            findings.push({
              rule: "table-not-in-schema",
              file: info.file,
              line,
              detail: `queries table "${table}" — the live schema has no such table, so this read errors and always yields nothing`,
            });
          }
          ts.forEachChild(node, visit);
          return;
        }

        if (!LOCKED.has(table) || kind === "admin") {
          ts.forEachChild(node, visit);
          return;
        }

        if (info.isClient || kind === "browser") {
          // A browser client carries the user's session, so it may read
          // the caller's OWN rows (the user-scoped tables) and nothing
          // else. Everything else is service-role-only, and the browser
          // answers 200 with an empty array.
          if (!USER_SCOPED_TABLES.has(table)) {
            findings.push({
              rule: "browser-anon-locked-table",
              file: info.file,
              line,
              detail: `browser reads locked table "${table}" — the anon key sees 0 rows, so this always renders empty`,
            });
          }
        } else if (kind === "stateless") {
          findings.push({
            rule: "server-stateless-anon-locked-table",
            file: info.file,
            line,
            detail: `stateless anon client queries locked table "${table}" — no session, so it returns [] and writes silently no-op`,
          });
        } else if (kind === "session" && !USER_SCOPED_TABLES.has(table)) {
          findings.push({
            rule: "server-session-anon-locked-table",
            file: info.file,
            line,
            detail: `session client queries locked table "${table}" — this table is service-role-only, so the session client sees [] too`,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return findings;
}

function main() {
  const quiet = process.argv.includes("--quiet");
  const findings: Finding[] = [];
  const files = collectFiles();

  for (const abs of files) {
    const info = analyzeFile(abs);
    findings.push(...scanFromCalls(abs, info));
  }

  // Stable ordering so the report is diffable.
  findings.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.rule.localeCompare(b.rule),
  );

  if (!quiet) {
    for (const f of findings) {
      console.log(`${f.rule}  ${f.file}:${f.line}\n    ${f.detail}`);
    }
  }

  const known = new Set(RULE_NAMES);
  for (const f of findings) {
    if (!known.has(f.rule)) {
      console.error(`unknown rule name in finding: ${f.rule}`);
      process.exit(1);
    }
  }

  // A gate whose rules did not run has not established anything.
  //
  // The locked-table list is the RULE SET: without it the three rules have
  // no tables to check, the scan finds nothing because there is nothing to
  // find, and the gate exits 0 — a clean result it never earned. This is
  // not theoretical: running this gate in any tree that predates
  // `scripts/anon-locked-tables.json` (30 of the 32 deployable copies of
  // this repo) printed "0 findings" and exited 0 while checking nothing.
  //
  // So the precondition is checked FIRST and fails closed: exit 2 with the
  // reason, and never print the "scanned N files — 0 findings" line, which
  // reads as a clean scan.
  if (LOCKED.size === 0 || SCHEMA_TABLES.size === 0) {
    const why =
      RULE_SET.status === "stale"
        ? "scripts/anon-locked-tables.json is in the OLD format — it carries the locked table names " +
          "but not the schema's table list, so the gate cannot tell a missing table from a locked one"
        : RULE_SET.status === "missing"
          ? "scripts/anon-locked-tables.json is missing"
          : RULE_SET.status === "unreadable"
            ? "scripts/anon-locked-tables.json could not be parsed"
            : "scripts/anon-locked-tables.json is empty";
    console.error(
      `[anon-rls] ${why}, so the locked-table rules did NOT run. ` +
        "This is not a clean result — the gate checked nothing. " +
        "Refresh it with: node scripts/probe-anon-rls.mjs --json",
    );
    process.exit(2);
  }

  console.log(
    `\nscanned ${files.length} files — ${findings.length} finding(s) across ${RULE_NAMES.length} rules`,
  );
  if (findings.length > 0) process.exit(1);
}

main();
