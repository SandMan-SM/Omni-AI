#!/usr/bin/env tsx
/**
 * Audit local-vs-production environment drift for the ops secrets.
 *
 * Why this exists: an operator script that probes PRODUCTION has to
 * authenticate with the PRODUCTION secret. When the local `.env.local`
 * drifts from what Vercel actually holds, the probe does not fail loudly
 * as a configuration error — it fails as a 401 from the endpoint, which
 * looks exactly like "the endpoint rejected me for a different reason".
 * That is how a session can conclude "the bot is offline" when the real
 * cause was that it was holding the wrong secret, and how a publish probe
 * can look like a publish failure when nothing was ever authenticated.
 *
 * The same drift, in the other direction, is worse: a session can sign an
 * `omni_token` locally with a key production does not use, ship it, and
 * have production silently reject it.
 *
 * Rules:
 *   - Values are NEVER printed. Only the name, whether it is present on
 *     each side, and a short hash prefix (enough to tell two values apart,
 *     useless for recovering one).
 *   - Exit code is non-zero when a watched variable differs, so this can be
 *     used as a pre-flight check before a production probe.
 *   - Requires the Vercel CLI to be authenticated; it pulls production env
 *     into a temp file that is deleted before the script exits.
 *
 * Usage:
 *   npx tsx scripts/audit-env-drift.ts            # report, exit 1 on drift
 *   npx tsx scripts/audit-env-drift.ts --report   # report, always exit 0
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vercelJson } from "./vercel-token.mjs";

/**
 * Vercel has two kinds of secret in production:
 *   `encrypted` — the API can return the value, so `vercel env pull` writes it.
 *   `sensitive` — the API returns an EMPTY value to everyone, including the
 *                  account owner, and `env pull` writes `KEY=""`.
 * A `sensitive` variable therefore cannot be compared against the local
 * copy, and treating "empty" as "different" would make this gate report
 * drift on every run for every sensitive variable. It reads the project's
 * env metadata first and reports those as NOT COMPARABLE.
 */
type EnvKind = "readable" | "sensitive";

/**
 * Secrets that must be identical locally and in production, because a local
 * script uses the local copy to authenticate against production.
 */
const WATCHED = [
  "CRON_SECRET",
  "ADMIN_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OMNI_AUTH_TOKEN_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "RESEND_API_KEY",
] as const;

/**
 * Watched variables where a value present on only one side is acceptable.
 * `OMNI_AUTH_TOKEN_SECRET` is derived from the service-role key when it is
 * unset, so "unset locally, set in production" is a real difference, but it
 * is only a problem for signing, not for probing.
 */
const OPTIONAL_WHEN_ABSENT = new Set<string>(["OMNI_AUTH_TOKEN_SECRET", "ADMIN_API_KEY"]);

/** The Vercel project this checkout deploys to, from `.vercel/project.json`. */
function projectId(): string | null {
  const path = join(process.cwd(), ".vercel", "project.json");
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { projectId?: string };
    return parsed.projectId ?? null;
  } catch {
    return null;
  }
}

/**
 * Ask Vercel which production variables are readable. Returns a map of
 * variable name to kind. Variables Vercel will not return are `sensitive`.
 *
 * The credential comes from `scripts/vercel-token.mjs`, which refreshes an
 * expired token through the CLI's OAuth flow. The previous version read the
 * auth file directly and treated any failure as "no kinds known" — so an
 * expired token made the script report that every production variable was
 * unreadable, which is the opposite of what had happened.
 */
async function productionEnvKinds(): Map<string, EnvKind> {
  const kinds = new Map<string, EnvKind>();
  const id = projectId();
  if (!id) return kinds;
  try {
    const parsed = (await vercelJson(
      `https://api.vercel.com/v9/projects/${id}/env`,
    )) as { envs?: { key: string; target?: string[]; type?: string }[] };
    for (const entry of parsed.envs ?? []) {
      if (!entry.target?.includes("production")) continue;
      kinds.set(entry.key, entry.type === "sensitive" ? "sensitive" : "readable");
    }
  } catch {
    // Fall back to the pulled file: a variable that came back empty AND is
    // not known to be sensitive is treated as unreadable below.
  }
  return kinds;
}

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function fingerprint(value: string | undefined): string {
  if (!value) return "absent";
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function pullProductionEnv(): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), "omni-env-drift-"));
  const file = join(dir, "production.env");
  try {
    execFileSync("npx", ["vercel", "env", "pull", file, "--environment=production", "--yes"], {
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    });
    return parseEnvFile(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  const reportOnly = process.argv.includes("--report");
  const local = parseEnvFile(join(process.cwd(), ".env.local"));
  let production: Record<string, string>;
  try {
    production = pullProductionEnv();
  } catch (error) {
    console.error("[env-drift] could not pull the production environment from Vercel.");
    console.error("[env-drift]", error instanceof Error ? error.message.split("\n")[0] : String(error));
    console.error("[env-drift] run `npx vercel whoami` to confirm the CLI is authenticated.");
    return 2;
  }

  const drifted: string[] = [];
  const absentLocally: string[] = [];
  const notComparable: string[] = [];
  const kinds = await productionEnvKinds();
  console.log(`[env-drift] comparing ${WATCHED.length} watched secrets against production (values are never printed)`);
  for (const name of WATCHED) {
    const localValue = local[name];
    const productionValue = production[name];
    const kind = kinds.get(name);
    if (kind === "sensitive" || (!productionValue && kind === undefined && !localValue)) {
      // Vercel will not return this value, so there is nothing to compare.
      notComparable.push(name);
      console.log(`  n/a      ${name} (production value is not readable by the API)`);
      continue;
    }
    if (!productionValue && !localValue) {
      notComparable.push(name);
      console.log(`  n/a      ${name} (unset on both sides)`);
      continue;
    }
    const localFingerprint = fingerprint(localValue);
    const productionFingerprint = fingerprint(productionValue);
    if (localFingerprint === productionFingerprint) {
      console.log(`  ok       ${name} (${localFingerprint})`);
      continue;
    }
    if (!localValue && OPTIONAL_WHEN_ABSENT.has(name)) {
      absentLocally.push(name);
      console.log(`  absent   ${name} (local: absent, production: ${productionFingerprint})`);
      continue;
    }
    drifted.push(name);
    console.log(
      `  DRIFTED  ${name} (local: ${localFingerprint}, production: ${productionFingerprint})`,
    );
  }

  if (notComparable.length) {
    console.log(
      `[env-drift] ${notComparable.length} variable(s) are not comparable because Vercel does not return ` +
        `their value: ${notComparable.join(", ")}.`,
    );
  }

  if (absentLocally.length) {
    console.log(
      `[env-drift] ${absentLocally.length} variable(s) are unset locally and set in production. ` +
        `Anything that SIGNS a token locally will not verify in production.`,
    );
  }
  if (!drifted.length) {
    console.log("[env-drift] no drift in the watched secrets.");
    return 0;
  }
  console.log(
    `[env-drift] ${drifted.length} watched secret(s) differ from production: ${drifted.join(", ")}. ` +
      `A script that authenticates against production with the local copy will be rejected with 401, ` +
      `which looks like an endpoint failure rather than a credential mismatch.`,
  );
  console.log(
    "[env-drift] fix by copying the production value of the drifted variable into the local env file. " +
      "Do NOT overwrite the whole local env file with `vercel env pull`: the sensitive production " +
      "variables come back empty and would silently break local sends.",
  );
  return reportOnly ? 0 : 1;
}

process.exit(await main());
