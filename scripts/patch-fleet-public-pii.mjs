#!/usr/bin/env node
/**
 * Close the public-PII defect in every fleet copy that still carries it.
 *
 * Why this exists
 *
 * `GET /api/agents/rankings` is a PUBLIC leaderboard — the `/arena` cards
 * read it — and its response carried `ownerName`, the real name of each
 * business's owner. Ten people, including the operator's own. The canonical
 * surface was fixed in `cb9be49c`: the `name` column is no longer selected
 * for an anonymous caller, and the field is absent from the response.
 *
 * The defect class travels BY COPY, and **every one of the 32 copies of
 * this repo in the fleet still carried the pre-fix route, byte-identical to
 * the canonical file before the fix** — so a `vercel --prod` from any of
 * those folders would publish the owners' real names again. A copy with a
 * `.vercel` link is one command away from production.
 *
 * A SECOND instance of the class was found by the gate this script ships
 * with the rule set: `GET /api/newsletter` returned the whole subscriber
 * list — `select("*")` over `newsletter_subscriptions`, which holds every
 * reader's email — to a caller with no authentication of any kind. The
 * canonical surface had already been hardened (an explicit `requireAdmin()`
 * gate, with a comment saying not to rely on RLS returning zero rows), and
 * four copies still carried the pre-fix shape. That one was found by
 * MEASUREMENT, not by reading, which is the point of shipping the gate.
 *
 * A THIRD defect lives in the same route and is not a privacy defect but
 * rides along with it: the leaderboard sorted on `elo_rating` alone, which
 * is not unique, so tied agents came back in an arbitrary order and the
 * public leaderboard reshuffled between requests. The fix is the same
 * minimal edit in every copy.
 *
 * What it does
 *
 * It rewrites the affected route in each copy that still holds the pre-fix
 * shape, applying the SAME minimal edit as the canonical fix. Every
 * replacement is an exact-match substitution, and a file is only rewritten
 * when **all** of its replacements match. A file that matches only some of
 * them is reported and left alone, because a partial rewrite is how a
 * subtle bug gets shipped.
 *
 * No application code beyond those two routes is touched. A stale copy may
 * carry other work (an AIS receiver, a payments launch) that a wholesale
 * re-sync would destroy, and those trees remain the operator's decision.
 *
 * Usage:
 *   node scripts/patch-fleet-public-pii.mjs                # patch every copy
 *   node scripts/patch-fleet-public-pii.mjs --dir <path>   # patch another root
 *   node scripts/patch-fleet-public-pii.mjs --dry-run      # report only
 *
 * Exit codes: 0 nothing left to patch, 1 something was skipped, 2 bad root.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";

/**
 * The route classes this script knows how to repair.
 *
 * `from` strings must appear verbatim, and every `from` in a class must be
 * present for that class's patch to apply.
 */
const ROUTE_CLASSES = [
  {
    id: "rankings-owner-name",
    route: join("app", "api", "agents", "rankings", "route.ts"),
    /** Does this copy still carry the defect? */
    exposed(text) {
      return /ownerName\s*:\s*p\.name/.test(text);
    },
    describe:
      "ownerName is now admin-only and the `name` column is not selected for anonymous callers",
    replacements: [
      {
        id: "import-require-admin",
        from: ["import { createAdminClient } from '@/lib/supabase/admin';"].join("\n"),
        to: [
          "import { createAdminClient } from '@/lib/supabase/admin';",
          "import { requireAdmin } from '@/lib/admin-auth';",
        ].join("\n"),
      },
      {
        id: "admin-check",
        from: [
          "  noStore();",
          "  const sb = createAdminClient();",
          "",
          "  // Fetch profiles with business names (include admins with agent_name set).",
        ].join("\n"),
        to: [
          "  noStore();",
          "  const sb = createAdminClient();",
          "",
          "  // Is the caller an operator? The leaderboard is a PUBLIC surface (the",
          "  // /arena cards read it), and the response carries one field that is not",
          "  // public data: `ownerName`, the personal name of each business's owner.",
          "  // No public surface renders it; only the internal AGI arena manager uses",
          "  // it, to search its own list.",
          "  //",
          "  // So the name is ADMIN-ONLY: for an anonymous caller the column is not",
          "  // even selected, exactly like `email` below. The operator's manager",
          "  // still gets it, because that request carries the admin session.",
          "  const auth = await requireAdmin();",
          "  const isAdmin = !(\"error\" in auth);",
          "",
          "  // Fetch profiles with business names (include admins with agent_name set).",
        ].join("\n"),
      },
      {
        id: "split-select",
        from: [
          "  const { data: profiles, error } = await sb",
          "    .from('profiles')",
          "    .select('id, name, business_name, role, tier, crm_status, lead_score, is_premium, is_admin, newsletter_subscribed, gross_revenue, total_spent, purchase_count, agent_name, elo_rating, elo_rank, elo_wins, elo_losses, elo_streak, elo_peak, agent_status, created_at, arena_value_override, arena_reach_override, arena_rating, website')",
          "    .not('business_name', 'is', null)",
          "    .or('role.neq.admin,agent_name.not.is.null')",
          "    .order('elo_rating', { ascending: false });",
        ].join("\n"),
        to: [
          "  // `name` is selected for an admin caller only. (Two literal selects",
          "  // rather than one interpolated one: supabase-js parses the select string",
          "  // at the type level, so a template literal is a parse error, not a query.)",
          "  const baseQuery = isAdmin",
          "    ? sb",
          "        .from('profiles')",
          "        .select('id, name, business_name, role, tier, crm_status, lead_score, is_premium, is_admin, newsletter_subscribed, gross_revenue, total_spent, purchase_count, agent_name, elo_rating, elo_rank, elo_wins, elo_losses, elo_streak, elo_peak, agent_status, created_at, arena_value_override, arena_reach_override, arena_rating, website')",
          "    : sb",
          "        .from('profiles')",
          "        .select('id, business_name, role, tier, crm_status, lead_score, is_premium, is_admin, newsletter_subscribed, gross_revenue, total_spent, purchase_count, agent_name, elo_rating, elo_rank, elo_wins, elo_losses, elo_streak, elo_peak, agent_status, created_at, arena_value_override, arena_reach_override, arena_rating, website');",
          "",
          "  const { data, error } = await baseQuery",
          "    .not('business_name', 'is', null)",
          "    .or('role.neq.admin,agent_name.not.is.null')",
          "    .order('elo_rating', { ascending: false });",
          "  const profiles = (data ?? []) as any[];",
        ].join("\n"),
      },
      {
        id: "gate-owner-name",
        from: ["      ownerName: p.name,"].join("\n"),
        to: [
          "      // Admin-only: `undefined` is dropped by JSON.stringify, so an",
          "      // anonymous caller gets no ownerName field at all rather than an",
          "      // empty string that a future edit could mistake for a value.",
          "      ownerName: isAdmin ? p.name : undefined,",
        ].join("\n"),
      },
    ],
  },
  {
    id: "rankings-tiebreak",
    route: join("app", "api", "agents", "rankings", "route.ts"),
    /** Does this copy still carry the defect? */
    exposed(text) {
      return /agents\.sort\(\(a, b\) => b\.elo - a\.elo\);/.test(text);
    },
    describe:
      "the leaderboard order is now total: two agents with the same ELO no longer " +
      "reshuffle between requests",
    replacements: [
      {
        id: "deterministic-sort",
        from: ["  agents.sort((a, b) => b.elo - a.elo);"].join("\n"),
        to: [
          "  // The comparator must be a TOTAL order. `elo` alone is not: two agents",
          "  // can share a rating, and the query sorts on `elo_rating` alone, so",
          "  // Postgres returns tied rows in an arbitrary order. `Array.prototype.sort`",
          "  // is stable, so a 0 comparator preserves that arbitrary input order — and",
          "  // the public leaderboard reshuffled between requests (the same agents in",
          "  // a different order on every page load, and no two responses alike to",
          "  // cache). Older agent first, then by id, makes the order total and",
          "  // reproducible. This also decides the dedup below: with a tie, which",
          "  // duplicate row survives used to depend on the same arbitrary order.",
          "  agents.sort((a, b) => {",
          "    if (b.elo !== a.elo) return b.elo - a.elo;",
          "    const byAge = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));",
          "    if (byAge !== 0) return byAge;",
          "    return a.id.localeCompare(b.id);",
          "  });",
        ].join("\n"),
      },
    ],
  },
  {
    id: "newsletter-subscriber-list",
    route: join("app", "api", "newsletter", "route.ts"),
    exposed(text) {
      // A GET that reads the subscriber table with no admin gate.
      return (
        /export async function GET\(\)/.test(text) &&
        !/requireAdmin/.test(text) &&
        /\.from\("newsletter_subscriptions"\)/.test(text)
      );
    },
    describe:
      "the subscriber list is admin-only: `select(\"*\")` over every reader's email is no " +
      "longer answered for an unauthenticated caller",
    replacements: [
      {
        id: "import-require-admin",
        from: ['import { createClient } from "@/lib/supabase/server";'].join("\n"),
        to: [
          'import { createClient } from "@/lib/supabase/server";',
          'import { requireAdmin } from "@/lib/admin-auth";',
        ].join("\n"),
      },
      {
        id: "admin-gate-and-admin-client",
        from: [
          "export async function GET() {",
          "  noStore();",
          "  // Authenticated read — GET still goes through the RLS client because",
          "  // only logged-in users should see the subscriber list. Admins with",
          "  // service-role access use /api/admin/newsletter/audience instead.",
          "  try {",
          "    const supabase = await createClient();",
        ].join("\n"),
        to: [
          "export async function GET() {",
          "  noStore();",
          "  // Subscriber-list reads are explicitly admin-only. Do not rely on RLS",
          "  // returning zero rows for anonymous callers — if a future policy changes,",
          "  // this route must still not become an email-enumeration surface.",
          "  const auth = await requireAdmin();",
          "  if ('error' in auth && auth.error) return auth.error;",
          "",
          "  try {",
          "    const supabase = createAdminClient();",
        ].join("\n"),
      },
    ],
  },
];

function parseArgs(argv) {
  const options = { dryRun: false, dir: join(homedir(), "Desktop", "Clients") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") options.dryRun = true;
    else if (argv[i] === "--dir") options.dir = resolve(argv[++i] || "");
  }
  return options;
}

/** Every tree in the fleet that carries the RLS rule set (the family marker). */
function familyTrees(dir) {
  const found = [];
  const walk = (current, depth) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(current);
    } catch (error) {
      if (error && error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git") continue;
      const path = join(current, entry);
      let stats;
      try {
        stats = statSync(path);
      } catch (error) {
        if (error && error.code === "ENOENT") continue;
        throw error;
      }
      if (!stats.isDirectory()) continue;
      if (existsSync(join(path, "scripts", "anon-locked-tables.json"))) {
        found.push(path);
        continue; // do not descend — a nested tree is a copy of a copy
      }
      walk(path, depth + 1);
    }
  };
  walk(dir, 0);
  return found.sort();
}

function main() {
  const { dryRun, dir } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[fleet-pii] fleet root not found: ${dir}`);
    return 2;
  }
  const canonical = process.cwd();
  const trees = familyTrees(dir).filter((t) => t !== canonical);

  const patchedByClass = new Map(ROUTE_CLASSES.map((c) => [c.id, 0]));
  const alreadyByClass = new Map(ROUTE_CLASSES.map((c) => [c.id, 0]));
  const skipped = [];

  for (const tree of trees) {
    for (const klass of ROUTE_CLASSES) {
      const file = join(tree, klass.route);
      if (!existsSync(file)) continue;
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (!klass.exposed(text)) {
        alreadyByClass.set(klass.id, alreadyByClass.get(klass.id) + 1);
        continue;
      }

      // Every replacement must match, or the file is left alone.
      const missing = klass.replacements.filter((r) => !text.includes(r.from));
      if (missing.length) {
        skipped.push({
          dir: tree,
          id: klass.id,
          reason:
            `the pre-fix shape did not match in ${missing.length} place(s) ` +
            `(${missing.map((m) => m.id).join(", ")}) — left alone, because a partial rewrite is ` +
            "how a subtle bug gets shipped",
        });
        continue;
      }
      let next = text;
      for (const r of klass.replacements) next = next.replace(r.from, r.to);

      if (next === text) {
        skipped.push({
          dir: tree,
          id: klass.id,
          reason: "the substitutions produced no change — left alone",
        });
        continue;
      }
      if (!dryRun) writeFileSync(file, next);
      patchedByClass.set(klass.id, patchedByClass.get(klass.id) + 1);
      console.log(
        `  ${dryRun ? "would patch" : "patched"}  ${relative(dir, tree)} [${klass.id}] — ` +
          klass.describe,
      );
    }
  }

  console.log(`\n[fleet-pii] ${trees.length} tree(s) in the family.`);
  for (const klass of ROUTE_CLASSES) {
    console.log(
      `  ${klass.id}: ${patchedByClass.get(klass.id)} route(s) ` +
        `${dryRun ? "would be" : "were"} patched, ${alreadyByClass.get(klass.id)} already carried the fix.`,
    );
  }
  console.log(`  ${skipped.length} skipped.`);
  if (skipped.length) {
    console.error("[fleet-pii] The skipped trees still expose the data and need a human:");
    for (const s of skipped) {
      console.error(`  ${relative(dir, s.dir)} [${s.id}] — ${s.reason}`);
    }
  }
  console.log(
    "[fleet-pii] No other application code was touched. The copies still carry commits and " +
      "uncommitted work the canonical surface does not have — retiring or re-syncing them is " +
      "the operator's decision.",
  );
  return skipped.length ? 1 : 0;
}

process.exit(main());
