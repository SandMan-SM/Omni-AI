#!/usr/bin/env node
/**
 * Federation protocol helper.
 *
 * The `federation` schema lives in the shared Supabase project but is not
 * exposed through PostgREST, so it can only be reached through the
 * service-role-only HTTPS wrappers:
 *
 *   hermes_federation_surface(domain)
 *   hermes_federation_acquire_lease(target, agent, kind, session, note, ttl)
 *   hermes_federation_renew_lease(lease_id, agent, ttl)
 *   hermes_federation_release_lease(lease_id, agent, action, detail)
 *   hermes_federation_log_change(agent, target, action, detail, lease_id)
 *
 * Usage:
 *   node scripts/federation.mjs surface <domain>
 *   node scripts/federation.mjs acquire <domain> <agent> <kind> <session> <note> [ttl]
 *   node scripts/federation.mjs release <leaseId> <agent> <action> '<json detail>'
 *   node scripts/federation.mjs log <agent> <domain> <action> '<json detail>' [leaseId]
 *
 * Reads the Supabase URL and service-role key from the local env files.
 * Never prints the key.
 */
import { readFileSync, existsSync } from "node:fs";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(2);
}

async function rpc(name, payload) {
  const res = await fetch(`${URL_BASE.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`${name} failed (${res.status}):`, JSON.stringify(body));
    process.exit(1);
  }
  return body;
}

const [, , cmd, ...rest] = process.argv;

if (cmd === "surface") {
  const r = await rpc("hermes_federation_surface", { p_domain: rest[0] });
  console.log(JSON.stringify(r, null, 2));
} else if (cmd === "acquire") {
  const [target, agent, kind, session, note, ttl] = rest;
  const r = await rpc("hermes_federation_acquire_lease", {
    p_target: target,
    p_agent: agent,
    p_kind: kind,
    p_session_ref: session,
    p_note: note,
    p_ttl_minutes: Number(ttl || 45),
  });
  console.log(JSON.stringify(r, null, 2));
  if (!r?.granted) process.exit(3);
} else if (cmd === "release") {
  const [leaseId, agent, action, detail] = rest;
  const r = await rpc("hermes_federation_release_lease", {
    p_lease_id: Number(leaseId),
    p_agent: agent,
    p_action: action,
    p_detail: detail ? JSON.parse(detail) : {},
  });
  console.log(JSON.stringify(r, null, 2));
} else if (cmd === "log") {
  const [agent, target, action, detail, leaseId] = rest;
  const r = await rpc("hermes_federation_log_change", {
    p_agent: agent,
    p_target: target,
    p_action: action,
    p_detail: detail ? JSON.parse(detail) : {},
    p_lease_id: leaseId ? Number(leaseId) : null,
  });
  console.log(JSON.stringify(r, null, 2));
} else {
  console.error("usage: federation.mjs surface|acquire|release|log ...");
  process.exit(2);
}
