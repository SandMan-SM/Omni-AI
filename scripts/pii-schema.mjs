/**
 * The ONE definition of what a personal-data column is, and how a table is
 * recognised as holding other people's rows.
 *
 * Three tools depend on this and they must not be able to disagree about
 * what the rule IS:
 *
 *   scripts/refresh-pii-ruleset.mjs      writes the rule set
 *   scripts/audit-pii-schema-drift.mjs    checks the rule set against the live schema
 *   scripts/audit-public-pii.mjs          applies the rule set to the routes
 *
 * The same shape as `scripts/fleet-trees.mjs`, which exists because "what is a
 * surface?" was being answered twice. Two implementations of "what is a
 * personal column?" would drift exactly the way the hand-written table list
 * drifted, and the drift would be invisible: the generator would write a rule
 * set the gate cannot read, or the gate would judge a table the generator
 * never described.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A column that identifies a PERSON.
 *
 * A bare `name` is deliberately NOT here. It is a business name as often as a
 * person's name (`omni_businesses.name`, `council_agents.name`,
 * `campaigns.name`), and the schema cannot tell the two apart. The tables
 * where a bare `name` IS known to be a person's name are listed by hand in
 * `audit-public-pii.mjs` as an explicit overlay — a meaning the schema cannot
 * carry, so it has to be written down.
 */
export const PERSONAL_COLUMN =
  /^(?:[a-z_]*email(?:_address)?|phone(?:_number)?|mobile|cell|tel|first_?name|last_?name|full_?name|middle_?name|maiden_?name)$/i;

/**
 * The tables where a bare `name` column holds a PERSON's name.
 *
 * Hand-maintained on purpose and kept short: the schema says a column is
 * called `name`, not whose name it is. Every table here also holds an email
 * or a phone address, so it is a table of people and not of things.
 */
export const NAME_IS_A_PERSON = new Set([
  "profiles",
  "newsletter_subscriptions",
  "federation_owners",
  "federation_newsletter_subscribers",
  "landing_page_leads",
  "inbound_leads",
]);

/**
 * Does this column identify a person?
 *
 * `bareNameIsPersonal` is true for the overlay tables above, where `name` is
 * known to be a person's name.
 */
export function isPersonalColumn(column, bareNameIsPersonal = false) {
  if (PERSONAL_COLUMN.test(column)) return true;
  return bareNameIsPersonal && /^name$/i.test(column);
}

/**
 * Derive the personal columns of every table in a schema listing.
 *
 * @param defs the OpenAPI `definitions` / `components.schemas` map
 * @returns Map<table, string[]> — only the tables that hold a person's rows
 */
export function derivePersonalColumns(defs) {
  const out = new Map();
  for (const [table, def] of Object.entries(defs || {})) {
    if (table.startsWith("+")) continue;
    const props = def?.properties || {};
    const cols = Object.keys(props).filter((c) =>
      isPersonalColumn(c, NAME_IS_A_PERSON.has(table)),
    );
    if (cols.length) out.set(table, cols.sort());
  }
  return out;
}

/**
 * Every table in a schema listing, sorted.
 */
export function schemaTableNames(defs) {
  return Object.keys(defs || {})
    .filter((t) => !t.startsWith("+"))
    .sort();
}

/**
 * Read a `.env`-shaped file into a plain object. Never writes.
 */
export function loadEnvFile(file) {
  const out = {};
  let raw = "";
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

/**
 * The local env, `.env` overridden by `.env.local`.
 *
 * Values are read, never written, and never printed: a secret that reaches
 * a log is a secret that has leaked.
 */
export function localEnv(root = process.cwd()) {
  return {
    ...loadEnvFile(join(root, ".env")),
    ...loadEnvFile(join(root, ".env.local")),
  };
}

/**
 * The project ref of a Supabase URL — the `abcdefgh` in
 * `https://abcdefgh.supabase.co`.
 *
 * A rule set is a MEASUREMENT OF ONE DATABASE. Carrying it to a tree that
 * points at a different project would judge that tree's routes against
 * another database's shape, which is not a measurement at all. So the ref
 * travels with the rule set, and a gate that can see a mismatch refuses to
 * answer.
 */
export function projectRefFromUrl(url) {
  const m = String(url || "").match(/https?:\/\/([a-z0-9-]+)\.supabase\./i);
  return m ? m[1] : null;
}

/**
 * The Supabase URL and service-role key of the local env.
 *
 * The service role is required for the OpenAPI listing: the anon key gets
 * a schema without the tables it cannot read, and a gate that silently fell
 * back to a lesser credential would be measuring a different schema than
 * the one production serves.
 */
export function localSupabase(root = process.cwd()) {
  const env = localEnv(root);
  // The URL falls back to the process environment: on a build host there is
  // no `.env` file on disk, and the project the build is FOR is the one the
  // rule set has to be judged against.
  const url =
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    null;
  return {
    url,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || null,
    projectRef: projectRefFromUrl(url || ""),
  };
}
