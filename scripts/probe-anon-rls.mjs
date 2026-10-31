/**
 * Probe: for every table in the live Supabase schema, determine whether the
 * ANON key can see it.
 *
 * An anon read of an RLS-locked table returns HTTP 200 with an empty
 * array -- not an error. That is the silent-failure class: the caller
 * cannot distinguish "no rows" from "not allowed to see rows", so the
 * defect is invisible in the response and loud in the product.
 *
 * WHY THIS PROBE IS NOT COUNT-BASED
 *
 * The first version of this probe classified a table as "locked" when the
 * anon key saw 0 rows and the service role saw some. That is a
 * DATA-dependent signal, and it has a hole the same size as an empty
 * table: a locked table with no rows is indistinguishable from a public
 * table with no rows, so it fell out of the rule set. The shipped rule
 * set was 119 tables where the live permission model locks 255 — 136
 * locked tables, every `inbound_*` and `federation_*` table among them,
 * were invisible to `npm run audit:rls`. The gate could not see a read of
 * them because it had never been told they exist.
 *
 * So lockedness is now decided by the PERMISSION MODEL, not by the data:
 *
 *   1. service role sees rows, anon sees none      -> LOCKED
 *   2. table is empty -> the RLS write probe        -> LOCKED / PUBLIC
 *   3. table is empty and cannot be probed safely    -> INDETERMINATE
 *
 * The write probe (see canAnonWrite) asks RLS to rule on an insert that
 * is guaranteed to fail the NOT NULL constraint. Postgres evaluates the
 * RLS WITH CHECK qual BEFORE the not-null constraint, so:
 *
 *   42501 "new row violates row-level security policy" -> RLS denied it
 *   23502 "null value in column ... violates not-null"  -> RLS allowed it
 *
 * Neither outcome creates a row. A table with NO required column that
 * lacks a default would insert successfully, so those are SKIPPED -- this
 * probe must never be able to write. A skipped table is reported as
 * INDETERMINATE rather than as public, and the gate treats
 * indeterminate as locked (fail closed).
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
 * Neither outcome creates a row. A table whose every required column
 * carries a default would insert successfully, so those are SKIPPED — this
 * probe must never be able to write.
 *
 * A required column that the OpenAPI spec does not describe at all is
 * treated as BLOCKING (we cannot prove it has a default, so we must
 * assume the insert will fail). The original version of this function
 * only counted a column as blocking when the spec described it *and*
 * showed no default, which is the less safe of the two readings.
 */
async function canAnonWrite(table) {
  const def = defs[table];
  const props = (def && def.properties) || {};
  const required = (def && def.required) || [];
  const blocking = required.filter(
    (c) => !(props[c] && props[c].default !== undefined),
  );
  if (blocking.length === 0) return { writable: null, skipped: true };

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
const errored = results.filter((r) => r.anonError);

/**
 * Classify every table as LOCKED, PUBLIC or INDETERMINATE.
 *
 * LOCKED      the anon key cannot read it.
 * PUBLIC      the anon key can read it.
 * INDETERMINATE we could not decide without risking a write.
 *
 * A table with rows is easy: the service role sees them and the anon key
 * does not -> LOCKED. A table with NO rows needs the permission model, so
 * the write probe rules on it. A table that cannot be probed safely is
 * INDETERMINATE, and the gate treats indeterminate as locked.
 */
const locked = [];
const publicTables = [];
const indeterminate = [];

for (const r of results) {
  if (r.anonError) {
    indeterminate.push({ ...r, reason: "anon read errored" });
    continue;
  }
  if ((r.service ?? 0) > 0) {
    if ((r.anon ?? 0) === 0) locked.push({ ...r, via: "row-count" });
    else publicTables.push({ ...r, via: "row-count" });
    continue;
  }
  // Empty table: row counts cannot decide. Ask the permission model.
  const w = await canAnonWrite(r.table);
  r.anonWritable = w.writable;
  r.anonWriteCode = w.code;
  // Safety net: the write probe must never create a row. If the table's
  // service-role count changed, the insert went through and this table is
  // NOT safe to probe — report it loudly and treat it as indeterminate
  // rather than classifying it from a probe that wrote to the database.
  if (!w.skipped && w.writable === null) {
    const after = await count(admin, r.table);
    if ((after.count ?? 0) !== (r.service ?? 0)) {
      console.error(
        `[probe] ${r.table}: row count changed during the write probe ` +
          `(${r.service} -> ${after.count}). The probe is not safe on this table.`,
      );
      indeterminate.push({
        ...r,
        via: "rls-write-probe",
        reason: "row count changed during the write probe",
      });
      continue;
    }
  }
  if (w.skipped) {
    indeterminate.push({
      ...r,
      via: "write-probe-skipped",
      reason:
        "table has no required column, so an RLS probe would risk inserting a row",
    });
  } else if (w.writable === false) {
    locked.push({ ...r, via: "rls-write-probe" });
  } else if (w.writable === true) {
    publicTables.push({ ...r, via: "rls-write-probe" });
  } else {
    indeterminate.push({ ...r, via: "rls-write-probe", reason: w.code });
  }
}

if (json) {
  console.log(
    JSON.stringify(
      {
        total: tables.length,
        totalTables: tables.length,
        generatedAt: new Date().toISOString(),
        source: "scripts/probe-anon-rls.mjs",
        locked: locked.map((r) => r.table).sort(),
        indeterminate: indeterminate.map((r) => r.table).sort(),
        public: publicTables.map((r) => r.table).sort(),
        results,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`probed ${tables.length} tables`);
  console.log(
    `\nANON-LOCKED — ${locked.length} (anon cannot read; service role can):`,
  );
  for (const r of locked) {
    console.log(
      `  ${r.table.padEnd(38)} service=${String(r.service).padStart(6)} via=${r.via}`,
    );
  }
  console.log(`\nPUBLIC to anon — ${publicTables.length}:`);
  for (const r of publicTables) {
    console.log(`  ${r.table.padEnd(38)} service=${String(r.service).padStart(6)}`);
  }
  console.log(`\nINDETERMINATE — ${indeterminate.length} (treated as locked):`);
  for (const r of indeterminate) {
    console.log(`  ${r.table.padEnd(38)} ${r.reason || r.anonWriteCode || ""}`);
  }
  console.log(`\nANON ERRORS (${errored.length}):`);
  for (const r of errored) {
    console.log(`  ${r.table.padEnd(38)} ${r.anonError}`);
  }
}

