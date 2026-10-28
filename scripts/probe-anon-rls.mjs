/**
 * Probe: for every table in the live Supabase schema, compare what the
 * ANON key can see against what the SERVICE ROLE key can see.
 *
 * An anon read of an RLS-locked table returns HTTP 200 with an empty
 * array -- not an error. That is the silent-failure class: the caller
 * cannot distinguish "no rows" from "not allowed to see rows", so the
 * defect is invisible in the response and loud in the product.
 *
 * Usage: node scripts/probe-anon-rls.mjs [--json]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
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

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("missing Supabase env (url/anon/service)");
  process.exit(2);
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false },
});
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function count(client, table) {
  // head:true returns the count in `count`; `data` is null on success.
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return { count: null, error: error.message };
  return { count: count ?? 0, error: null };
}

// Discover every table via the OpenAPI schema listing.
const schema = await fetch(`${url}/rest/v1/`, {
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: "application/openapi+json",
  },
});
if (!schema.ok) {
  console.error(`schema fetch failed: ${schema.status}`);
  process.exit(2);
}
const spec = await schema.json();
const defs = spec.definitions || spec.components?.schemas || {};
const tables = Object.keys(defs).filter((t) => !t.startsWith("+"));
tables.sort();

const results = [];
for (const table of tables) {
  const a = await count(anon, table);
  const s = await count(admin, table);
  results.push({
    table,
    anon: a.count,
    service: s.count,
    anonError: a.error,
    serviceError: s.error,
    locked: a.count === 0 && (s.count ?? 0) > 0,
  });
}

/**
 * Can the ANON key WRITE to a table?
 *
 * Postgres evaluates the RLS WITH CHECK qual BEFORE the NOT NULL
 * constraint, so an insert that omits a required column and is therefore
 * guaranteed to fail can still tell us whether RLS allowed it:
 *
 *   42501 "new row violates row-level security policy"  -> RLS denied it
 *   23502 "null value in column ... violates not-null"   -> RLS allowed it
 *
 * Neither outcome creates a row. A table with NO required column that lacks
 * a default would insert successfully, so those are SKIPPED — this probe
 * must never be able to write.
 */
async function canAnonWrite(table) {
  const def = defs[table];
  const props = (def && def.properties) || {};
  const required = (def && def.required) || [];
  const missing = required.filter((c) => props[c] && props[c].default === undefined);
  if (missing.length === 0) return { writable: null, skipped: true };

  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  let code = "";
  try {
    code = JSON.parse(text).code || "";
  } catch {}
  if (code === "42501" || res.status === 401 || res.status === 403) {
    return { writable: false, code };
  }
  if (code === "23502" || res.status === 400) {
    return { writable: true, code };
  }
  return { writable: null, code: code || String(res.status) };
}


const json = process.argv.includes("--json");
const locked = results.filter((r) => r.locked);
const errored = results.filter((r) => r.anonError);

if (!process.argv.includes("--no-write-probe")) {
  for (const r of locked) {
    const w = await canAnonWrite(r.table);
    r.anonWritable = w.writable;
    r.anonWriteCode = w.code;
  }
}

if (json) {
  console.log(
    JSON.stringify({ total: tables.length, locked, errored, results }, null, 2),
  );
} else {
  console.log(`probed ${tables.length} tables`);
  console.log(
    `\nANON-LOCKED (anon sees 0, service role sees rows) — ${locked.length}:`,
  );
  for (const r of locked) {
    const w =
      r.anonWritable === undefined
        ? ""
        : `  anonWrite=${r.anonWritable ? "ALLOWED" : "denied"}`;
    console.log(
      `  ${r.table.padEnd(38)} service=${String(r.service).padStart(6)}${w}`,
    );
  }
  console.log(`\nANON ERRORS (${errored.length}):`);
  for (const r of errored) {
    console.log(`  ${r.table.padEnd(38)} ${r.anonError}`);
  }
}

